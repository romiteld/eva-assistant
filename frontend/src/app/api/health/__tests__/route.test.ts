import { GET } from '../route'
import { NextResponse } from 'next/server'

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
      headers: new Headers(init?.headers || {}),
    })),
  },
}))

describe('Health API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset environment variables
    process.env.APP_VERSION = '1.0.0'
    process.env.NODE_ENV = 'test'
  })

  it('should return healthy status', async () => {
    const response = await GET()

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'healthy',
        timestamp: expect.any(String),
        service: 'eva-api',
        version: '1.0.0',
        environment: 'test',
      }),
      { status: 200 }
    )

    const data = await response.json()
    expect(data.status).toBe('healthy')
  })

  it('should use default values when environment variables are not set', async () => {
    delete process.env.APP_VERSION
    delete process.env.NODE_ENV

    await GET()

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        version: '1.0.0',
        environment: 'development',
      }),
      { status: 200 }
    )
  })

  it('should handle errors gracefully', async () => {
    // Force an error by mocking Date constructor
    const originalDate = global.Date
    global.Date = jest.fn(() => {
      throw new Error('Date error')
    }) as any
    global.Date.prototype = originalDate.prototype

    const response = await GET()

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'unhealthy',
        error: 'Date error',
        timestamp: expect.any(String),
      }),
      { status: 503 }
    )

    // Restore Date
    global.Date = originalDate
  })

  it('should include ISO timestamp', async () => {
    const mockDate = '2023-12-01T12:00:00.000Z'
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate)

    await GET()

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: mockDate,
      }),
      { status: 200 }
    )
  })
})