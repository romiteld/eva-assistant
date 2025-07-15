import { createClient } from '@/lib/supabase/browser'

export interface ZoomOAuthConfig {
  clientId: string
  redirectUri: string
  scopes: string[]
}

export interface ZoomTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope: string
}

export interface ZoomUserInfo {
  id: string
  email: string
  first_name: string
  last_name: string
  display_name: string
  timezone: string
  pmi: number
  verified: boolean
  type: number
  status: string
  language: string
  phone_country: string
  phone_number: string
  pic_url: string
}

export class ZoomOAuthService {
  private supabase = createClient()
  private config: ZoomOAuthConfig

  constructor(config: ZoomOAuthConfig) {
    this.config = config
  }

  /**
   * Generate authorization URL for Zoom OAuth
   */
  generateAuthUrl(): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      state: this.generateState(),
    })

    return `https://zoom.us/oauth/authorize?${params.toString()}`
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, state: string): Promise<ZoomTokens> {
    if (!this.validateState(state)) {
      throw new Error('Invalid state parameter')
    }

    const response = await fetch('/api/auth/zoom/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        redirect_uri: this.config.redirectUri,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to exchange code for token')
    }

    const tokens = await response.json()
    
    // Store tokens securely
    await this.storeTokens(tokens)
    
    return tokens
  }

  /**
   * Get user information from Zoom API
   */
  async getUserInfo(accessToken: string): Promise<ZoomUserInfo> {
    const response = await fetch('/api/zoom/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get user info')
    }

    return response.json()
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<ZoomTokens> {
    const response = await fetch('/api/auth/zoom/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to refresh token')
    }

    const tokens = await response.json()
    
    // Update stored tokens
    await this.storeTokens(tokens)
    
    return tokens
  }

  /**
   * Store tokens in database
   */
  private async storeTokens(tokens: ZoomTokens): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    const { error } = await this.supabase
      .from('oauth_tokens')
      .upsert({
        user_id: user.id,
        provider: 'zoom',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        token_type: tokens.token_type,
        scope: tokens.scope,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider'
      })

    if (error) {
      throw new Error(`Failed to store tokens: ${error.message}`)
    }
  }

  /**
   * Get stored tokens for current user
   */
  async getStoredTokens(): Promise<ZoomTokens | null> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await this.supabase
      .from('oauth_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'zoom')
      .single()

    if (error || !data) return null

    // Check if token is expired
    const expiresAt = new Date(data.expires_at)
    const now = new Date()
    
    if (expiresAt <= now) {
      // Try to refresh the token
      try {
        return await this.refreshToken(data.refresh_token)
      } catch (error) {
        console.error('Failed to refresh Zoom token:', error)
        return null
      }
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
      token_type: data.token_type,
      scope: data.scope,
    }
  }

  /**
   * Check if user has valid Zoom tokens
   */
  async isAuthenticated(): Promise<boolean> {
    const tokens = await this.getStoredTokens()
    return tokens !== null
  }

  /**
   * Revoke Zoom tokens
   */
  async revokeTokens(): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return

    const tokens = await this.getStoredTokens()
    if (!tokens) return

    try {
      // Revoke token with Zoom
      await fetch('/api/auth/zoom/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: tokens.access_token,
        }),
      })
    } catch (error) {
      console.error('Failed to revoke Zoom token:', error)
    }

    // Remove from database
    const { error } = await this.supabase
      .from('oauth_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'zoom')

    if (error) {
      throw new Error(`Failed to remove tokens: ${error.message}`)
    }
  }

  /**
   * Generate and store state parameter
   */
  private generateState(): string {
    const state = crypto.randomUUID()
    sessionStorage.setItem('zoom_oauth_state', state)
    return state
  }

  /**
   * Validate state parameter
   */
  private validateState(state: string): boolean {
    const storedState = sessionStorage.getItem('zoom_oauth_state')
    sessionStorage.removeItem('zoom_oauth_state')
    return storedState === state
  }
}

// Default configuration
export const defaultZoomConfig: ZoomOAuthConfig = {
  clientId: process.env.NEXT_PUBLIC_ZOOM_CLIENT_ID || '',
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/zoom/callback`,
  scopes: [
    'meeting:write',
    'meeting:read',
    'user:read',
    'user:write',
    'webinar:write',
    'webinar:read',
    'recording:read',
    'recording:write'
  ],
}

// Singleton instance
export const zoomOAuth = new ZoomOAuthService(defaultZoomConfig)