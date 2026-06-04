import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getClient, MODEL_ID, cachedSystem, extractText, inferenceConfig } from '../shared/bedrock.js';
import { ok, err } from '../shared/response.js';
import type { AnalyzeRequest, AnalyzeResponse } from '../shared/types.js';
import { SYSTEM_PROMPT, USER_PROMPT } from './prompts.js';

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

    const response = await getClient().send(new ConverseCommand({
      modelId: MODEL_ID,
      system: cachedSystem(SYSTEM_PROMPT),
      messages: [{
        role: 'user',
        content: [
          { image: { format: 'jpeg', source: { bytes: imageBytes } } },
          { text: USER_PROMPT },
        ],
      }],
      inferenceConfig: inferenceConfig(256),
    }));

    const text = extractText(response.output?.message?.content);
    let data: AnalyzeResponse;
    try {
      data = JSON.parse(text) as AnalyzeResponse;
    } catch {
      throw new Error('Invalid response from AI model');
    }

    await audit(requestId, '/analyze', Date.now() - start, 200);
    return ok(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    await audit(requestId, '/analyze', Date.now() - start, 500, msg);
    return err(msg);
  }
};

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
