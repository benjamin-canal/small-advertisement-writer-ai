import type { VisionHints } from '../shared/rekognition.js';
import { brandReferenceText } from '../shared/reference/brands.js';

export const SYSTEM_PROMPT = `You identify second-hand items from a single photo to create marketplace listings (Vinted, Leboncoin).
A computer-vision model provides hints (generic labels and any text/logos read off the item). Use them, but rely primarily on what you see in the photo.

Known brands — when the item clearly matches one, use this exact canonical spelling:
${brandReferenceText()}

Respond with valid JSON only, no markdown, no explanation:
{
  "brand": "<brand name (prefer the canonical spelling above), or null if no brand is identifiable>",
  "model": "<model or specific type, e.g. \\"Air Max 90\\", \\"501\\", \\"oversized hoodie\\">",
  "object": "<brand + model when known (e.g. \\"Nike Air Max 90\\"); otherwise a precise generic name (e.g. \\"leather ankle boots\\")>",
  "category": "<English, singular, lowercase (e.g. \\"sneakers\\", \\"jacket\\", \\"smartphone\\", \\"book\\")>",
  "condition": "<new|like_new|good|fair|poor>",
  "confidence": <number 0.0-1.0>
}

Rules:
- Use a brand only if a logo, label, detected text or distinctive design supports it. Never invent a brand. If the read brand is not in the known list, still report it.
- Judge "condition" from visible wear, scratches, stains, packaging or damage.
- "confidence" is your certainty about the identification (object + category).`;

// Injects the Rekognition hints so Claude is grounded by them.
export function buildUserPrompt(hints: VisionHints): string {
  const labels = hints.labels.length ? hints.labels.join(', ') : 'none';
  const texts = hints.texts.length ? hints.texts.map((t) => `"${t}"`).join(', ') : 'none';
  return `Vision hints — detected labels: ${labels}. Detected text/logos: ${texts}.
Identify the item in the photo and respond with JSON only.`;
}
