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

    const s3Res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: body.s3Key }));
    const imageBytes = await s3Res.Body!.transformToByteArray();

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
    const data = JSON.parse(text) as AnalyzeResponse;

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
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: { requestId, timestamp: new Date().toISOString(), endpoint, durationMs, statusCode, ...(error && { error }) },
    }));
  } catch {}
}
