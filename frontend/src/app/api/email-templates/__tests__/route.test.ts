import { GET, POST, PUT, DELETE } from '../route'
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

// Mock dependencies
jest.mock('@/lib/supabase/server')
jest.mock('next/headers')

const mockCreateServerClient = createServerClient as jest.MockedFunction<typeof createServerClient>
const mockHeaders = headers as jest.MockedFunction<typeof headers>

describe('Email Templates API Route', () => {
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
        order: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        single: jest.fn(),
      })),
    }

    mockCreateServerClient.mockReturnValue(mockSupabaseClient)
    mockHeaders.mockReturnValue(new Headers())
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/email-templates', () => {
    beforeEach(() => {
      mockRequest = {
        url: 'http://localhost:3000/api/email-templates',
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

    it('should fetch and return email templates', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          name: 'Welcome Email',
          subject: 'Welcome to Our Platform',
          body: 'Dear {{name}}, welcome to our platform!',
          category: 'onboarding',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
        },
        {
          id: 'template-2',
          name: 'Follow-up Email',
          subject: 'Following up on our conversation',
          body: 'Hi {{name}}, I wanted to follow up on our recent conversation.',
          category: 'follow_up',
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:00:00Z',
        },
      ]

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: mockTemplates,
        error: null,
      })

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.templates).toEqual(mockTemplates)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('email_templates')
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith('*')
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith('user_id', 'user-123')
    })

    it('should filter templates by category when provided', async () => {
      mockRequest = {
        url: 'http://localhost:3000/api/email-templates?category=onboarding',
        headers: new Headers(),
      } as NextRequest

      const mockTemplates = [
        {
          id: 'template-1',
          name: 'Welcome Email',
          subject: 'Welcome to Our Platform',
          body: 'Dear {{name}}, welcome to our platform!',
          category: 'onboarding',
        },
      ]

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: mockTemplates,
        error: null,
      })

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.templates).toEqual(mockTemplates)
    })

    it('should handle database errors', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      })

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch email templates')
    })
  })

  describe('POST /api/email-templates', () => {
    beforeEach(() => {
      mockRequest = {
        url: 'http://localhost:3000/api/email-templates',
        headers: new Headers(),
        json: jest.fn(),
      } as any as NextRequest
    })

    it('should create a new email template', async () => {
      const templateData = {
        name: 'New Template',
        subject: 'Test Subject',
        body: 'Hello {{name}}, this is a test email.',
        category: 'general',
        variables: ['name'],
      }

      const createdTemplate = {
        id: 'template-123',
        ...templateData,
        user_id: 'user-123',
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z',
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().insert().single.mockResolvedValue({
        data: createdTemplate,
        error: null,
      })

      mockRequest.json = jest.fn().mockResolvedValue(templateData)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.template).toEqual(createdTemplate)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('email_templates')
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith({
        ...templateData,
        user_id: 'user-123',
      })
    })

    it('should validate required fields', async () => {
      const invalidTemplateData = {
        subject: 'Test Subject',
        body: 'Hello {{name}}',
        // Missing required name
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockRequest.json = jest.fn().mockResolvedValue(invalidTemplateData)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Name, subject, and body are required')
    })

    it('should extract variables from template body', async () => {
      const templateData = {
        name: 'Variable Template',
        subject: 'Hello {{firstName}} {{lastName}}',
        body: 'Hi {{firstName}}, your {{productName}} is ready! Contact us at {{email}}.',
        category: 'general',
      }

      const createdTemplate = {
        id: 'template-123',
        ...templateData,
        variables: ['firstName', 'lastName', 'productName', 'email'],
        user_id: 'user-123',
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z',
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().insert().single.mockResolvedValue({
        data: createdTemplate,
        error: null,
      })

      mockRequest.json = jest.fn().mockResolvedValue(templateData)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.template.variables).toEqual(['firstName', 'lastName', 'productName', 'email'])
    })

    it('should handle database errors during template creation', async () => {
      const templateData = {
        name: 'New Template',
        subject: 'Test Subject',
        body: 'Hello {{name}}',
        category: 'general',
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().insert().single.mockResolvedValue({
        data: null,
        error: { message: 'Database constraint violation' },
      })

      mockRequest.json = jest.fn().mockResolvedValue(templateData)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to create email template')
    })
  })

  describe('PUT /api/email-templates', () => {
    beforeEach(() => {
      mockRequest = {
        url: 'http://localhost:3000/api/email-templates?id=template-123',
        headers: new Headers(),
        json: jest.fn(),
      } as any as NextRequest
    })

    it('should update an existing email template', async () => {
      const updateData = {
        name: 'Updated Template',
        subject: 'Updated Subject',
        body: 'Updated body with {{name}} and {{email}}',
        category: 'updated',
      }

      const updatedTemplate = {
        id: 'template-123',
        ...updateData,
        variables: ['name', 'email'],
        user_id: 'user-123',
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T12:00:00Z',
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().update().eq().single.mockResolvedValue({
        data: updatedTemplate,
        error: null,
      })

      mockRequest.json = jest.fn().mockResolvedValue(updateData)

      const response = await PUT(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.template).toEqual(updatedTemplate)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('email_templates')
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        ...updateData,
        variables: ['name', 'email'],
        updated_at: expect.any(String),
      })
    })

    it('should require template ID for updates', async () => {
      mockRequest = {
        url: 'http://localhost:3000/api/email-templates',
        headers: new Headers(),
        json: jest.fn(),
      } as any as NextRequest

      const updateData = {
        name: 'Updated Template',
        subject: 'Updated Subject',
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockRequest.json = jest.fn().mockResolvedValue(updateData)

      const response = await PUT(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Template ID is required')
    })

    it('should handle template not found', async () => {
      const updateData = {
        name: 'Updated Template',
        subject: 'Updated Subject',
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().update().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'No rows updated' },
      })

      mockRequest.json = jest.fn().mockResolvedValue(updateData)

      const response = await PUT(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Email template not found')
    })
  })

  describe('DELETE /api/email-templates', () => {
    beforeEach(() => {
      mockRequest = {
        url: 'http://localhost:3000/api/email-templates?id=template-123',
        headers: new Headers(),
      } as NextRequest
    })

    it('should delete an email template', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().delete().eq().mockResolvedValue({
        data: null,
        error: null,
      })

      const response = await DELETE(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Email template deleted successfully')
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('email_templates')
      expect(mockSupabaseClient.from().delete).toHaveBeenCalled()
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith('id', 'template-123')
    })

    it('should require template ID for deletion', async () => {
      mockRequest = {
        url: 'http://localhost:3000/api/email-templates',
        headers: new Headers(),
      } as NextRequest

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      const response = await DELETE(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Template ID is required')
    })

    it('should handle database errors during deletion', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().delete().eq().mockResolvedValue({
        data: null,
        error: { message: 'Database constraint violation' },
      })

      const response = await DELETE(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to delete email template')
    })
  })
})