import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getClient, MODEL_ID, cachedSystem, extractText, inferenceConfig } from '../shared/bedrock.js';
import { detectObject } from '../shared/rekognition.js';
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

    // Detection (object / category / confidence) is handled by Amazon Rekognition,
    // a dedicated computer-vision model — faster, cheaper and more reliable than an LLM.
    const detected = await detectObject(imageBytes);
    if (!detected) {
      return err('No object detected in image', 422);
    }

    // Condition is a qualitative judgement Rekognition cannot make, so Claude
    // assesses it, grounded by the detected object name.
    const condition = await assessCondition(imageBytes, detected.object);

    const data: AnalyzeResponse = {
      object: detected.object,
      category: detected.category,
      condition,
      confidence: detected.confidence,
    };

    await audit(requestId, '/analyze', Date.now() - start, 200);
    return ok(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    await audit(requestId, '/analyze', Date.now() - start, 500, msg);
    return err(msg);
  }
};

async function assessCondition(imageBytes: Uint8Array, object: string): Promise<string> {
  const response = await getClient().send(new ConverseCommand({
    modelId: MODEL_ID,
    system: cachedSystem(SYSTEM_PROMPT),
    messages: [{
      role: 'user',
      content: [
        { image: { format: 'jpeg', source: { bytes: imageBytes } } },
        { text: buildUserPrompt(object) },
      ],
    }],
    inferenceConfig: inferenceConfig(64),
  }));

  const text = extractText(response.output?.message?.content);
  try {
    const parsed = JSON.parse(text) as { condition?: string };
    if (!parsed.condition) {
      throw new Error('missing condition');
    }
    return parsed.condition;
  } catch {
    throw new Error('Invalid response from AI model');
  }
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
