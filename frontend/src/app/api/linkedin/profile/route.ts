import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createLinkedInService } from '@/lib/services/linkedin';
import { getTokenManager } from '@/lib/auth/token-manager';

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // Get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create LinkedIn service
    const linkedInService = createLinkedInService(
      user.id,
      process.env.OAUTH_ENCRYPTION_KEY!,
      {
        linkedin: {
          tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
          clientId: process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID!,
          clientSecret: process.env.LINKEDIN_CLIENT_SECRET!
        },
        // Add other providers as needed
        microsoft: {
          tokenUrl: 'https://login.microsoftonline.com/29ee1479-b5f7-48c5-b665-7de9a8a9033e/oauth2/v2.0/token',
          clientId: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || '',
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
          tenantId: process.env.MICROSOFT_TENANT_ID || 'common'
        },
        google: {
          tokenUrl: 'https://oauth2.googleapis.com/token',
          clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET || ''
        },
        zoom: {
          tokenUrl: 'https://zoom.us/oauth/token',
          clientId: process.env.ZOOM_CLIENT_ID || '',
          clientSecret: process.env.ZOOM_CLIENT_SECRET || '',
          accountId: process.env.ZOOM_ACCOUNT_ID || ''
        },
        salesforce: {
          tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
          clientId: process.env.SALESFORCE_CLIENT_ID || '',
          clientSecret: process.env.SALESFORCE_CLIENT_SECRET || ''
        },
        zoho: {
          tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
          clientId: process.env.ZOHO_CLIENT_ID || '',
          clientSecret: process.env.ZOHO_CLIENT_SECRET || ''
        }
      }
    );

    // Get LinkedIn profile
    const profile = await linkedInService.getProfile();

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Error fetching LinkedIn profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LinkedIn profile' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // Get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...params } = body;

    // Create LinkedIn service
    const linkedInService = createLinkedInService(
      user.id,
      process.env.OAUTH_ENCRYPTION_KEY!,
      {
        linkedin: {
          tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
          clientId: process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID!,
          clientSecret: process.env.LINKEDIN_CLIENT_SECRET!
        },
        // Add other providers as needed
        microsoft: {
          tokenUrl: 'https://login.microsoftonline.com/29ee1479-b5f7-48c5-b665-7de9a8a9033e/oauth2/v2.0/token',
          clientId: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || '',
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
          tenantId: process.env.MICROSOFT_TENANT_ID || 'common'
        },
        google: {
          tokenUrl: 'https://oauth2.googleapis.com/token',
          clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET || ''
        },
        zoom: {
          tokenUrl: 'https://zoom.us/oauth/token',
          clientId: process.env.ZOOM_CLIENT_ID || '',
          clientSecret: process.env.ZOOM_CLIENT_SECRET || '',
          accountId: process.env.ZOOM_ACCOUNT_ID || ''
        },
        salesforce: {
          tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
          clientId: process.env.SALESFORCE_CLIENT_ID || '',
          clientSecret: process.env.SALESFORCE_CLIENT_SECRET || ''
        },
        zoho: {
          tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
          clientId: process.env.ZOHO_CLIENT_ID || '',
          clientSecret: process.env.ZOHO_CLIENT_SECRET || ''
        }
      }
    );

    let result;

    switch (action) {
      case 'searchConnections':
        result = await linkedInService.searchConnections(params);
        break;
      case 'sendMessage':
        result = await linkedInService.sendMessage(
          params.recipientId,
          params.subject,
          params.body
        );
        break;
      case 'shareContent':
        result = await linkedInService.shareContent(params.content);
        break;
      case 'searchPeople':
        result = await linkedInService.searchPeople(params);
        break;
      case 'getCompanyInfo':
        result = await linkedInService.getCompanyInfo(params.companyId);
        break;
      case 'getFeedPosts':
        result = await linkedInService.getFeedPosts(params.start, params.count);
        break;
      case 'likePost':
        result = await linkedInService.likePost(params.postId);
        break;
      case 'commentOnPost':
        result = await linkedInService.commentOnPost(params.postId, params.text);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error('LinkedIn API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'LinkedIn API request failed' },
      { status: 500 }
    );
  }
}