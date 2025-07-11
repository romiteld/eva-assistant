import { POST, GET } from '../route'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import FirecrawlApp from '@mendable/firecrawl-js'

// Mock dependencies
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
      headers: new Headers(init?.headers || {}),
    })),
  },
  NextRequest: jest.fn(),
}))

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}))

jest.mock('@mendable/firecrawl-js', () => {
  return jest.fn().mockImplementation(() => ({
    scrapeUrl: jest.fn(),
    crawlUrl: jest.fn(),
    mapUrl: jest.fn(),
    extract: jest.fn(),
    search: jest.fn(),
  }))
})

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn((name) => ({ value: `${name}-value` })),
  })),
}))

describe('Firecrawl API Route', () => {
  let mockRequest: Partial<NextRequest>
  let mockSupabaseClient: any
  let mockFirecrawlApp: any

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.FIRECRAWL_API_KEY = 'test-api-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

    // Setup mock request
    mockRequest = {
      headers: new Headers({
        'x-csrf-token': 'csrf-token-value',
      }),
      cookies: {
        get: jest.fn((name) => ({ name, value: `${name}-value` })) as any,
      },
      json: jest.fn(),
    }

    // Setup mock Supabase client
    mockSupabaseClient = {
      auth: {
        getSession: jest.fn(),
      },
      from: jest.fn(() => ({
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      })),
    }
    ;(createServerClient as jest.Mock).mockReturnValue(mockSupabaseClient)

    // Setup mock Firecrawl instance
    mockFirecrawlApp = new FirecrawlApp({ apiKey: 'test' })
  })

  describe('POST', () => {
    it('should reject requests without CSRF token', async () => {
      mockRequest.headers = new Headers({})

      const response = await POST(mockRequest as NextRequest)

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      )
    })

    it('should reject requests with mismatched CSRF token', async () => {
      mockRequest.headers = new Headers({
        'x-csrf-token': 'wrong-token',
      })

      const response = await POST(mockRequest as NextRequest)

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      )
    })

    it('should reject unauthenticated requests', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      mockRequest.json = jest.fn().mockResolvedValue({ action: 'scrape' })

      const response = await POST(mockRequest as NextRequest)

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    })

    it('should enforce rate limiting', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
      }
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      mockRequest.json = jest.fn().mockResolvedValue({
        action: 'scrape',
        url: 'https://example.com',
      })

      // Make multiple requests to trigger rate limit
      for (let i = 0; i < 15; i++) {
        await POST(mockRequest as NextRequest)
      }

      // The last few calls should be rate limited
      expect(NextResponse.json).toHaveBeenLastCalledWith(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    })

    it('should reject invalid actions', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
      }
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      mockRequest.json = jest.fn().mockResolvedValue({
        action: 'invalid-action',
      })

      const response = await POST(mockRequest as NextRequest)

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Invalid action' },
        { status: 400 }
      )
    })

    it('should validate scrape action parameters', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
      }
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      mockRequest.json = jest.fn().mockResolvedValue({
        action: 'scrape',
        // Missing URL
      })

      const response = await POST(mockRequest as NextRequest)

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'URL is required for scraping' },
        { status: 400 }
      )
    })

    it('should handle scrape action successfully', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
      }
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const scrapeResult = {
        markdown: '# Test Content',
        html: '<h1>Test Content</h1>',
      }
      mockFirecrawlApp.scrapeUrl.mockResolvedValue(scrapeResult)

      mockRequest.json = jest.fn().mockResolvedValue({
        action: 'scrape',
        url: 'https://example.com',
        formats: ['markdown'],
      })

      const response = await POST(mockRequest as NextRequest)

      expect(mockFirecrawlApp.scrapeUrl).toHaveBeenCalledWith('https://example.com', {
        formats: ['markdown'],
        onlyMainContent: true,
        includeTags: undefined,
        excludeTags: undefined,
        waitFor: undefined,
      })

      expect(NextResponse.json).toHaveBeenCalledWith({
        success: true,
        data: scrapeResult,
      })

      // Check API logging
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('api_logs')
    })

    it('should handle crawl action with limits', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
      }
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const crawlResult = { pages: [] }
      mockFirecrawlApp.crawlUrl.mockResolvedValue(crawlResult)

      mockRequest.json = jest.fn().mockResolvedValue({
        action: 'crawl',
        url: 'https://example.com',
        limit: 100, // Should be capped at 50
        maxDepth: 10, // Should be capped at 5
      })

      const response = await POST(mockRequest as NextRequest)

      expect(mockFirecrawlApp.crawlUrl).toHaveBeenCalledWith('https://example.com', {
        limit: 50, // Capped
        scrapeOptions: undefined,
        allowedDomains: undefined,
        excludePaths: undefined,
        maxDepth: 5, // Capped
      })
    })

    it('should handle search action', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
      }
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const searchResult = { results: [] }
      mockFirecrawlApp.search.mockResolvedValue(searchResult)

      mockRequest.json = jest.fn().mockResolvedValue({
        action: 'search',
        query: 'test query',
        limit: 30, // Should be capped at 20
      })

      const response = await POST(mockRequest as NextRequest)

      expect(mockFirecrawlApp.search).toHaveBeenCalledWith('test query', {
        limit: 20, // Capped
        scrapeOptions: undefined,
      })
    })

    it('should handle Firecrawl API errors', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
      }
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const error = new Error('Firecrawl API error')
      mockFirecrawlApp.scrapeUrl.mockRejectedValue(error)

      mockRequest.json = jest.fn().mockResolvedValue({
        action: 'scrape',
        url: 'https://example.com',
      })

      const response = await POST(mockRequest as NextRequest)

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Firecrawl API error' },
        { status: 500 }
      )
    })

    it('should handle missing API key', async () => {
      delete process.env.FIRECRAWL_API_KEY

      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
      }
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      mockRequest.json = jest.fn().mockResolvedValue({
        action: 'scrape',
        url: 'https://example.com',
      })

      const response = await POST(mockRequest as NextRequest)

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'FIRECRAWL_API_KEY is not configured' },
        { status: 500 }
      )
    })
  })

  describe('GET', () => {
    it('should return API status', async () => {
      const response = await GET(mockRequest as NextRequest)

      expect(NextResponse.json).toHaveBeenCalledWith({
        status: 'Firecrawl API endpoint is active',
      })
    })
  })
})