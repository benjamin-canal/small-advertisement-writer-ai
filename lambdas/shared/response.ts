import type { ApiResponse } from './types.js';

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
};

export function ok<T>(data: T): { statusCode: number; body: string; headers: Record<string, string> } {
  const response: ApiResponse<T> = { success: true, data };
  return {
    statusCode: 200,
    headers: SECURITY_HEADERS,
    body: JSON.stringify(response),
  };
}

export function err(
  message: string,
  statusCode = 500
): { statusCode: number; body: string; headers: Record<string, string> } {
  const clientMessage = statusCode >= 500 ? 'Internal server error' : message;
  const response: ApiResponse<never> = { success: false, error: clientMessage };
  return {
    statusCode,
    headers: SECURITY_HEADERS,
    body: JSON.stringify(response),
  };
}
