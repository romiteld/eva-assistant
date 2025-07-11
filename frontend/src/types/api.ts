import { NextRequest } from 'next/server';

// Common API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
  statusCode?: number;
}

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedApiResponse<T> extends ApiSuccessResponse<PaginatedResponse<T>> {}

// Request handler types
export type ApiHandler = (request: NextRequest) => Promise<Response>;

// Common error responses
export const createErrorResponse = (
  error: string,
  statusCode: number = 500,
  message?: string
): Response => {
  return new Response(
    JSON.stringify({
      success: false,
      error,
      message,
      statusCode
    } as ApiErrorResponse),
    {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' }
    }
  );
};

export const createSuccessResponse = <T>(
  data: T,
  message?: string,
  statusCode: number = 200
): Response => {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      message
    } as ApiSuccessResponse<T>),
    {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' }
    }
  );
};