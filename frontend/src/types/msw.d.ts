// Re-export MSW types
export * from 'msw'

// Additional type augmentations if needed
declare module 'msw' {
  interface PathParams {
    [key: string]: string | string[]
  }
}

// Additional type helpers for MSW handlers
export type MockedRequest<T = any> = StrictRequest<T>
export type MockedResponse = typeof MSWHttpResponse

// Type for API response bodies
export interface ApiResponse<T = any> {
  success?: boolean
  data?: T
  error?: string
  message?: string
}

// Common response factories
export const mockSuccessResponse = <T>(data: T) => 
  MSWHttpResponse.json({ success: true, data })

export const mockErrorResponse = (error: string, status = 400) =>
  MSWHttpResponse.json({ success: false, error }, { status })

// Type guards
export function isApiError(response: any): response is { error: string } {
  return response && typeof response.error === 'string'
}

export function isApiSuccess<T>(response: any): response is { success: true; data: T } {
  return response && response.success === true && 'data' in response
}