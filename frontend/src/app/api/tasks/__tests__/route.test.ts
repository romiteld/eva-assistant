import { GET, POST, PUT, DELETE } from '../route'
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

// Mock dependencies
jest.mock('@/lib/supabase/server')
jest.mock('next/headers')

const mockCreateServerClient = createServerClient as jest.MockedFunction<typeof createServerClient>
const mockHeaders = headers as jest.MockedFunction<typeof headers>

describe('Tasks API Route', () => {
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

  describe('GET /api/tasks', () => {
    beforeEach(() => {
      mockRequest = {
        url: 'http://localhost:3000/api/tasks',
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

    it('should fetch and return user tasks', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Complete project proposal',
          description: 'Write and submit the Q1 project proposal',
          status: 'pending',
          priority: 'high',
          due_date: '2024-01-15T10:00:00Z',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
        },
        {
          id: 'task-2',
          title: 'Review client feedback',
          description: 'Analyze and respond to client feedback',
          status: 'in_progress',
          priority: 'medium',
          due_date: '2024-01-10T15:00:00Z',
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-02T09:00:00Z',
        },
      ]

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: mockTasks,
        error: null,
      })

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.tasks).toEqual(mockTasks)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('tasks')
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith('*')
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith('user_id', 'user-123')
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
      expect(data.error).toBe('Failed to fetch tasks')
    })

    it('should filter tasks by status when provided', async () => {
      mockRequest = {
        url: 'http://localhost:3000/api/tasks?status=pending',
        headers: new Headers(),
      } as NextRequest

      const mockTasks = [
        {
          id: 'task-1',
          title: 'Complete project proposal',
          status: 'pending',
          priority: 'high',
        },
      ]

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: mockTasks,
        error: null,
      })

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.tasks).toEqual(mockTasks)
    })
  })

  describe('POST /api/tasks', () => {
    beforeEach(() => {
      mockRequest = {
        url: 'http://localhost:3000/api/tasks',
        headers: new Headers(),
        json: jest.fn(),
      } as any as NextRequest
    })

    it('should create a new task', async () => {
      const taskData = {
        title: 'New Task',
        description: 'Task description',
        priority: 'medium',
        due_date: '2024-01-15T10:00:00Z',
        status: 'pending',
      }

      const createdTask = {
        id: 'task-123',
        ...taskData,
        user_id: 'user-123',
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z',
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().insert().single.mockResolvedValue({
        data: createdTask,
        error: null,
      })

      mockRequest.json = jest.fn().mockResolvedValue(taskData)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.task).toEqual(createdTask)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('tasks')
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith({
        ...taskData,
        user_id: 'user-123',
      })
    })

    it('should validate required fields', async () => {
      const invalidTaskData = {
        description: 'Task description',
        priority: 'medium',
        // Missing required title
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockRequest.json = jest.fn().mockResolvedValue(invalidTaskData)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Title is required')
    })

    it('should validate priority values', async () => {
      const invalidTaskData = {
        title: 'New Task',
        description: 'Task description',
        priority: 'invalid-priority',
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockRequest.json = jest.fn().mockResolvedValue(invalidTaskData)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid priority value')
    })

    it('should validate status values', async () => {
      const invalidTaskData = {
        title: 'New Task',
        description: 'Task description',
        priority: 'medium',
        status: 'invalid-status',
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockRequest.json = jest.fn().mockResolvedValue(invalidTaskData)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid status value')
    })

    it('should handle database errors during task creation', async () => {
      const taskData = {
        title: 'New Task',
        description: 'Task description',
        priority: 'medium',
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().insert().single.mockResolvedValue({
        data: null,
        error: { message: 'Database constraint violation' },
      })

      mockRequest.json = jest.fn().mockResolvedValue(taskData)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to create task')
    })
  })

  describe('PUT /api/tasks', () => {
    beforeEach(() => {
      mockRequest = {
        url: 'http://localhost:3000/api/tasks?id=task-123',
        headers: new Headers(),
        json: jest.fn(),
      } as any as NextRequest
    })

    it('should update an existing task', async () => {
      const updateData = {
        title: 'Updated Task',
        description: 'Updated description',
        status: 'in_progress',
        priority: 'high',
      }

      const updatedTask = {
        id: 'task-123',
        ...updateData,
        user_id: 'user-123',
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T12:00:00Z',
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabaseClient.from().update().eq().single.mockResolvedValue({
        data: updatedTask,
        error: null,
      })

      mockRequest.json = jest.fn().mockResolvedValue(updateData)

      const response = await PUT(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.task).toEqual(updatedTask)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('tasks')
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        ...updateData,
        updated_at: expect.any(String),
      })
    })

    it('should require task ID for updates', async () => {
      mockRequest = {
        url: 'http://localhost:3000/api/tasks',
        headers: new Headers(),
        json: jest.fn(),
      } as any as NextRequest

      const updateData = {
        title: 'Updated Task',
        status: 'in_progress',
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockRequest.json = jest.fn().mockResolvedValue(updateData)

      const response = await PUT(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Task ID is required')
    })

    it('should handle task not found', async () => {
      const updateData = {
        title: 'Updated Task',
        status: 'in_progress',
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
      expect(data.error).toBe('Task not found')
    })
  })

  describe('DELETE /api/tasks', () => {
    beforeEach(() => {
      mockRequest = {
        url: 'http://localhost:3000/api/tasks?id=task-123',
        headers: new Headers(),
      } as NextRequest
    })

    it('should delete a task', async () => {
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
      expect(data.message).toBe('Task deleted successfully')
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('tasks')
      expect(mockSupabaseClient.from().delete).toHaveBeenCalled()
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith('id', 'task-123')
    })

    it('should require task ID for deletion', async () => {
      mockRequest = {
        url: 'http://localhost:3000/api/tasks',
        headers: new Headers(),
      } as NextRequest

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      const response = await DELETE(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Task ID is required')
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
      expect(data.error).toBe('Failed to delete task')
    })
  })
})