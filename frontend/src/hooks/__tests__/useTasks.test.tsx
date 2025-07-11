import { renderHook, act, waitFor } from '@testing-library/react'
import { useTasks, useTaskStatistics, useOverdueTasks, useHighPriorityTasks } from '../useTasks'
import { taskService } from '@/lib/supabase/task-service'
import { useAuth } from '@/app/providers'

// Mock dependencies
jest.mock('@/lib/supabase/task-service')
jest.mock('@/app/providers')

describe('useTasks', () => {
  const mockUser = { id: 'test-user-id', email: 'test@example.com' }
  const mockTasks = [
    {
      id: 'task-1',
      user_id: 'test-user-id',
      title: 'Test Task 1',
      description: 'Description 1',
      status: 'pending',
      priority: 0.5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'task-2',
      user_id: 'test-user-id',
      title: 'Test Task 2',
      description: 'Description 2',
      status: 'in_progress',
      priority: 0.8,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useAuth as jest.Mock).mockReturnValue({ user: mockUser })
    ;(taskService.list as jest.Mock).mockResolvedValue({
      tasks: mockTasks,
      total: 2,
      totalPages: 1,
    })
    ;(taskService.subscribeToUserTasks as jest.Mock).mockReturnValue(jest.fn())
  })

  it('should fetch tasks on mount', async () => {
    const { result } = renderHook(() => useTasks())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.tasks).toEqual(mockTasks)
      expect(result.current.total).toBe(2)
      expect(result.current.totalPages).toBe(1)
    })

    expect(taskService.list).toHaveBeenCalledWith(
      {},
      { field: 'created_at', direction: 'desc' },
      { page: 1, limit: 10 }
    )
  })

  it('should handle custom options', async () => {
    const options = {
      filters: { status: 'pending' },
      sort: { field: 'priority' as const, direction: 'asc' as const },
      pagination: { page: 2, limit: 20 },
    }

    const { result } = renderHook(() => useTasks(options))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(taskService.list).toHaveBeenCalledWith(
      { status: 'pending' },
      { field: 'priority', direction: 'asc' },
      { page: 2, limit: 20 }
    )
  })

  it('should not fetch when user is not authenticated', async () => {
    ;(useAuth as jest.Mock).mockReturnValue({ user: null })

    const { result } = renderHook(() => useTasks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(taskService.list).not.toHaveBeenCalled()
    expect(result.current.tasks).toEqual([])
  })

  it('should handle errors gracefully', async () => {
    const error = new Error('Failed to fetch tasks')
    ;(taskService.list as jest.Mock).mockRejectedValue(error)

    const { result } = renderHook(() => useTasks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toEqual(error)
      expect(result.current.tasks).toEqual([])
    })
  })

  it('should create a task', async () => {
    const newTask = {
      title: 'New Task',
      description: 'New Description',
      status: 'pending' as const,
      priority: 0.5,
    }

    const createdTask = { ...newTask, id: 'new-task-id', user_id: mockUser.id }
    ;(taskService.create as jest.Mock).mockResolvedValue(createdTask)

    const { result } = renderHook(() => useTasks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    let returnedTask: any
    await act(async () => {
      returnedTask = await result.current.createTask(newTask)
    })

    expect(taskService.create).toHaveBeenCalledWith(newTask)
    expect(returnedTask).toEqual(createdTask)
  })

  it('should update a task', async () => {
    const updates = { title: 'Updated Title' }
    const updatedTask = { ...mockTasks[0], ...updates }
    ;(taskService.update as jest.Mock).mockResolvedValue(updatedTask)

    const { result } = renderHook(() => useTasks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    let returnedTask: any
    await act(async () => {
      returnedTask = await result.current.updateTask('task-1', updates)
    })

    expect(taskService.update).toHaveBeenCalledWith('task-1', updates)
    expect(returnedTask).toEqual(updatedTask)
  })

  it('should delete a task', async () => {
    ;(taskService.delete as jest.Mock).mockResolvedValue(undefined)

    const { result } = renderHook(() => useTasks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.deleteTask('task-1')
    })

    expect(taskService.delete).toHaveBeenCalledWith('task-1')
  })

  it('should delete multiple tasks', async () => {
    ;(taskService.deleteMany as jest.Mock).mockResolvedValue(undefined)

    const { result } = renderHook(() => useTasks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.deleteTasks(['task-1', 'task-2'])
    })

    expect(taskService.deleteMany).toHaveBeenCalledWith(['task-1', 'task-2'])
  })

  it('should complete a task', async () => {
    const completedTask = { ...mockTasks[0], status: 'completed' }
    ;(taskService.complete as jest.Mock).mockResolvedValue(completedTask)

    const { result } = renderHook(() => useTasks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    let returnedTask: any
    await act(async () => {
      returnedTask = await result.current.completeTask('task-1')
    })

    expect(taskService.complete).toHaveBeenCalledWith('task-1')
    expect(returnedTask).toEqual(completedTask)
  })

  it('should handle real-time updates', async () => {
    let subscriptionCallback: any
    ;(taskService.subscribeToUserTasks as jest.Mock).mockImplementation((userId, callback) => {
      subscriptionCallback = callback
      return jest.fn()
    })

    const { result } = renderHook(() => useTasks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Test INSERT event
    const newTask = {
      id: 'task-3',
      user_id: mockUser.id,
      title: 'New Task',
      status: 'pending',
    }

    act(() => {
      subscriptionCallback({
        eventType: 'INSERT',
        new: newTask,
      })
    })

    expect(result.current.tasks).toContainEqual(newTask)
    expect(result.current.total).toBe(3)

    // Test UPDATE event
    const updatedTask = { ...mockTasks[0], title: 'Updated Title' }

    act(() => {
      subscriptionCallback({
        eventType: 'UPDATE',
        new: updatedTask,
      })
    })

    expect(result.current.tasks.find(t => t.id === 'task-1')).toEqual(updatedTask)

    // Test DELETE event
    act(() => {
      subscriptionCallback({
        eventType: 'DELETE',
        old: { id: 'task-1' },
      })
    })

    expect(result.current.tasks.find(t => t.id === 'task-1')).toBeUndefined()
    expect(result.current.total).toBe(2)
  })

  it('should refresh tasks', async () => {
    const { result } = renderHook(() => useTasks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    jest.clearAllMocks()

    await act(async () => {
      await result.current.refresh()
    })

    expect(taskService.list).toHaveBeenCalledTimes(1)
  })

  it('should update filters and reset page', async () => {
    const { result } = renderHook(() => useTasks({ pagination: { page: 2 } }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setFilters({ status: 'completed' })
    })

    expect(result.current.page).toBe(1) // Page should reset to 1

    await waitFor(() => {
      expect(taskService.list).toHaveBeenLastCalledWith(
        { status: 'completed' },
        expect.any(Object),
        expect.objectContaining({ page: 1 })
      )
    })
  })
})

describe('useTaskStatistics', () => {
  const mockUser = { id: 'test-user-id', email: 'test@example.com' }
  const mockStatistics = {
    total: 10,
    completed: 5,
    pending: 3,
    in_progress: 2,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useAuth as jest.Mock).mockReturnValue({ user: mockUser })
    ;(taskService.getStatistics as jest.Mock).mockResolvedValue(mockStatistics)
  })

  it('should fetch statistics on mount', async () => {
    const { result } = renderHook(() => useTaskStatistics())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.statistics).toEqual(mockStatistics)
    })

    expect(taskService.getStatistics).toHaveBeenCalled()
  })

  it('should handle errors', async () => {
    const error = new Error('Failed to fetch statistics')
    ;(taskService.getStatistics as jest.Mock).mockRejectedValue(error)

    const { result } = renderHook(() => useTaskStatistics())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toEqual(error)
      expect(result.current.statistics).toBeNull()
    })
  })

  it('should refresh statistics', async () => {
    const { result } = renderHook(() => useTaskStatistics())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    jest.clearAllMocks()

    await act(async () => {
      await result.current.refresh()
    })

    expect(taskService.getStatistics).toHaveBeenCalledTimes(1)
  })
})

describe('useOverdueTasks', () => {
  const mockUser = { id: 'test-user-id', email: 'test@example.com' }
  const mockOverdueTasks = [
    {
      id: 'overdue-1',
      title: 'Overdue Task',
      due_date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useAuth as jest.Mock).mockReturnValue({ user: mockUser })
    ;(taskService.getOverdue as jest.Mock).mockResolvedValue({
      tasks: mockOverdueTasks,
    })
  })

  it('should fetch overdue tasks', async () => {
    const { result } = renderHook(() => useOverdueTasks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.tasks).toEqual(mockOverdueTasks)
    })

    expect(taskService.getOverdue).toHaveBeenCalled()
  })
})

describe('useHighPriorityTasks', () => {
  const mockUser = { id: 'test-user-id', email: 'test@example.com' }
  const mockHighPriorityTasks = [
    {
      id: 'high-1',
      title: 'High Priority Task',
      priority: 0.9,
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useAuth as jest.Mock).mockReturnValue({ user: mockUser })
    ;(taskService.getHighPriority as jest.Mock).mockResolvedValue({
      tasks: mockHighPriorityTasks,
    })
  })

  it('should fetch high priority tasks with default threshold', async () => {
    const { result } = renderHook(() => useHighPriorityTasks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.tasks).toEqual(mockHighPriorityTasks)
    })

    expect(taskService.getHighPriority).toHaveBeenCalledWith(0.7)
  })

  it('should fetch high priority tasks with custom threshold', async () => {
    const { result } = renderHook(() => useHighPriorityTasks(0.85))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(taskService.getHighPriority).toHaveBeenCalledWith(0.85)
  })
})