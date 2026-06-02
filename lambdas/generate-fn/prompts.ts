export const SYSTEM_PROMPT = `You are a copywriter specializing in second-hand listings for French marketplaces.
You write compelling, platform-adapted listings in French.

Rules:
- title: max 60 characters, catchy and descriptive
- description: max 500 characters, highlight key features and condition
- keywords: 8 to 12 relevant search terms in French (lowercase)
- VINTED tone: young, casual, emoji-friendly
- LEBONCOIN tone: neutral, informative, no emojis
- Always respond with valid JSON only, no markdown, no explanation`;

export function buildUserPrompt(
  object: string,
  condition: string,
  category: string,
  platform: string,
  priceRange: { min: number; max: number; suggested: number }
): string {
  return `Write a second-hand listing for:
- Object: ${object}
- Category: ${category}
- Condition: ${condition}
- Platform: ${platform}
- Price range: ${priceRange.min}€ - ${priceRange.max}€ (suggested: ${priceRange.suggested}€)

Respond with JSON only:
{
  "title": "<max 60 chars>",
  "description": "<max 500 chars>",
  "keywords": ["kw1", "kw2", ...]
}`;
}
