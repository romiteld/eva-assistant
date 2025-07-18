import { MicrosoftOAuthManager } from '../microsoft-oauth'
import { TokenManager } from '../token-manager'

// Mock dependencies
jest.mock('../token-manager')

const mockTokenManager = TokenManager as jest.MockedClass<typeof TokenManager>

describe('Microsoft OAuth Integration', () => {
  let oauthManager: MicrosoftOAuthManager
  let mockTokenManagerInstance: jest.Mocked<TokenManager>

  beforeEach(() => {
    mockTokenManagerInstance = {
      getValidToken: jest.fn(),
      storeToken: jest.fn(),
      refreshToken: jest.fn(),
      revokeToken: jest.fn(),
    } as any

    mockTokenManager.mockImplementation(() => mockTokenManagerInstance)
    
    oauthManager = new MicrosoftOAuthManager()

    // Mock environment variables
    process.env.MICROSOFT_CLIENT_ID = 'test-client-id'
    process.env.MICROSOFT_TENANT_ID = 'test-tenant-id'
    process.env.NEXT_PUBLIC_REDIRECT_URI = 'http://localhost:3000/auth/microsoft/callback'

    // Mock crypto for PKCE
    global.crypto = {
      randomUUID: jest.fn().mockReturnValue('test-uuid'),
      getRandomValues: jest.fn().mockImplementation((arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256)
        }
        return arr
      }),
      subtle: {
        digest: jest.fn().mockImplementation(async (algorithm: string, data: ArrayBuffer) => {
          // Mock SHA256 hash
          return new ArrayBuffer(32)
        }),
      },
    } as any

    // Mock URL constructor
    global.URL = jest.fn().mockImplementation((url: string) => {
      const urlObj = new URL(url)
      return {
        searchParams: {
          append: jest.fn(),
          get: jest.fn(),
          set: jest.fn(),
        },
        toString: jest.fn().mockReturnValue(url),
        href: url,
        ...urlObj,
      }
    }) as any

    // Mock btoa for base64 encoding
    global.btoa = jest.fn().mockImplementation((str: string) => {
      return Buffer.from(str).toString('base64')
    })

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('OAuth Flow', () => {
    it('should generate authorization URL with PKCE parameters', async () => {
      const authUrl = await oauthManager.getAuthorizationUrl()

      expect(authUrl).toContain('https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/authorize')
      expect(authUrl).toContain('client_id=test-client-id')
      expect(authUrl).toContain('response_type=code')
      expect(authUrl).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fmicrosoft%2Fcallback')
      expect(authUrl).toContain('scope=')
      expect(authUrl).toContain('code_challenge=')
      expect(authUrl).toContain('code_challenge_method=S256')
      expect(authUrl).toContain('state=')
    })

    it('should store PKCE verifier and state in localStorage', async () => {
      await oauthManager.getAuthorizationUrl()

      expect(localStorage.setItem).toHaveBeenCalledWith('pkce_verifier', expect.any(String))
      expect(localStorage.setItem).toHaveBeenCalledWith('oauth_state', expect.any(String))
    })

    it('should handle authorization callback with valid code', async () => {
      const mockCode = 'test-auth-code'
      const mockState = 'test-state'
      const mockVerifier = 'test-verifier'

      // Mock localStorage values
      ;(localStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'oauth_state') return mockState
        if (key === 'pkce_verifier') return mockVerifier
        return null
      })

      // Mock token response
      const mockTokenResponse = {
        access_token: 'mock-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        scope: 'https://graph.microsoft.com/.default',
      }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokenResponse),
      })

      mockTokenManagerInstance.storeToken.mockResolvedValue(undefined)

      const result = await oauthManager.handleCallback(mockCode, mockState)

      expect(result.success).toBe(true)
      expect(result.tokens).toEqual(mockTokenResponse)
      expect(mockTokenManagerInstance.storeToken).toHaveBeenCalledWith(
        'microsoft',
        mockTokenResponse.access_token,
        mockTokenResponse.refresh_token,
        expect.any(Date)
      )
    })

    it('should reject callback with invalid state', async () => {
      const mockCode = 'test-auth-code'
      const mockInvalidState = 'invalid-state'
      const mockStoredState = 'stored-state'

      ;(localStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'oauth_state') return mockStoredState
        return null
      })

      const result = await oauthManager.handleCallback(mockCode, mockInvalidState)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid state parameter')
    })

    it('should handle token exchange errors', async () => {
      const mockCode = 'test-auth-code'
      const mockState = 'test-state'
      const mockVerifier = 'test-verifier'

      ;(localStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'oauth_state') return mockState
        if (key === 'pkce_verifier') return mockVerifier
        return null
      })

      // Mock failed token response
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue({
          error: 'invalid_grant',
          error_description: 'The provided authorization grant is invalid',
        }),
      })

      const result = await oauthManager.handleCallback(mockCode, mockState)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Token exchange failed')
    })

    it('should handle network errors during token exchange', async () => {
      const mockCode = 'test-auth-code'
      const mockState = 'test-state'
      const mockVerifier = 'test-verifier'

      ;(localStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'oauth_state') return mockState
        if (key === 'pkce_verifier') return mockVerifier
        return null
      })

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

      const result = await oauthManager.handleCallback(mockCode, mockState)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error during token exchange')
    })

    it('should clean up localStorage after successful callback', async () => {
      const mockCode = 'test-auth-code'
      const mockState = 'test-state'
      const mockVerifier = 'test-verifier'

      ;(localStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'oauth_state') return mockState
        if (key === 'pkce_verifier') return mockVerifier
        return null
      })

      const mockTokenResponse = {
        access_token: 'mock-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        scope: 'https://graph.microsoft.com/.default',
      }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokenResponse),
      })

      mockTokenManagerInstance.storeToken.mockResolvedValue(undefined)

      await oauthManager.handleCallback(mockCode, mockState)

      expect(localStorage.removeItem).toHaveBeenCalledWith('oauth_state')
      expect(localStorage.removeItem).toHaveBeenCalledWith('pkce_verifier')
    })
  })

  describe('Token Management Integration', () => {
    it('should get valid token from TokenManager', async () => {
      const mockToken = {
        access_token: 'valid-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'valid-refresh-token',
      }

      mockTokenManagerInstance.getValidToken.mockResolvedValue(mockToken)

      const token = await oauthManager.getValidToken()

      expect(token).toEqual(mockToken)
      expect(mockTokenManagerInstance.getValidToken).toHaveBeenCalledWith('microsoft')
    })

    it('should handle token refresh when access token is expired', async () => {
      const mockExpiredToken = {
        access_token: 'expired-access-token',
        token_type: 'Bearer',
        expires_in: 0,
        refresh_token: 'valid-refresh-token',
      }

      const mockRefreshedToken = {
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'new-refresh-token',
      }

      mockTokenManagerInstance.getValidToken.mockResolvedValue(null)
      mockTokenManagerInstance.refreshToken.mockResolvedValue(mockRefreshedToken)

      const token = await oauthManager.getValidToken()

      expect(token).toEqual(mockRefreshedToken)
      expect(mockTokenManagerInstance.refreshToken).toHaveBeenCalledWith('microsoft')
    })

    it('should return null when no token is available', async () => {
      mockTokenManagerInstance.getValidToken.mockResolvedValue(null)
      mockTokenManagerInstance.refreshToken.mockResolvedValue(null)

      const token = await oauthManager.getValidToken()

      expect(token).toBeNull()
    })

    it('should revoke token on logout', async () => {
      mockTokenManagerInstance.revokeToken.mockResolvedValue(true)

      const result = await oauthManager.revokeToken()

      expect(result).toBe(true)
      expect(mockTokenManagerInstance.revokeToken).toHaveBeenCalledWith('microsoft')
    })
  })

  describe('PKCE Code Challenge Generation', () => {
    it('should generate different code challenges for different verifiers', async () => {
      const authUrl1 = await oauthManager.getAuthorizationUrl()
      const authUrl2 = await oauthManager.getAuthorizationUrl()

      expect(authUrl1).not.toEqual(authUrl2)
      expect(localStorage.setItem).toHaveBeenCalledTimes(4) // 2 verifiers + 2 states
    })

    it('should use S256 code challenge method', async () => {
      const authUrl = await oauthManager.getAuthorizationUrl()

      expect(authUrl).toContain('code_challenge_method=S256')
    })

    it('should generate URL-safe base64 encoded code challenge', async () => {
      const authUrl = await oauthManager.getAuthorizationUrl()

      // Extract code_challenge parameter
      const urlObj = new URL(authUrl)
      const codeChallenge = urlObj.searchParams.get('code_challenge')

      expect(codeChallenge).toBeDefined()
      expect(codeChallenge).not.toContain('+')
      expect(codeChallenge).not.toContain('/')
      expect(codeChallenge).not.toContain('=')
    })
  })

  describe('Error Handling', () => {
    it('should handle missing environment variables', async () => {
      delete process.env.MICROSOFT_CLIENT_ID

      expect(() => new MicrosoftOAuthManager()).toThrow('Missing required Microsoft OAuth configuration')
    })

    it('should handle crypto API unavailability', async () => {
      // @ts-ignore
      global.crypto = undefined

      expect(() => new MicrosoftOAuthManager()).toThrow('Crypto API is not available')
    })

    it('should handle localStorage unavailability', async () => {
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true,
      })

      await expect(oauthManager.getAuthorizationUrl()).rejects.toThrow('localStorage is not available')
    })
  })
})