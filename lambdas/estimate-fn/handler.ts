import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getClient, MODEL, cachedSystem } from '../shared/anthropic.js';
import { ok, err } from '../shared/response.js';
import type { EstimateRequest, EstimatePriceResponse } from '../shared/types.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts.js';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.DYNAMODB_TABLE!;

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const start = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const body = JSON.parse(event.body ?? '{}') as EstimateRequest;

    if (!body.object || !body.condition || !body.category) {
      return err('Missing object, condition or category', 400);
    }

    const message = await (await getClient()).messages.create({
      model: MODEL,
      max_tokens: 128,
      system: [cachedSystem(SYSTEM_PROMPT)],
      messages: [{ role: 'user', content: buildUserPrompt(body.object, body.condition, body.category) }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const data = JSON.parse(text) as EstimatePriceResponse;

    await audit(requestId, '/estimate', Date.now() - start, 200);
    return ok(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    await audit(requestId, '/estimate', Date.now() - start, 500, msg);
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
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          requestId,
          timestamp: new Date().toISOString(),
          endpoint,
          durationMs,
          statusCode,
          ...(error && { error }),
        },
      })
    );
  } catch {}
}
