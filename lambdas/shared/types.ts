// Mirror of small-advertisement-writer/src/types/index.ts

/** Role of an uploaded image — the item itself, or its care/size label. */
export type AnalyzeImageRole = 'item' | 'label';

export interface AnalyzeImageRef {
  s3Key: string;
  /** Defaults to "item" when omitted. */
  role?: AnalyzeImageRole;
}

export interface AnalyzeRequest {
  /**
   * One or more images to analyse. The label image (when present) feeds OCR
   * for size/material. Legacy single-image callers may send `s3Key` instead.
   */
  images?: AnalyzeImageRef[];
  /** Legacy single-image field — equivalent to `images: [{ s3Key, role: 'item' }]`. */
  s3Key?: string;
  requestId: string;
}

/**
 * A single guessed attribute with the model's confidence and ranked
 * alternatives. The frontend highlights fields whose `confidence` falls
 * below its threshold so the user can pick an alternative or correct it.
 */
export interface AttributeGuess {
  /** Best guess, or null when the attribute can't be determined. */
  value: string | null;
  /** 0.0–1.0 certainty for `value`. */
  confidence: number;
  /** Other plausible values, ranked, excluding `value`. */
  alternatives: string[];
}

export interface AnalyzeResponse {
  brand: AttributeGuess;
  /** Model or specific type, e.g. "Air Max 90", "501". */
  model: AttributeGuess;
  /** Category/type, English, singular, lowercase, e.g. "sneakers". */
  type: AttributeGuess;
  /** Size, ideally read off the label (e.g. "42", "M", "W30 L32"). */
  size: AttributeGuess;
  color: AttributeGuess;
  material: AttributeGuess;
  /** men | women | kids | unisex */
  gender: AttributeGuess;
  /** new | like_new | good | fair | poor */
  condition: AttributeGuess;
  keywords: string[];
  /** Aggregate certainty across the key attributes. */
  overallConfidence: number;
}

export interface EstimateRequest {
  object: string;
  condition: string;
  category: string;
}

export interface EstimatePriceResponse {
  min: number;
  max: number;
  suggested: number;
  currency: string;
}

export interface GenerateRequest {
  object: string;
  condition: string;
  category: string;
  platform: 'VINTED' | 'LEBONCOIN';
  priceRange: { min: number; max: number; suggested: number };
}

export interface GeneratedListing {
  title: string;
  description: string;
  keywords: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
