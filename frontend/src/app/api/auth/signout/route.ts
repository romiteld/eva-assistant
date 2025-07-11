import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    
    return NextResponse.redirect(new URL('/login', request.url));
  } catch (error) {
    console.error('Sign out error:', error);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    
    // For NextAuth signout, we need to clear the session and redirect
    const response = NextResponse.redirect(new URL('/login', request.url));
    
    // Clear NextAuth cookies
    response.cookies.delete('next-auth.csrf-token');
    response.cookies.delete('next-auth.callback-url');
    response.cookies.delete('next-auth.session-token');
    
    return response;
  } catch (error) {
    console.error('Sign out error:', error);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
