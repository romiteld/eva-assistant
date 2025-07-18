// LinkedIn OAuth with PKCE implementation
import { supabase } from '@/lib/supabase/browser';

// PKCE helper functions (reuse from Microsoft OAuth)
function base64URLEncode(str: ArrayBuffer) {
  return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(str))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function sha256(plain: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return base64URLEncode(array.buffer);
}

async function generateCodeChallenge(codeVerifier: string) {
  const hashed = await sha256(codeVerifier);
  return base64URLEncode(hashed);
}

export async function signInWithLinkedInPKCE() {
  // Generate PKCE values
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  
  // LinkedIn OAuth configuration
  const clientId = process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID!;
  const redirectUri = `${window.location.origin}/auth/linkedin/callback`;
  const scope = 'r_liteprofile r_emailaddress w_member_social r_organization_social';
  
  // Create state parameter
  const state = {
    redirectTo: `${window.location.origin}/dashboard`,
    provider: 'linkedin',
    timestamp: Date.now(),
    codeVerifier: codeVerifier
  };
  
  const encodedState = btoa(JSON.stringify(state));
  
  // Store in sessionStorage for client-side callback
  sessionStorage.setItem('linkedin_pkce_code_verifier', codeVerifier);
  sessionStorage.setItem('linkedin_oauth_state', encodedState);
  
  // Construct the OAuth URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state: encodedState,
    scope: scope,
    // LinkedIn doesn't support PKCE yet, but we prepare for it
    // code_challenge: codeChallenge,
    // code_challenge_method: 'S256',
  });
  
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  
  // Redirect to LinkedIn login
  window.location.href = authUrl;
}

// Handle the OAuth callback
export async function handleLinkedInCallback(code: string, state: string) {
  const savedState = sessionStorage.getItem('linkedin_oauth_state');
  
  if (state !== savedState) {
    throw new Error('State mismatch - possible CSRF attack');
  }
  
  // Parse state to get redirect URL
  const decodedState = JSON.parse(atob(state));
  const redirectTo = decodedState.redirectTo || '/dashboard';
  
  // Clean up session storage
  sessionStorage.removeItem('linkedin_pkce_code_verifier');
  sessionStorage.removeItem('linkedin_oauth_state');
  
  // Return the code and redirect URL for server-side token exchange
  return {
    code,
    redirectTo,
    state: decodedState
  };
}

// Get LinkedIn profile data
export async function getLinkedInProfile(accessToken: string) {
  try {
    // Get basic profile info
    const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to fetch LinkedIn profile');
    }

    const profile = await profileResponse.json();

    // Get email address
    const emailResponse = await fetch('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    let email = null;
    if (emailResponse.ok) {
      const emailData = await emailResponse.json();
      email = emailData.elements?.[0]?.['handle~']?.emailAddress;
    }

    // Get profile picture
    const pictureResponse = await fetch('https://api.linkedin.com/v2/me?projection=(profilePicture(displayImage~:playableStreams))', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    let profilePicture = null;
    if (pictureResponse.ok) {
      const pictureData = await pictureResponse.json();
      const images = pictureData.profilePicture?.['displayImage~']?.elements;
      if (images && images.length > 0) {
        // Get the largest image
        profilePicture = images[images.length - 1]?.identifiers?.[0]?.identifier;
      }
    }

    return {
      id: profile.id,
      firstName: profile.localizedFirstName,
      lastName: profile.localizedLastName,
      email: email,
      profilePicture: profilePicture,
      profileUrl: `https://www.linkedin.com/in/${profile.vanityName || profile.id}`,
      raw: profile
    };
  } catch (error) {
    console.error('Error fetching LinkedIn profile:', error);
    throw error;
  }
}

// Search for LinkedIn connections
export async function searchLinkedInConnections(
  accessToken: string,
  query?: string,
  start: number = 0,
  count: number = 10
) {
  try {
    const params = new URLSearchParams({
      q: 'connections',
      start: start.toString(),
      count: count.toString()
    });

    if (query) {
      params.append('keywords', query);
    }

    const response = await fetch(`https://api.linkedin.com/v2/connections?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch connections');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching LinkedIn connections:', error);
    throw error;
  }
}

// Send LinkedIn message
export async function sendLinkedInMessage(
  accessToken: string,
  recipientId: string,
  subject: string,
  body: string
) {
  try {
    const message = {
      recipients: [recipientId],
      subject: subject,
      body: body,
      messageType: 'MEMBER_TO_MEMBER'
    };

    const response = await fetch('https://api.linkedin.com/v2/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error('Failed to send LinkedIn message');
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending LinkedIn message:', error);
    throw error;
  }
}

// Share content on LinkedIn
export async function shareOnLinkedIn(
  accessToken: string,
  content: {
    text: string;
    url?: string;
    title?: string;
    description?: string;
  }
) {
  try {
    // First, get the user's person URN
    const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to fetch profile for sharing');
    }

    const profile = await profileResponse.json();
    const authorUrn = `urn:li:person:${profile.id}`;

    // Prepare the share content
    const shareContent: any = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content.text
          },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    // Add article content if URL is provided
    if (content.url) {
      shareContent.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'ARTICLE';
      shareContent.specificContent['com.linkedin.ugc.ShareContent'].media = [{
        status: 'READY',
        originalUrl: content.url,
        title: {
          text: content.title || ''
        },
        description: {
          text: content.description || ''
        }
      }];
    }

    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify(shareContent)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to share on LinkedIn: ${error}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sharing on LinkedIn:', error);
    throw error;
  }
}