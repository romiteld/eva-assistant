import { setupServer } from 'msw/node'
import { http, HttpResponse, type HttpHandler, type RequestHandler } from 'msw'

// Mock Supabase auth endpoints
const authHandlers = [
  http.post('*/auth/v1/token', () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh-token',
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
    })
  }),

  http.get('*/auth/v1/user', ({ request }) => {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.includes('Bearer')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return HttpResponse.json({
      id: 'test-user-id',
      email: 'test@example.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    })
  }),

  http.post('*/auth/v1/logout', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('*/auth/v1/otp', () => {
    return HttpResponse.json({ message: 'Magic link sent' })
  }),
]

// Mock database endpoints
const databaseHandlers = [
  http.get('*/rest/v1/profiles', () => {
    return HttpResponse.json([
      {
        id: 'test-user-id',
        full_name: 'Test User',
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
  }),

  http.post('*/rest/v1/profiles', () => {
    return HttpResponse.json({
      id: 'test-user-id',
      full_name: 'Test User',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),

  http.get('*/rest/v1/tasks', () => {
    return HttpResponse.json([
      {
        id: 'task-1',
        user_id: 'test-user-id',
        title: 'Test Task',
        description: 'Test Description',
        status: 'pending',
        priority: 0.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
  }),

  http.post('*/rest/v1/tasks', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      id: 'new-task-id',
      user_id: 'test-user-id',
      ...(typeof body === 'object' && body !== null ? body : {}),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),

  http.patch('*/rest/v1/tasks', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      id: 'task-1',
      user_id: 'test-user-id',
      ...(typeof body === 'object' && body !== null ? body : {}),
      updated_at: new Date().toISOString(),
    })
  }),

  http.delete('*/rest/v1/tasks', () => {
    return new HttpResponse(null, { status: 204 })
  }),
]

// Mock API endpoints
const apiHandlers = [
  http.get('/api/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'eva-api',
      version: '1.0.0',
      environment: 'test',
    })
  }),

  http.post('/api/firecrawl', async ({ request }) => {
    const body = await request.json() as any
    
    if (body.action === 'scrape') {
      return HttpResponse.json({
        success: true,
        data: {
          markdown: '# Test Content\n\nThis is scraped content.',
          html: '<h1>Test Content</h1><p>This is scraped content.</p>',
        },
      })
    }

    return HttpResponse.json({ error: 'Invalid action' }, { status: 400 })
  }),

  http.post('/api/gemini', async ({ request }: { request: Request }) => {
    const body = await request.json() as any
    
    return HttpResponse.json({
      response: `AI response to: ${body.prompt}`,
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    })
  }),

  http.get('/api/csrf', () => {
    return HttpResponse.json(
      { token: 'mock-csrf-token' },
      {
        headers: {
          'Set-Cookie': 'csrf-token=mock-csrf-token; Path=/; HttpOnly'
        }
      }
    )
  }),
]

// Combine all handlers
const handlers = [...authHandlers, ...databaseHandlers, ...apiHandlers]

// Setup server
const server = setupServer(...handlers)

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

// Reset handlers after each test
afterEach(() => server.resetHandlers())

// Clean up after all tests
afterAll(() => server.close())