import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getClient, MODEL, cachedSystem } from '../shared/anthropic.js';
import { ok, err } from '../shared/response.js';
import type { GenerateRequest, GeneratedListing } from '../shared/types.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts.js';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.DYNAMODB_TABLE!;

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const start = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const body = JSON.parse(event.body ?? '{}') as GenerateRequest;

    if (!body.object || !body.condition || !body.category || !body.platform || !body.priceRange) {
      return err('Missing required fields', 400);
    }

    const message = await getClient().messages.create({
      model: MODEL,
      max_tokens: 512,
      system: [cachedSystem(SYSTEM_PROMPT)],
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(
            body.object,
            body.condition,
            body.category,
            body.platform,
            body.priceRange
          ),
        },
      ],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const data = JSON.parse(text) as GeneratedListing;

    await audit(requestId, '/generate', Date.now() - start, 200);
    return ok(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    await audit(requestId, '/generate', Date.now() - start, 500, msg);
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
