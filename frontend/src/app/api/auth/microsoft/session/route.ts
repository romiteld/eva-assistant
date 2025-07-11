import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { userData, redirectTo } = await request.json();
    
    if (!userData?.email) {
      return NextResponse.json({ error: 'No user data provided' }, { status: 400 });
    }

    const supabase = createClient();
    
    // Use our custom function to handle Microsoft OAuth
    const { data, error } = await supabase.rpc('handle_microsoft_oauth_signin', {
      p_email: userData.email,
      p_microsoft_id: userData.microsoftId,
      p_full_name: userData.name,
    });

    if (error) {
      console.error('Error handling Microsoft OAuth:', error);
      return NextResponse.json({ 
        error: 'Failed to process Microsoft authentication',
        details: error.message 
      }, { status: 400 });
    }

    if (!data.success) {
      // User doesn't exist or there was an error
      console.log('Microsoft OAuth result:', data);
      
      // Generate a session token for the welcome flow
      const sessionToken = btoa(JSON.stringify({
        email: userData.email,
        microsoft_id: userData.microsoftId,
        full_name: userData.name,
        authenticated: true,
        timestamp: Date.now(),
        existing_user: false,
      }));

      return NextResponse.json({
        success: true,
        sessionToken,
        existingUser: false,
        message: data.message,
        redirectUrl: `/auth/microsoft/welcome?session=${sessionToken}&redirect=${encodeURIComponent(redirectTo)}`,
      });
    }

    // User exists and was updated successfully
    // Generate a session token
    const sessionToken = btoa(JSON.stringify({
      email: userData.email,
      microsoft_id: userData.microsoftId,
      full_name: userData.name,
      authenticated: true,
      timestamp: Date.now(),
      existing_user: true,
      user_id: data.user_id,
    }));

    // For existing users, we need them to sign in with their password
    // since we can't create a session without proper authentication
    return NextResponse.json({
      success: true,
      sessionToken,
      existingUser: true,
      message: 'Please sign in with your existing password to link your Microsoft account',
      redirectUrl: `/auth/microsoft/link?session=${sessionToken}&redirect=${encodeURIComponent(redirectTo)}`,
    });
    
  } catch (error) {
    console.error('Error in session creation:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}