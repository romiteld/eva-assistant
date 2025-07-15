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

// Mock Microsoft Graph API endpoints
const microsoftGraphHandlers = [
  http.post('https://graph.microsoft.com/v1.0/me/sendMail', () => {
    return HttpResponse.json({ id: 'sent-email-id' })
  }),
  
  http.get('https://graph.microsoft.com/v1.0/me/events', () => {
    return HttpResponse.json({
      value: [
        {
          id: 'event-id',
          subject: 'Test Meeting',
          start: { dateTime: '2024-01-01T10:00:00Z' },
          end: { dateTime: '2024-01-01T11:00:00Z' },
          onlineMeeting: { joinUrl: 'https://teams.microsoft.com/l/meetup-join/...' }
        }
      ]
    })
  }),
  
  http.post('https://graph.microsoft.com/v1.0/me/events', () => {
    return HttpResponse.json({ 
      id: 'new-event-id',
      onlineMeeting: { joinUrl: 'https://teams.microsoft.com/l/meetup-join/...' }
    })
  }),
  
  http.get('https://graph.microsoft.com/v1.0/me/contacts', () => {
    return HttpResponse.json({
      value: [
        {
          id: 'contact-id',
          displayName: 'John Doe',
          emailAddresses: [{ address: 'john@example.com' }]
        }
      ]
    })
  }),
]

// Mock Twilio API endpoints
const twilioHandlers = [
  http.post('https://api.twilio.com/2010-04-01/Accounts/*/Messages.json', () => {
    return HttpResponse.json({
      sid: 'message-sid',
      status: 'queued',
      to: '+1234567890',
      from: '+0987654321',
      body: 'Test message'
    })
  }),
  
  http.post('https://api.twilio.com/2010-04-01/Accounts/*/Calls.json', () => {
    return HttpResponse.json({
      sid: 'call-sid',
      status: 'initiated',
      to: '+1234567890',
      from: '+0987654321'
    })
  }),
]

// Mock Zoho CRM API endpoints
const zohoHandlers = [
  http.post('https://accounts.zoho.com/oauth/v2/token', () => {
    return HttpResponse.json({
      access_token: 'mock-zoho-token',
      expires_in: 3600,
      refresh_token: 'mock-refresh-token'
    })
  }),
  
  http.get('https://www.zohoapis.com/crm/v2/Leads', () => {
    return HttpResponse.json({
      data: [
        {
          id: 'lead-id',
          Company: 'Test Company',
          First_Name: 'John',
          Last_Name: 'Doe',
          Email: 'john@example.com'
        }
      ]
    })
  }),
  
  http.post('https://www.zohoapis.com/crm/v2/Leads', () => {
    return HttpResponse.json({
      data: [{ id: 'new-lead-id', status: 'success' }]
    })
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

  // Interview Center API mocks
  http.get('/api/interview-center', () => {
    return HttpResponse.json({
      interviews: [
        {
          id: 'interview-id',
          candidateId: 'candidate-id',
          jobId: 'job-id',
          type: 'technical',
          status: 'scheduled',
          scheduledTime: '2024-01-01T10:00:00Z'
        }
      ],
      total: 1
    })
  }),

  http.post('/api/interview-center', async ({ request }) => {
    const body = await request.json() as any
    return HttpResponse.json({
      interview: {
        id: 'new-interview-id',
        ...body,
        status: 'scheduled'
      }
    })
  }),

  // Resume Parser API mocks
  http.post('/api/resume-parser/upload', () => {
    return HttpResponse.json({
      resumeId: 'resume-id',
      status: 'processing'
    })
  }),

  http.get('/api/resume-parser/:id', () => {
    return HttpResponse.json({
      resume: {
        id: 'resume-id',
        name: 'John Doe',
        email: 'john@example.com',
        skills: ['JavaScript', 'React', 'Node.js'],
        experience: [
          {
            company: 'Tech Corp',
            position: 'Senior Developer',
            duration: '2020-2023'
          }
        ]
      }
    })
  }),

  // Candidates API mocks
  http.get('/api/candidates', () => {
    return HttpResponse.json({
      candidates: [
        {
          id: 'candidate-id',
          name: 'John Doe',
          email: 'john@example.com',
          status: 'active',
          skills: ['JavaScript', 'React']
        }
      ],
      total: 1
    })
  }),

  http.post('/api/candidates', async ({ request }) => {
    const body = await request.json() as any
    return HttpResponse.json({
      candidate: {
        id: 'new-candidate-id',
        ...body,
        status: 'active'
      }
    })
  }),

  // Messages API mocks
  http.get('/api/messages', () => {
    return HttpResponse.json({
      messages: [
        {
          id: 'message-id',
          type: 'email',
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Message',
          body: 'Test message body',
          status: 'sent'
        }
      ],
      total: 1
    })
  }),

  http.post('/api/messages/send', async ({ request }) => {
    const body = await request.json() as any
    return HttpResponse.json({
      messageId: 'sent-message-id',
      status: 'sent'
    })
  }),
]

// Combine all handlers
const handlers = [
  ...authHandlers, 
  ...databaseHandlers, 
  ...microsoftGraphHandlers, 
  ...twilioHandlers, 
  ...zohoHandlers, 
  ...apiHandlers
]

// Setup server
const server = setupServer(...handlers)

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

// Reset handlers after each test
afterEach(() => server.resetHandlers())

// Clean up after all tests
afterAll(() => server.close())