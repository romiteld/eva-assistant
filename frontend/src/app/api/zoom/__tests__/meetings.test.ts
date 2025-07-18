import { GET, POST } from '../meetings/route'
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

// Mock dependencies
jest.mock('@/lib/supabase/server')
jest.mock('next/headers')

const mockCreateServerClient = createServerClient as jest.MockedFunction<typeof createServerClient>
const mockHeaders = headers as jest.MockedFunction<typeof headers>

describe('Zoom Meetings API Route', () => {
  let mockSupabaseClient: any
  let mockRequest: NextRequest

  beforeEach(() => {
    mockSupabaseClient = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
        insert: jest.fn().mockReturnThis(),
      })),
    }

    mockCreateServerClient.mockReturnValue(mockSupabaseClient)
    mockHeaders.mockReturnValue(new Headers())
    
    // Mock environment variables
    process.env.ZOOM_CLIENT_ID = 'test-client-id'
    process.env.ZOOM_CLIENT_SECRET = 'test-client-secret'
    process.env.ZOOM_ACCOUNT_ID = 'test-account-id'
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/zoom/meetings', () => {
    beforeEach(() => {
      mockRequest = {
        url: 'http://localhost:3000/api/zoom/meetings',
        headers: new Headers(),
      } as NextRequest
    })

    it('should return unauthorized when no user is authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return error when no Zoom token is found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Token not found' },
      })

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Zoom token not found')
    })

    it('should fetch and return Zoom meetings', async () => {
      const validToken = {
        access_token: 'valid-token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }

      const mockMeetings = {
        meetings: [
          {
            id: 'meeting-123',
            topic: 'Test Meeting',
            start_time: '2024-01-01T10:00:00Z',
            duration: 60,
            join_url: 'https://zoom.us/j/123456789',
          },
        ],
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: validToken,
        error: null,
      })

      // Mock fetch for Zoom API
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockMeetings),
      })

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.meetings).toEqual(mockMeetings.meetings)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.zoom.us/v2/users/me/meetings',
        {
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
        }
      )
    })

    it('should handle Zoom API errors', async () => {
      const validToken = {
        access_token: 'valid-token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: validToken,
        error: null,
      })

      // Mock fetch for Zoom API error
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch meetings')
    })
  })

  describe('POST /api/zoom/meetings', () => {
    beforeEach(() => {
      mockRequest = {
        url: 'http://localhost:3000/api/zoom/meetings',
        headers: new Headers(),
        json: jest.fn(),
      } as any as NextRequest
    })

    it('should create a new Zoom meeting', async () => {
      const meetingData = {
        topic: 'Test Meeting',
        type: 2,
        start_time: '2024-01-01T10:00:00Z',
        duration: 60,
        agenda: 'Discuss project updates',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: false,
          watermark: false,
          use_pmi: false,
          approval_type: 2,
          audio: 'both',
          auto_recording: 'none',
        },
      }

      const validToken = {
        access_token: 'valid-token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }

      const mockCreatedMeeting = {
        id: 'meeting-123',
        topic: 'Test Meeting',
        start_time: '2024-01-01T10:00:00Z',
        duration: 60,
        join_url: 'https://zoom.us/j/123456789',
        password: 'abc123',
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: validToken,
        error: null,
      })

      mockSupabaseClient.from().insert().mockResolvedValue({
        data: null,
        error: null,
      })

      mockRequest.json = jest.fn().mockResolvedValue(meetingData)

      // Mock fetch for Zoom API
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockCreatedMeeting),
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.meeting).toEqual(mockCreatedMeeting)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.zoom.us/v2/users/me/meetings',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(meetingData),
        }
      )
    })

    it('should validate required meeting fields', async () => {
      const invalidMeetingData = {
        type: 2,
        start_time: '2024-01-01T10:00:00Z',
        // Missing required topic
      }

      const validToken = {
        access_token: 'valid-token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: validToken,
        error: null,
      })

      mockRequest.json = jest.fn().mockResolvedValue(invalidMeetingData)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required fields')
    })

    it('should handle Zoom API errors during meeting creation', async () => {
      const meetingData = {
        topic: 'Test Meeting',
        type: 2,
        start_time: '2024-01-01T10:00:00Z',
        duration: 60,
      }

      const validToken = {
        access_token: 'valid-token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: validToken,
        error: null,
      })

      mockRequest.json = jest.fn().mockResolvedValue(meetingData)

      // Mock fetch for Zoom API error
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue({
          message: 'Invalid meeting data',
        }),
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to create meeting')
    })

    it('should handle database errors when storing meeting', async () => {
      const meetingData = {
        topic: 'Test Meeting',
        type: 2,
        start_time: '2024-01-01T10:00:00Z',
        duration: 60,
      }

      const validToken = {
        access_token: 'valid-token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }

      const mockCreatedMeeting = {
        id: 'meeting-123',
        topic: 'Test Meeting',
        start_time: '2024-01-01T10:00:00Z',
        duration: 60,
        join_url: 'https://zoom.us/j/123456789',
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: validToken,
        error: null,
      })

      mockSupabaseClient.from().insert().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      mockRequest.json = jest.fn().mockResolvedValue(meetingData)

      // Mock fetch for Zoom API success
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockCreatedMeeting),
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to store meeting in database')
    })
  })
})