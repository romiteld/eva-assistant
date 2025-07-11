import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getTokenManager } from '@/lib/auth/token-manager';

const tokenRefreshConfigs = {
  microsoft: {
    tokenUrl: 'https://login.microsoftonline.com',
    clientId: process.env.ENTRA_CLIENT_ID!,
    clientSecret: process.env.ENTRA_CLIENT_SECRET!,
    tenantId: process.env.ENTRA_TENANT_ID!
  },
  linkedin: {
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    clientId: process.env.LINKEDIN_CLIENT_ID!,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET!
  },
  zoom: {
    tokenUrl: 'https://zoom.us/oauth/token',
    clientId: process.env.ZOOM_CLIENT_ID!,
    clientSecret: process.env.ZOOM_CLIENT_SECRET!,
    accountId: process.env.ZOOM_ACCOUNT_ID!
  },
  zoho: {
    tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
    clientId: process.env.ZOHO_CLIENT_ID!,
    clientSecret: process.env.ZOHO_CLIENT_SECRET!
  },
  google: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || ''
  },
  salesforce: {
    tokenUrl: process.env.SALESFORCE_INSTANCE_URL || '',
    clientId: process.env.SALESFORCE_CLIENT_ID || '',
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET || ''
  }
};

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const provider = params.provider;

  // Handle OAuth errors
  if (error) {
    console.error(`OAuth error for ${provider}:`, error);
    return NextResponse.redirect(
      new URL(`/settings/integrations?error=${error}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/settings/integrations?error=no_code', request.url)
    );
  }

  try {
    // Create Supabase client
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.redirect(
        new URL('/login?error=not_authenticated', request.url)
      );
    }

    // Exchange code for tokens based on provider
    let tokenResponse: any;
    
    switch (provider) {
      case 'microsoft': {
        const tokenUrl = `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/oauth2/v2.0/token`;
        const body = new URLSearchParams({
          client_id: process.env.ENTRA_CLIENT_ID!,
          client_secret: process.env.ENTRA_CLIENT_SECRET!,
          code,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/microsoft/callback`,
          grant_type: 'authorization_code',
          scope: 'User.Read Mail.Read Calendar.ReadWrite Files.ReadWrite offline_access'
        });
        
        tokenResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        });
        break;
      }
      
      case 'linkedin': {
        const body = new URLSearchParams({
          client_id: process.env.LINKEDIN_CLIENT_ID!,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
          code,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`,
          grant_type: 'authorization_code'
        });
        
        tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        });
        break;
      }
      
      case 'zoom': {
        const authHeader = Buffer.from(
          `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
        ).toString('base64');
        
        const body = new URLSearchParams({
          code,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/zoom/callback`,
          grant_type: 'authorization_code'
        });
        
        tokenResponse = await fetch('https://zoom.us/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${authHeader}`
          },
          body
        });
        break;
      }
      
      case 'zoho': {
        const body = new URLSearchParams({
          client_id: process.env.ZOHO_CLIENT_ID!,
          client_secret: process.env.ZOHO_CLIENT_SECRET!,
          code,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/zoho/callback`,
          grant_type: 'authorization_code'
        });
        
        tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        });
        break;
      }
      
      default:
        return NextResponse.redirect(
          new URL('/settings/integrations?error=invalid_provider', request.url)
        );
    }

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error(`Token exchange failed for ${provider}:`, errorData);
      return NextResponse.redirect(
        new URL('/settings/integrations?error=token_exchange_failed', request.url)
      );
    }

    const tokens = await tokenResponse.json();
    
    // Store tokens using TokenManager
    const tokenManager = getTokenManager(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      process.env.ENCRYPTION_KEY || 'default-encryption-key',
      tokenRefreshConfigs
    );

    await tokenManager.storeTokens(user.id, provider as any, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      scope: tokens.scope
    });

    // Redirect to success page
    return NextResponse.redirect(
      new URL(`/settings/integrations?success=${provider}_connected`, request.url)
    );
    
  } catch (error) {
    console.error(`OAuth callback error for ${provider}:`, error);
    return NextResponse.redirect(
      new URL('/settings/integrations?error=callback_failed', request.url)
    );
  }
}