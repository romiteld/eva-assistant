import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has Zoom credentials
    const { data: credentials, error: credentialsError } = await supabase
      .from('oauth_credentials')
      .select('provider, expires_at, scopes, metadata')
      .eq('user_id', user.id)
      .eq('provider', 'zoom')
      .single();

    if (credentialsError || !credentials) {
      return NextResponse.json({
        connected: false,
        provider: 'zoom',
        message: 'Zoom account not connected'
      });
    }

    // Check if token is expired
    const expiresAt = new Date(credentials.expires_at);
    const now = new Date();
    const isExpired = expiresAt <= now;

    return NextResponse.json({
      connected: !isExpired,
      provider: 'zoom',
      expires_at: credentials.expires_at,
      scopes: credentials.scopes || [],
      user_info: credentials.metadata?.user_info || {},
      message: isExpired ? 'Zoom token expired. Please reconnect.' : 'Connected to Zoom'
    });

  } catch (error) {
    console.error('Error checking Zoom auth status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}