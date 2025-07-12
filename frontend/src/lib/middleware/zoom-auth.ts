import { NextRequest, NextResponse } from 'next/server';

export function validateZoomApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization');
  const expectedKey = process.env.ZOOM_API_KEY;
  
  if (!apiKey || !expectedKey) {
    return false;
  }
  
  // Remove 'Bearer ' prefix if present
  const cleanKey = apiKey.replace('Bearer ', '');
  
  return cleanKey === expectedKey;
}

export function withZoomAuth(handler: Function) {
  return async (request: NextRequest, ...args: any[]) => {
    if (!validateZoomApiKey(request)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API Key' },
        { status: 401 }
      );
    }
    
    return handler(request, ...args);
  };
}