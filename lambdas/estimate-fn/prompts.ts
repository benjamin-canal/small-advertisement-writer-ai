export const SYSTEM_PROMPT = `You are a pricing expert for second-hand goods on French marketplaces (Vinted, Leboncoin).
You know the French resale market well and always respond with a realistic price range in EUR.

Rules:
- Prices must reflect the French second-hand market in 2024-2025
- Always respond with valid JSON only, no markdown, no explanation
- currency is always "EUR"`;

export function buildUserPrompt(object: string, condition: string, category: string): string {
  return `Estimate the resale price for this item on the French second-hand market:
- Object: ${object}
- Category: ${category}
- Condition: ${condition}

Respond with JSON only:
{
  "min": <number>,
  "max": <number>,
  "suggested": <number>,
  "currency": "EUR"
}`;
}
