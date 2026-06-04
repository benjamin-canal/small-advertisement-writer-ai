import { timingSafeEqual } from 'node:crypto';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import type {
  APIGatewayRequestAuthorizerEventV2,
  APIGatewaySimpleAuthorizerWithContextResult,
} from 'aws-lambda';

const sm = new SecretsManagerClient({});
const SECRET_ARN = process.env.API_KEY_SECRET_ARN!;

let cachedKey: string | null = null;
let cacheExpiry = 0;

async function getApiKey(): Promise<string | null> {
  const now = Date.now();
  if (cachedKey && now < cacheExpiry) return cachedKey;

  try {
    const res = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ARN }));
    if (!res.SecretString) return null;
    cachedKey = res.SecretString;
    cacheExpiry = now + 270_000; // 4.5 min (API GW caches 5 min)
    return cachedKey;
  } catch {
    // Return stale cache if available, deny otherwise
    return cachedKey ?? null;
  }
}

export const handler = async (
  event: APIGatewayRequestAuthorizerEventV2
): Promise<APIGatewaySimpleAuthorizerWithContextResult<Record<string, string>>> => {
  const key = event.headers?.['x-api-key'] ?? event.headers?.['X-API-Key'];
  if (!key) return { isAuthorized: false, context: {} };

  const expected = await getApiKey();
  if (!expected) return { isAuthorized: false, context: {} };

  const isAuthorized =
    key.length === expected.length &&
    timingSafeEqual(Buffer.from(key), Buffer.from(expected));
  return { isAuthorized, context: {} };
};
