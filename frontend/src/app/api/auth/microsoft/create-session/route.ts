import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { sessionToken } = await request.json();
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'No session token provided' }, { status: 400 });
    }

    // Decode and validate the session token
    let sessionData;
    try {
      sessionData = JSON.parse(atob(sessionToken));
    } catch (error) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 400 });
    }

    // Validate session token age (5 minutes max)
    const tokenAge = Date.now() - sessionData.timestamp;
    if (tokenAge > 5 * 60 * 1000) {
      return NextResponse.json({ error: 'Session token expired' }, { status: 400 });
    }

    const supabase = createClient();
    
    // Try to sign in with the existing user
    const { data: { user }, error: getUserError } = await supabase.auth.getUser();
    
    if (!user) {
      // No authenticated user, need to handle this differently
      // Store the Microsoft auth data in a secure cookie
      const cookieStore = cookies();
      cookieStore.set('microsoft_auth', JSON.stringify({
        email: sessionData.email,
        full_name: sessionData.full_name,
        microsoft_id: sessionData.microsoft_id,
        authenticated: true,
      }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
      });
    }

    return NextResponse.json({
      success: true,
      email: sessionData.email,
      requiresEmailVerification: !sessionData.existing_user,
    });
    
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}