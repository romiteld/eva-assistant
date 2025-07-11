import { supabase } from './client';
import { Database } from './client';
import { TaskStatus } from '@/types/database';

type Task = Database['public']['Tables']['tasks']['Row'];
type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

export interface TaskFilters {
  status?: Task['status'] | Task['status'][];
  assigned_agent?: string | string[];
  priority_min?: number;
  priority_max?: number;
  due_before?: string;
  due_after?: string;
  search?: string;
}

export interface TaskSortOptions {
  field: 'created_at' | 'updated_at' | 'due_date' | 'priority' | 'title';
  direction: 'asc' | 'desc';
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

// Task Management Service
export const taskService = {
  // Create a new task
  create: async (task: Omit<TaskInsert, 'user_id'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Validate task data
    if (!task.title || task.title.trim() === '') {
      throw new Error('Task title is required');
    }

    if (task.priority !== undefined && (task.priority < 0 || task.priority > 1)) {
      throw new Error('Task priority must be between 0 and 1');
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        ...task,
        user_id: user.id,
        status: task.status || TaskStatus.pending,
        priority: task.priority ?? 0.5,
        metadata: task.metadata || {}
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update an existing task
  update: async (taskId: string, updates: TaskUpdate) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Validate updates
    if (updates.priority !== undefined && (updates.priority < 0 || updates.priority > 1)) {
      throw new Error('Task priority must be between 0 and 1');
    }

    // If updating to completed, set completed_at
    if (updates.status === 'completed' && !updates.completed_at) {
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .eq('user_id', user.id) // Ensure user owns the task
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Task not found or unauthorized');
    
    return data;
  },

  // Delete a task
  delete: async (taskId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', user.id);

    if (error) throw error;
  },

  // Delete multiple tasks
  deleteMany: async (taskIds: string[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('tasks')
      .delete()
      .in('id', taskIds)
      .eq('user_id', user.id);

    if (error) throw error;
  },

  // Get a single task by ID
  getById: async (taskId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;
    return data;
  },

  // Get all tasks with filters and pagination
  list: async (
    filters?: TaskFilters,
    sort?: TaskSortOptions,
    pagination?: PaginationOptions
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    let query = supabase
      .from('tasks')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    // Apply filters
    if (filters) {
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      if (filters.assigned_agent) {
        if (Array.isArray(filters.assigned_agent)) {
          query = query.in('assigned_agent', filters.assigned_agent);
        } else {
          query = query.eq('assigned_agent', filters.assigned_agent);
        }
      }

      if (filters.priority_min !== undefined) {
        query = query.gte('priority', filters.priority_min);
      }

      if (filters.priority_max !== undefined) {
        query = query.lte('priority', filters.priority_max);
      }

      if (filters.due_before) {
        query = query.lte('due_date', filters.due_before);
      }

      if (filters.due_after) {
        query = query.gte('due_date', filters.due_after);
      }

      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }
    }

    // Apply sorting
    if (sort) {
      query = query.order(sort.field, { ascending: sort.direction === 'asc' });
    } else {
      // Default sort by created_at desc
      query = query.order('created_at', { ascending: false });
    }

    // Apply pagination
    if (pagination) {
      const page = pagination.page || 1;
      const limit = pagination.limit || 10;
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

    if (error) throw error;
    
    return {
      tasks: data || [],
      total: count || 0,
      page: pagination?.page || 1,
      limit: pagination?.limit || 10,
      totalPages: Math.ceil((count || 0) / (pagination?.limit || 10))
    };
  },

  // Get overdue tasks
  getOverdue: async () => {
    const now = new Date().toISOString();
    return taskService.list({
      status: [TaskStatus.pending, TaskStatus.in_progress],
      due_before: now
    });
  },

  // Get tasks due today
  getDueToday: async () => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    return taskService.list({
      due_after: startOfDay.toISOString(),
      due_before: endOfDay.toISOString()
    });
  },

  // Get high priority tasks
  getHighPriority: async (threshold = 0.7) => {
    return taskService.list({
      priority_min: threshold,
      status: [TaskStatus.pending, TaskStatus.in_progress]
    });
  },

  // Get tasks by agent
  getByAgent: async (agent: string) => {
    return taskService.list({
      assigned_agent: agent
    });
  },

  // Bulk update tasks
  bulkUpdate: async (taskIds: string[], updates: TaskUpdate) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Validate updates
    if (updates.priority !== undefined && (updates.priority < 0 || updates.priority > 1)) {
      throw new Error('Task priority must be between 0 and 1');
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .in('id', taskIds)
      .eq('user_id', user.id)
      .select();

    if (error) throw error;
    return data || [];
  },

  // Complete a task
  complete: async (taskId: string) => {
    return taskService.update(taskId, {
      status: TaskStatus.completed,
      completed_at: new Date().toISOString()
    });
  },

  // Cancel a task
  cancel: async (taskId: string) => {
    return taskService.update(taskId, {
      status: TaskStatus.cancelled
    });
  },

  // Start a task (move to in_progress)
  start: async (taskId: string) => {
    return taskService.update(taskId, {
      status: TaskStatus.in_progress
    });
  },

  // Assign task to agent
  assignToAgent: async (taskId: string, agent: string) => {
    return taskService.update(taskId, {
      assigned_agent: agent
    });
  },

  // Update task priority
  updatePriority: async (taskId: string, priority: number) => {
    if (priority < 0 || priority > 1) {
      throw new Error('Priority must be between 0 and 1');
    }
    return taskService.update(taskId, { priority });
  },

  // Set due date
  setDueDate: async (taskId: string, dueDate: string | null) => {
    return taskService.update(taskId, { due_date: dueDate || undefined });
  },

  // Add metadata to task
  addMetadata: async (taskId: string, key: string, value: any) => {
    const task = await taskService.getById(taskId);
    const updatedMetadata = {
      ...task.metadata,
      [key]: value
    };
    return taskService.update(taskId, { metadata: updatedMetadata });
  },

  // Remove metadata from task
  removeMetadata: async (taskId: string, key: string) => {
    const task = await taskService.getById(taskId);
    const { [key]: removed, ...updatedMetadata } = task.metadata;
    return taskService.update(taskId, { metadata: updatedMetadata });
  },

  // Get task statistics
  getStatistics: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get counts by status
    // Get task counts by status using RPC or manual aggregation
    const { data: tasks } = await supabase
      .from('tasks')
      .select('status')
      .eq('user_id', user.id);
    
    const statusCounts = tasks?.reduce((acc: any[], task) => {
      const existing = acc.find(item => item.status === task.status);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ status: task.status, count: 1 });
      }
      return acc;
    }, []);

    // Get counts by agent
    // Get task counts by agent using manual aggregation
    const { data: agentTasks } = await supabase
      .from('tasks')
      .select('assigned_agent')
      .eq('user_id', user.id)
      .not('assigned_agent', 'is', null);
    
    const agentCounts = agentTasks?.reduce((acc: any[], task) => {
      const existing = acc.find(item => item.assigned_agent === task.assigned_agent);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ assigned_agent: task.assigned_agent, count: 1 });
      }
      return acc;
    }, []);

    // Get overdue count
    const { count: overdueCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['pending', 'in_progress'])
      .lt('due_date', new Date().toISOString());

    // Get high priority count
    const { count: highPriorityCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['pending', 'in_progress'])
      .gte('priority', 0.7);

    return {
      byStatus: statusCounts || [],
      byAgent: agentCounts || [],
      overdue: overdueCount || 0,
      highPriority: highPriorityCount || 0
    };
  },

  // Subscribe to task changes
  subscribe: (callback: (payload: any) => void) => {
    const subscription = supabase
      .channel('tasks-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        callback
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  },

  // Subscribe to user's tasks only
  subscribeToUserTasks: (userId: string, callback: (payload: any) => void) => {
    const subscription = supabase
      .channel(`user-tasks-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }
};

// Export types
export type { Task, TaskInsert, TaskUpdate };