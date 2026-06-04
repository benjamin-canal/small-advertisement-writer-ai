import Anthropic from '@anthropic-ai/sdk';

// The AWS Parameters and Secrets Lambda Extension handles caching and refresh.
// It exposes a local HTTP server; the Lambda IAM role provides access to Secrets Manager.
const EXTENSION_PORT = process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT ?? '2773';
const SECRET_ARN = process.env.ANTHROPIC_SECRET_ARN!;

async function getApiKey(): Promise<string> {
  const url = `http://localhost:${EXTENSION_PORT}/secretsmanager/get?secretId=${encodeURIComponent(SECRET_ARN)}`;
  const res = await fetch(url, {
    headers: { 'X-Aws-Parameters-Secrets-Token': process.env.AWS_SESSION_TOKEN! },
  });
  if (!res.ok) throw new Error(`Secrets extension error: ${res.status}`);
  const body = await res.json() as { SecretString: string };
  return body.SecretString;
}

// Client is re-created only when the key changes (extension handles cache TTL)
let _client: Anthropic | null = null;
let _cachedKey: string | null = null;

export async function getClient(): Promise<Anthropic> {
  const key = await getApiKey();
  if (!_client || key !== _cachedKey) {
    _client = new Anthropic({ apiKey: key });
    _cachedKey = key;
  }
  return _client;
}

export const MODEL = 'claude-opus-4-8' as const;

// Wraps a system prompt with cache_control for prompt caching
export function cachedSystem(text: string): Anthropic.Messages.TextBlockParam & { cache_control: { type: 'ephemeral' } } {
  return { type: 'text', text, cache_control: { type: 'ephemeral' } };
}
