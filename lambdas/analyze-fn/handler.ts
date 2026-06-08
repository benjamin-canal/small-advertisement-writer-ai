import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getClient, MODEL_ID, cachedSystem, extractText, inferenceConfig, parseModelJson } from '../shared/bedrock.js';
import { gatherHints, type VisionHints } from '../shared/rekognition.js';
import { ok, err } from '../shared/response.js';
import type { AnalyzeRequest, AnalyzeResponse } from '../shared/types.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts.js';

const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const BUCKET = process.env.S3_BUCKET!;
const TABLE = process.env.DYNAMODB_TABLE!;

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const start = Date.now();
  let requestId = 'unknown';

  try {
    const body = JSON.parse(event.body ?? '{}') as AnalyzeRequest;
    requestId = body.requestId;

    if (!body.s3Key || !body.requestId) {
      return err('Missing s3Key or requestId', 400);
    }

    if (!/^[\w\-./]+$/.test(body.s3Key) || /\.\./.test(body.s3Key)) {
      return err('Invalid s3Key', 400);
    }

    if (!/^[\w\-]{1,128}$/.test(body.requestId)) {
      return err('Invalid requestId', 400);
    }

    const s3Res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: body.s3Key }));
    if (!s3Res.Body) {
      return err('Object not found', 404);
    }
    const imageBytes = await s3Res.Body.transformToByteArray();

    if (imageBytes.byteLength > 5 * 1024 * 1024) {
      return err('Image too large (max 5 MB)', 400);
    }

    // The uploaded bytes may be PNG/WebP even when the S3 key ends in .jpg, so the
    // real format is detected from the magic bytes. Rekognition and Bedrock both
    // reject a declared format that does not match the bytes (→ 500), and Rekognition
    // only supports JPEG/PNG.
    const format = detectImageFormat(imageBytes);
    if (!format) {
      return err('Unsupported image format (JPEG or PNG only)', 400);
    }

    // Rekognition supplies grounding hints (generic labels + on-item text/logos);
    // Claude does the actual identification, which it does far better for brand/model.
    const hints = await gatherHints(imageBytes);
    const data = await identify(imageBytes, format, hints);

    await audit(requestId, '/analyze', Date.now() - start, 200);
    return ok(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    console.error('[analyze]', e);
    await audit(requestId, '/analyze', Date.now() - start, 500, msg);
    return err(msg);
  }
};

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

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'];

async function identify(
  imageBytes: Uint8Array,
  format: 'jpeg' | 'png',
  hints: VisionHints
): Promise<AnalyzeResponse> {
  const response = await getClient().send(new ConverseCommand({
    modelId: MODEL_ID,
    system: cachedSystem(SYSTEM_PROMPT),
    messages: [{
      role: 'user',
      content: [
        { image: { format, source: { bytes: imageBytes } } },
        { text: buildUserPrompt(hints) },
      ],
    }],
    inferenceConfig: inferenceConfig(256),
  }));

  const parsed = parseModelJson<Partial<AnalyzeResponse>>(extractText(response.output?.message?.content));
  if (!parsed.object || !parsed.category || !parsed.condition) {
    throw new Error('Invalid response from AI model');
  }

  return {
    object: parsed.object,
    category: parsed.category,
    condition: CONDITIONS.includes(parsed.condition) ? parsed.condition : 'good',
    confidence: typeof parsed.confidence === 'number' ? Math.min(Math.max(parsed.confidence, 0), 1) : 0.7,
  };
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
