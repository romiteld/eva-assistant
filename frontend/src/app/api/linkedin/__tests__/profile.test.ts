import { GET } from '../profile/route'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createLinkedInService } from '@/lib/services/linkedin'

// Mock dependencies
jest.mock('@supabase/supabase-js')
jest.mock('@/lib/services/linkedin')

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockCreateLinkedInService = createLinkedInService as jest.MockedFunction<typeof createLinkedInService>

describe('LinkedIn Profile API Route', () => {
  let mockSupabaseClient: any
  let mockLinkedInService: any
  let mockRequest: NextRequest

  beforeEach(() => {
    mockSupabaseClient = {
      auth: {
        getUser: jest.fn(),
      },
    }

    mockLinkedInService = {
      getProfile: jest.fn(),
    }

    mockCreateClient.mockReturnValue(mockSupabaseClient)
    mockCreateLinkedInService.mockReturnValue(mockLinkedInService)
    
    mockRequest = {
      url: 'http://localhost:3000/api/linkedin/profile',
      headers: new Headers(),
    } as NextRequest

    // Mock environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    process.env.OAUTH_ENCRYPTION_KEY = 'test-encryption-key'
    process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID = 'test-linkedin-client-id'
    process.env.LINKEDIN_CLIENT_SECRET = 'test-linkedin-client-secret'
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/linkedin/profile', () => {
    it('should return unauthorized when no authorization header is provided', async () => {
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return unauthorized when bearer token is invalid', async () => {
      const headers = new Headers()
      headers.set('authorization', 'Bearer invalid-token')
      mockRequest.headers = headers

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      })

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should fetch and return LinkedIn profile data', async () => {
      const headers = new Headers()
      headers.set('authorization', 'Bearer valid-token')
      mockRequest.headers = headers

      const mockProfile = {
        id: 'linkedin-user-123',
        localizedFirstName: 'John',
        localizedLastName: 'Doe',
        profilePicture: {
          'displayImage~': {
            elements: [
              {
                identifiers: [
                  {
                    identifier: 'https://media.licdn.com/profile-pic.jpg',
                  },
                ],
              },
            ],
          },
        },
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockLinkedInService.getProfile.mockResolvedValue(mockProfile)

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.profile).toEqual(mockProfile)
      expect(mockCreateLinkedInService).toHaveBeenCalledWith(
        'user-123',
        'test-encryption-key',
        expect.objectContaining({
          linkedin: {
            tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
            clientId: 'test-linkedin-client-id',
            clientSecret: 'test-linkedin-client-secret'
          }
        })
      )
      expect(mockLinkedInService.getProfile).toHaveBeenCalled()
    })

    it('should handle LinkedIn service errors', async () => {
      const headers = new Headers()
      headers.set('authorization', 'Bearer valid-token')
      mockRequest.headers = headers

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockLinkedInService.getProfile.mockRejectedValue(new Error('LinkedIn API error'))

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch LinkedIn profile')
    })

    it('should handle user authentication errors', async () => {
      const headers = new Headers()
      headers.set('authorization', 'Bearer valid-token')
      mockRequest.headers = headers

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'User not found' },
      })

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should handle missing environment variables', async () => {
      const headers = new Headers()
      headers.set('authorization', 'Bearer valid-token')
      mockRequest.headers = headers

      // Remove required environment variable
      delete process.env.OAUTH_ENCRYPTION_KEY

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch LinkedIn profile')
    })
  })
})