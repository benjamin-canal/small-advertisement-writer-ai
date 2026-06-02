// Mirror of small-advertisement-writer/src/types/index.ts

export interface AnalyzeRequest {
  s3Key: string;
  requestId: string;
}

export interface AnalyzeResponse {
  object: string;
  category: string;
  condition: string;
  confidence: number;
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
