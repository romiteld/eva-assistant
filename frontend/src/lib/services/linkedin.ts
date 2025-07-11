import { getTokenManager } from '@/lib/auth/token-manager';
import { getLinkedInProfile, searchLinkedInConnections, sendLinkedInMessage, shareOnLinkedIn } from '@/lib/auth/linkedin-oauth';

// LinkedIn API Service
export class LinkedInService {
  private tokenManager: ReturnType<typeof getTokenManager>;
  private userId: string;

  constructor(userId: string, tokenManager: ReturnType<typeof getTokenManager>) {
    this.userId = userId;
    this.tokenManager = tokenManager;
  }

  // Get valid access token
  private async getAccessToken(): Promise<string> {
    const token = await this.tokenManager.getValidToken(this.userId, 'linkedin');
    if (!token) {
      throw new Error('No valid LinkedIn token found');
    }
    return token.accessToken;
  }

  // Get user profile
  async getProfile() {
    const accessToken = await this.getAccessToken();
    return getLinkedInProfile(accessToken);
  }

  // Search connections with pagination
  async searchConnections(params: {
    query?: string;
    start?: number;
    count?: number;
  } = {}) {
    const accessToken = await this.getAccessToken();
    return searchLinkedInConnections(
      accessToken,
      params.query,
      params.start || 0,
      params.count || 10
    );
  }

  // Send message to connection
  async sendMessage(recipientId: string, subject: string, body: string) {
    const accessToken = await this.getAccessToken();
    return sendLinkedInMessage(accessToken, recipientId, subject, body);
  }

  // Share content
  async shareContent(content: {
    text: string;
    url?: string;
    title?: string;
    description?: string;
  }) {
    const accessToken = await this.getAccessToken();
    return shareOnLinkedIn(accessToken, content);
  }

  // Get company information
  async getCompanyInfo(companyId: string) {
    const accessToken = await this.getAccessToken();
    
    try {
      const response = await fetch(`https://api.linkedin.com/v2/organizations/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch company information');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching company info:', error);
      throw error;
    }
  }

  // Search for people
  async searchPeople(params: {
    keywords?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    title?: string;
    start?: number;
    count?: number;
  }) {
    const accessToken = await this.getAccessToken();
    
    try {
      const searchParams = new URLSearchParams({
        q: 'people',
        start: (params.start || 0).toString(),
        count: (params.count || 10).toString()
      });

      if (params.keywords) searchParams.append('keywords', params.keywords);
      if (params.firstName) searchParams.append('firstName', params.firstName);
      if (params.lastName) searchParams.append('lastName', params.lastName);
      if (params.company) searchParams.append('company', params.company);
      if (params.title) searchParams.append('title', params.title);

      const response = await fetch(`https://api.linkedin.com/v2/people?${searchParams}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to search people');
      }

      return await response.json();
    } catch (error) {
      console.error('Error searching people:', error);
      throw error;
    }
  }

  // Get profile by public identifier (vanity name)
  async getProfileByPublicIdentifier(publicIdentifier: string) {
    const accessToken = await this.getAccessToken();
    
    try {
      const response = await fetch(
        `https://api.linkedin.com/v2/people/(vanityName:${publicIdentifier})`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch profile by public identifier');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching profile by public identifier:', error);
      throw error;
    }
  }

  // Get posts from user's feed
  async getFeedPosts(start: number = 0, count: number = 10) {
    const accessToken = await this.getAccessToken();
    
    try {
      const params = new URLSearchParams({
        q: 'feed',
        start: start.toString(),
        count: count.toString()
      });

      const response = await fetch(`https://api.linkedin.com/v2/ugcPosts?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch feed posts');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching feed posts:', error);
      throw error;
    }
  }

  // Like a post
  async likePost(postId: string) {
    const accessToken = await this.getAccessToken();
    
    try {
      const profile = await this.getProfile();
      const actorUrn = `urn:li:person:${profile.id}`;

      const response = await fetch('https://api.linkedin.com/v2/socialActions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        },
        body: JSON.stringify({
          actor: actorUrn,
          object: postId,
          liked: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to like post');
      }

      return await response.json();
    } catch (error) {
      console.error('Error liking post:', error);
      throw error;
    }
  }

  // Comment on a post
  async commentOnPost(postId: string, text: string) {
    const accessToken = await this.getAccessToken();
    
    try {
      const profile = await this.getProfile();
      const actorUrn = `urn:li:person:${profile.id}`;

      const response = await fetch('https://api.linkedin.com/v2/socialActions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        },
        body: JSON.stringify({
          actor: actorUrn,
          object: postId,
          comment: {
            text: text
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to comment on post');
      }

      return await response.json();
    } catch (error) {
      console.error('Error commenting on post:', error);
      throw error;
    }
  }
}

// Factory function to create LinkedIn service instance
export function createLinkedInService(
  userId: string,
  encryptionKey: string,
  refreshConfigs: Parameters<typeof getTokenManager>[1]
): LinkedInService {
  const tokenManager = getTokenManager(encryptionKey, refreshConfigs);
  return new LinkedInService(userId, tokenManager);
}