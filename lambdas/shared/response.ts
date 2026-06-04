import type { ApiResponse } from './types.js';

export function ok<T>(data: T): { statusCode: number; body: string; headers: Record<string, string> } {
  const response: ApiResponse<T> = { success: true, data };
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(response),
  };
}
