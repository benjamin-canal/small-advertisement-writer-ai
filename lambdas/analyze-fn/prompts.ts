export const SYSTEM_PROMPT = `You are an expert at assessing the physical condition of second-hand objects from photos.
The object has already been identified by a dedicated detection model; your only task is to judge its condition.

Rules:
- condition must be one of: "new", "like_new", "good", "fair", "poor"
- Base the condition on visible wear, scratches, stains, packaging or damage in the photo
- Always respond with valid JSON only, no markdown, no explanation`;

// The detected object name is injected to ground the condition assessment.
export function buildUserPrompt(object: string): string {
  return `The detected object is "${object}". Assess its condition from the photo and respond with JSON only:
{
  "condition": "<new|like_new|good|fair|poor>"
}`;
}
