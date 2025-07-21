import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Test endpoint to verify Zoom OAuth environment variables
  const envVars = {
    ZOOM_CLIENT_ID: {
      exists: !!process.env.ZOOM_CLIENT_ID,
      length: process.env.ZOOM_CLIENT_ID?.length || 0,
      prefix: process.env.ZOOM_CLIENT_ID?.substring(0, 10) || 'not set'
    },
    ZOOM_CLIENT_SECRET: {
      exists: !!process.env.ZOOM_CLIENT_SECRET,
      length: process.env.ZOOM_CLIENT_SECRET?.length || 0,
      masked: process.env.ZOOM_CLIENT_SECRET ? '***' : 'not set'
    },
    ZOOM_REDIRECT_URI: {
      exists: !!process.env.ZOOM_REDIRECT_URI,
      value: process.env.ZOOM_REDIRECT_URI || 'not set'
    },
    NEXT_PUBLIC_ZOOM_CLIENT_ID: {
      exists: !!process.env.NEXT_PUBLIC_ZOOM_CLIENT_ID,
      length: process.env.NEXT_PUBLIC_ZOOM_CLIENT_ID?.length || 0,
      prefix: process.env.NEXT_PUBLIC_ZOOM_CLIENT_ID?.substring(0, 10) || 'not set'
    },
    NEXT_PUBLIC_APP_URL: {
      exists: !!process.env.NEXT_PUBLIC_APP_URL,
      value: process.env.NEXT_PUBLIC_APP_URL || 'not set'
    }
  };

  return NextResponse.json({
    message: 'Zoom OAuth environment variable check',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    variables: envVars
  });
}