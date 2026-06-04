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

export function inferenceConfig(maxTokens: number): InferenceConfiguration {
  return { maxTokens };
}
