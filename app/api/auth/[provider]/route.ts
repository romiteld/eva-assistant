import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const provider = params.provider;
  
  // Create Supabase client
  const supabase = createRouteHandlerClient({ cookies });
  
  // Check if user is authenticated
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Generate state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');
  
  // Store state in session (you might want to use a more persistent storage)
  // For now, we'll pass it through the OAuth flow
  
  let authUrl: string;
  
  switch (provider) {
    case 'microsoft': {
      const params = new URLSearchParams({
        client_id: process.env.ENTRA_CLIENT_ID!,
        response_type: 'code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/microsoft/callback`,
        response_mode: 'query',
        scope: 'User.Read Mail.Read Calendar.ReadWrite Files.ReadWrite offline_access',
        state
      });
      
      authUrl = `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/oauth2/v2.0/authorize?${params}`;
      break;
    }
    
    case 'linkedin': {
      const params = new URLSearchParams({
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        response_type: 'code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`,
        scope: 'r_liteprofile r_emailaddress w_member_social',
        state
      });
      
      authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params}`;
      break;
    }
    
    case 'zoom': {
      const params = new URLSearchParams({
        client_id: process.env.ZOOM_CLIENT_ID!,
        response_type: 'code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/zoom/callback`,
        state
      });
      
      authUrl = `https://zoom.us/oauth/authorize?${params}`;
      break;
    }
    
    case 'zoho': {
      const params = new URLSearchParams({
        client_id: process.env.ZOHO_CLIENT_ID!,
        response_type: 'code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/zoho/callback`,
        scope: 'ZohoCRM.modules.ALL,ZohoCRM.settings.ALL,ZohoCRM.users.ALL',
        access_type: 'offline',
        prompt: 'consent',
        state
      });
      
      authUrl = `https://accounts.zoho.com/oauth/v2/auth?${params}`;
      break;
    }
    
    case 'google': {
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        response_type: 'code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
        scope: 'profile email https://www.googleapis.com/auth/drive.file',
        access_type: 'offline',
        prompt: 'consent',
        state
      });
      
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
      break;
    }
    
    case 'salesforce': {
      const params = new URLSearchParams({
        client_id: process.env.SALESFORCE_CLIENT_ID!,
        response_type: 'code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/salesforce/callback`,
        state
      });
      
      authUrl = `${process.env.SALESFORCE_AUTH_URL}/services/oauth2/authorize?${params}`;
      break;
    }
    
    default:
      return NextResponse.json(
        { error: 'Unsupported provider' },
        { status: 400 }
      );
  }
  
  // Redirect to OAuth provider
  return NextResponse.redirect(authUrl);
}