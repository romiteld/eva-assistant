import { NextRequest, NextResponse } from 'next/server';
import { generateRandomToken } from '@/lib/crypto-utils';

export async function GET(request: NextRequest) {
  // Generate a secure random token
  const token = generateRandomToken(32);
  
  // Create response with the token
  const response = NextResponse.json({ csrfToken: token });
  
  // Set the token as an httpOnly cookie
  response.cookies.set('csrf-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
  
  return response;
}