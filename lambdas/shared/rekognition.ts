import {
  RekognitionClient,
  DetectLabelsCommand,
  DetectTextCommand,
  type Label,
} from '@aws-sdk/client-rekognition';

const client = new RekognitionClient({ region: process.env.AWS_REGION ?? 'eu-west-1' });

export interface VisionHints {
  /** Generic object/scene labels, most confident first (e.g. "Sneaker", "Footwear"). */
  labels: string[];
  /** Text and logos read off the item — brands and models (e.g. "NIKE", "501"). */
  texts: string[];
}

type NamedLabel = Label & { Name: string; Confidence: number };

// Gathers grounding hints for the LLM: generic labels (DetectLabels) and any
// on-item text/logos (DetectText). These anchor Claude's identification and
// curb hallucinated brands, without being authoritative themselves.
export async function gatherHints(imageBytes: Uint8Array): Promise<VisionHints> {
  const [labelsRes, textRes] = await Promise.all([
    client.send(new DetectLabelsCommand({ Image: { Bytes: imageBytes }, MaxLabels: 12, MinConfidence: 55 })),
    client.send(new DetectTextCommand({ Image: { Bytes: imageBytes } })),
  ]);

  const labels = (labelsRes.Labels ?? [])
    .filter((l): l is NamedLabel => typeof l.Name === 'string' && typeof l.Confidence === 'number')
    .sort((a, b) => b.Confidence - a.Confidence)
    .map((l) => l.Name)
    .slice(0, 12);

  // LINE detections carry more meaning than individual words; keep confident,
  // deduplicated entries only.
  const texts = Array.from(
    new Set(
      (textRes.TextDetections ?? [])
        .filter((t) => t.Type === 'LINE' && typeof t.DetectedText === 'string' && (t.Confidence ?? 0) >= 80)
        .map((t) => t.DetectedText as string)
    )
  ).slice(0, 10);

  return { labels, texts };
}
