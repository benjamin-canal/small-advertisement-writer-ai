import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ConverseCommand, type ContentBlock } from '@aws-sdk/client-bedrock-runtime';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getClient, MODEL_ID, cachedSystem, extractText, inferenceConfig, parseModelJson } from '../shared/bedrock.js';
import { gatherHints } from '../shared/rekognition.js';
import { canonicalBrand } from '../shared/reference/brands.js';
import { ok, err } from '../shared/response.js';
import type { AnalyzeImageRef, AnalyzeImageRole, AnalyzeRequest, AnalyzeResponse, AttributeGuess } from '../shared/types.js';
import { SYSTEM_PROMPT, buildUserPrompt, type ImagePromptHints } from './prompts.js';

const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const BUCKET = process.env.S3_BUCKET!;
const TABLE = process.env.DYNAMODB_TABLE!;

const MAX_IMAGES = 4;

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const start = Date.now();
  let requestId = 'unknown';

  try {
    const body = JSON.parse(event.body ?? '{}') as AnalyzeRequest;
    requestId = body.requestId;

    if (!body.requestId || !/^[\w\-]{1,128}$/.test(body.requestId)) {
      return err('Missing or invalid requestId', 400);
    }

    // Accept the multi-image contract, falling back to the legacy single s3Key.
    const refs = normalizeImageRefs(body);
    if (refs.length === 0) {
      return err('Missing images', 400);
    }
    if (refs.length > MAX_IMAGES) {
      return err(`Too many images (max ${MAX_IMAGES})`, 400);
    }
    for (const ref of refs) {
      if (!/^[\w\-./]+$/.test(ref.s3Key) || /\.\./.test(ref.s3Key)) {
        return err('Invalid s3Key', 400);
      }
    }

    const images = await Promise.all(refs.map(loadImage));

    const data = await identify(images);

    await audit(requestId, '/analyze', Date.now() - start, 200);
    return ok(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    console.error('[analyze]', e);
    await audit(requestId, '/analyze', Date.now() - start, 500, msg);
    return err(msg);
  }
};

// Collapses the request into a normalized, de-duplicated list of image refs.
function normalizeImageRefs(body: AnalyzeRequest): Required<AnalyzeImageRef>[] {
  const raw = body.images?.length ? body.images : body.s3Key ? [{ s3Key: body.s3Key }] : [];
  const seen = new Set<string>();
  const refs: Required<AnalyzeImageRef>[] = [];
  for (const r of raw) {
    if (!r?.s3Key || seen.has(r.s3Key)) continue;
    seen.add(r.s3Key);
    refs.push({ s3Key: r.s3Key, role: r.role === 'label' ? 'label' : 'item' });
  }
  return refs;
}

interface LoadedImage {
  role: AnalyzeImageRole;
  bytes: Uint8Array;
  format: 'jpeg' | 'png';
  hints: ImagePromptHints;
}

// Downloads one image, validates its format/size, and gathers vision hints.
async function loadImage(ref: Required<AnalyzeImageRef>): Promise<LoadedImage> {
  const s3Res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: ref.s3Key }));
  if (!s3Res.Body) {
    throw new Error('Object not found');
  }
  const bytes = await s3Res.Body.transformToByteArray();

  if (bytes.byteLength > 5 * 1024 * 1024) {
    throw new Error('Image too large (max 5 MB)');
  }

  // The uploaded bytes may be PNG/WebP even when the S3 key ends in .jpg, so the
  // real format is detected from the magic bytes. Rekognition and Bedrock both
  // reject a declared format that does not match the bytes (→ 500), and Rekognition
  // only supports JPEG/PNG.
  const format = detectImageFormat(bytes);
  if (!format) {
    throw new Error('Unsupported image format (JPEG or PNG only)');
  }

  const hints = await gatherHints(bytes);
  return { role: ref.role, bytes, format, hints: { role: ref.role, ...hints } };
}

// Detects the image format from its magic bytes. Returns null for anything other
// than JPEG or PNG (the formats supported by both Rekognition and Bedrock here).
function detectImageFormat(bytes: Uint8Array): 'jpeg' | 'png' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'png';
  }
  return null;
}

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'] as const;
const GENDERS = ['men', 'women', 'kids', 'unisex'] as const;

// Order item photos before label photos so the model anchors on the product
// first, then refines size/material from the label.
function orderForPrompt(images: LoadedImage[]): LoadedImage[] {
  return [...images].sort((a, b) => (a.role === b.role ? 0 : a.role === 'item' ? -1 : 1));
}

async function identify(images: LoadedImage[]): Promise<AnalyzeResponse> {
  const ordered = orderForPrompt(images);

  const content: ContentBlock[] = ordered.map((img) => ({
    image: { format: img.format, source: { bytes: img.bytes } },
  }));
  content.push({ text: buildUserPrompt(ordered.map((img) => img.hints)) });

  const response = await getClient().send(new ConverseCommand({
    modelId: MODEL_ID,
    system: cachedSystem(SYSTEM_PROMPT),
    messages: [{ role: 'user', content }],
    inferenceConfig: inferenceConfig(768),
  }));

  const parsed = parseModelJson<RawAnalysis>(extractText(response.output?.message?.content));
  if (!parsed.type && !parsed.brand) {
    throw new Error('Invalid response from AI model');
  }

  // Normalise the brand against the reference so listings stay consistent
  // ("nike"/"NIKE" → "Nike"), keeping the model's spelling when unknown to us.
  const brand = normalizeGuess(parsed.brand, (v) => canonicalBrand(v) ?? v);

  const attributes = {
    brand,
    model: normalizeGuess(parsed.model),
    type: normalizeGuess(parsed.type, (v) => v.toLowerCase()),
    size: normalizeGuess(parsed.size),
    color: normalizeGuess(parsed.color, (v) => v.toLowerCase()),
    material: normalizeGuess(parsed.material, (v) => v.toLowerCase()),
    gender: normalizeGuess(parsed.gender, (v) => coerceEnum(v, GENDERS, 'unisex')),
    condition: normalizeGuess(parsed.condition, (v) => coerceEnum(v, CONDITIONS, 'good')),
  };

  return {
    ...attributes,
    keywords: normalizeKeywords(parsed.keywords),
    overallConfidence: round(mean(Object.values(attributes).map((g) => g.confidence))),
  };
}

interface RawGuess {
  value?: unknown;
  confidence?: unknown;
  alternatives?: unknown;
}

interface RawAnalysis {
  brand?: RawGuess;
  model?: RawGuess;
  type?: RawGuess;
  size?: RawGuess;
  color?: RawGuess;
  material?: RawGuess;
  gender?: RawGuess;
  condition?: RawGuess;
  keywords?: unknown;
}

// Coerces a raw model guess into a well-formed AttributeGuess: clamps the
// confidence, applies an optional canonicaliser to the value and each
// alternative, then de-duplicates alternatives and drops the chosen value.
function normalizeGuess(raw: RawGuess | undefined, canon?: (v: string) => string): AttributeGuess {
  const rawValue = typeof raw?.value === 'string' ? raw.value.trim() : '';
  const value = rawValue ? (canon ? canon(rawValue) : rawValue) : null;

  const confidence = clamp01(typeof raw?.confidence === 'number' ? raw.confidence : value ? 0.5 : 0);

  const seen = new Set<string>(value ? [value.toLowerCase()] : []);
  const alternatives: string[] = [];
  if (Array.isArray(raw?.alternatives)) {
    for (const alt of raw.alternatives) {
      if (typeof alt !== 'string' || !alt.trim()) continue;
      const mapped = canon ? canon(alt.trim()) : alt.trim();
      const key = mapped.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      alternatives.push(mapped);
      if (alternatives.length >= 3) break;
    }
  }

  return { value, confidence, alternatives };
}

function coerceEnum<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  const v = value.toLowerCase().replace(/[\s-]+/g, '_');
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function normalizeKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of raw) {
    if (typeof k !== 'string') continue;
    const t = k.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= 12) break;
  }
  return out;
}

function clamp01(n: number): number {
  return Math.min(Math.max(n, 0), 1);
}

function mean(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

async function audit(
  requestId: string,
  endpoint: string,
  durationMs: number,
  statusCode: number,
  error?: string
) {
  try {
    const expiresAt = Math.floor(Date.now() / 1000) + 90 * 24 * 3600;
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: { requestId, timestamp: new Date().toISOString(), endpoint, durationMs, statusCode, expiresAt, ...(error && { error }) },
    }));
  } catch {}
}
