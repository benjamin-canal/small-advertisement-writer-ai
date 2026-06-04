import Anthropic from '@anthropic-ai/sdk';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const sm = new SecretsManagerClient({});
const SECRET_ARN = process.env.ANTHROPIC_SECRET_ARN!;

let _apiKey: string | null = null;
let _keyExpiry = 0;
let _client: Anthropic | null = null;

async function getApiKey(): Promise<string> {
  const now = Date.now();
  if (_apiKey && now < _keyExpiry) return _apiKey;

  const res = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ARN }));
  _apiKey = res.SecretString!;
  _keyExpiry = now + 270_000; // refresh every 4.5 min
  _client = null; // invalidate client when key rotates
  return _apiKey;
}

export async function getClient(): Promise<Anthropic> {
  if (!_client) {
    _client = new Anthropic({ apiKey: await getApiKey() });
  }
  return _client;
}

export const MODEL = 'claude-opus-4-8' as const;

// Wraps a system prompt with cache_control for prompt caching
export function cachedSystem(text: string): Anthropic.Messages.TextBlockParam & { cache_control: { type: 'ephemeral' } } {
  return { type: 'text', text, cache_control: { type: 'ephemeral' } };
}
