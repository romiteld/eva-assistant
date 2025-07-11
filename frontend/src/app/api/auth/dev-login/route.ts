import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const supabase = createClient();
    
    // Get the first available user from the database
    const { data: users, error: listError } = await supabase
      .from('profiles')
      .select('id, email')
      .limit(1);
    
    if (listError || !users || users.length === 0) {
      // If no profiles, try auth.users directly via RPC
      const { data: authUser, error: authError } = await supabase.rpc('get_first_user');
      
      if (authError || !authUser) {
        return NextResponse.json({ 
          error: 'No users found in database. Please create a user first.' 
        }, { status: 400 });
      }
    }
    
    // For development, we'll just redirect to dashboard
    // In a real scenario, you'd properly authenticate
    const response = NextResponse.json({ 
      success: true,
      redirectUrl: '/dashboard',
      message: 'Development mode - authentication bypassed'
    });
    
    // Set a development flag cookie
    response.cookies.set('dev-mode', 'true', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 // 24 hours
    });
    
    return response;
  } catch (error) {
    console.error('Dev login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}