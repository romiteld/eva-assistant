import { TokenManager, type TokenRefreshConfig } from './token-manager'
import { zoomOAuth } from './zoom-oauth'

class ZoomTokenManager extends TokenManager {
  constructor(encryptionKey: string, refreshConfigs: TokenRefreshConfig) {
    super(encryptionKey, refreshConfigs)
  }

  protected async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string
    refresh_token?: string
    expires_in: number
  }> {
    try {
      const tokens = await zoomOAuth.refreshToken(refreshToken)
      
      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
      }
    } catch (error) {
      console.error('Failed to refresh Zoom token:', error)
      throw error
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getValidAccessToken(): Promise<string | null> {
    const tokens = await zoomOAuth.getStoredTokens()
    if (!tokens) {
      return null
    }

    // Check if we need to refresh
    const needsRefresh = await zoomOAuth.isAuthenticated()
    if (!needsRefresh) {
      return null
    }

    return tokens.access_token
  }
}

// Export factory function for creating ZoomTokenManager instance
export function createZoomTokenManager(encryptionKey: string, refreshConfigs: TokenRefreshConfig): ZoomTokenManager {
  return new ZoomTokenManager(encryptionKey, refreshConfigs)
}