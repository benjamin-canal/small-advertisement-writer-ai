import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export const MODEL = 'claude-opus-4-8' as const;

// Wraps a system prompt with cache_control for prompt caching
export function cachedSystem(text: string): Anthropic.Messages.TextBlockParam & { cache_control: { type: 'ephemeral' } } {
  return { type: 'text', text, cache_control: { type: 'ephemeral' } };
}
