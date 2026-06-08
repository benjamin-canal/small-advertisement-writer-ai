import {
  BedrockRuntimeClient,
  ConverseCommand,
  type SystemContentBlock,
  type ContentBlock,
  type InferenceConfiguration,
} from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? 'eu-west-1' });

export const MODEL_ID = process.env.BEDROCK_MODEL_ID!;

export function getClient(): BedrockRuntimeClient {
  return client;
}

// Wraps a system prompt with a cache checkpoint for prompt caching on Bedrock
export function cachedSystem(text: string): SystemContentBlock[] {
  return [
    { text },
    { cachePoint: { type: 'default' } },
  ];
}

// Extracts the text from the first content block of a Converse response
export function extractText(content: ContentBlock[] | undefined): string {
  const block = content?.[0];
  return block && 'text' in block ? block.text ?? '' : '';
}

// Parses JSON out of a model text response, tolerating markdown code fences
// (```json ... ```) and surrounding prose. Throws a stable error otherwise.
export function parseModelJson<T>(text: string): T {
  const trimmed = text.trim();
  const candidates: string[] = [trimmed];

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    candidates.push(fenced[1].trim());
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) {
    candidates.push(trimmed.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // try the next candidate
    }
  }
  throw new Error('Invalid response from AI model');
}

export function inferenceConfig(maxTokens: number): InferenceConfiguration {
  return { maxTokens };
}
