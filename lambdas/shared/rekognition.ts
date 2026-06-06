import {
  RekognitionClient,
  DetectLabelsCommand,
  type Label,
} from '@aws-sdk/client-rekognition';

const client = new RekognitionClient({ region: process.env.AWS_REGION ?? 'eu-west-1' });

export interface DetectedObject {
  object: string;
  category: string;
  confidence: number;
}

type NamedLabel = Label & { Name: string; Confidence: number };

// Runs object detection on raw image bytes and returns the most likely object,
// its broader category and the detection confidence (0-1). Returns null when no
// label clears the confidence threshold.
export async function detectObject(imageBytes: Uint8Array): Promise<DetectedObject | null> {
  const res = await client.send(new DetectLabelsCommand({
    Image: { Bytes: imageBytes },
    MaxLabels: 10,
    MinConfidence: 55,
  }));

  const labels = (res.Labels ?? [])
    .filter((l): l is NamedLabel => typeof l.Name === 'string' && typeof l.Confidence === 'number')
    .sort((a, b) => b.Confidence - a.Confidence);

  if (labels.length === 0) {
    return null;
  }
  const top = labels[0];

  // Category: prefer Rekognition's taxonomy category, then the broadest parent,
  // then fall back to the label itself.
  const parents = top.Parents ?? [];
  const category =
    top.Categories?.[0]?.Name ??
    parents[parents.length - 1]?.Name ??
    top.Name;

  return {
    object: top.Name.toLowerCase(),
    category: category.toLowerCase(),
    confidence: Math.round((top.Confidence / 100) * 100) / 100,
  };
}
