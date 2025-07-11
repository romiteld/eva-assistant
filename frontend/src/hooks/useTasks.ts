import { useState, useEffect, useCallback } from 'react';
import { taskService, Task, TaskFilters, TaskSortOptions, PaginationOptions } from '@/lib/supabase/task-service';
import { useAuth } from '@/app/providers';

export interface UseTasksOptions {
  filters?: TaskFilters;
  sort?: TaskSortOptions;
  pagination?: PaginationOptions;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseTasksReturn {
  tasks: Task[];
  loading: boolean;
  error: Error | null;
  total: number;
  page: number;
  totalPages: number;
  
  // Actions
  createTask: (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<Task>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<Task>;
  deleteTask: (taskId: string) => Promise<void>;
  deleteTasks: (taskIds: string[]) => Promise<void>;
  completeTask: (taskId: string) => Promise<Task>;
  cancelTask: (taskId: string) => Promise<Task>;
  startTask: (taskId: string) => Promise<Task>;
  
  // Utilities
  refresh: () => Promise<void>;
  setPage: (page: number) => void;
  setFilters: (filters: TaskFilters) => void;
  setSort: (sort: TaskSortOptions) => void;
}

export const useTasks = (options: UseTasksOptions = {}): UseTasksReturn => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(options.pagination?.page || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState(options.filters || {});
  const [sort, setSort] = useState<TaskSortOptions>(options.sort || { field: 'created_at' as const, direction: 'desc' as const });

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await taskService.list(filters, sort, { page, limit: options.pagination?.limit || 10 });
      setTasks(result.tasks);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [user, filters, sort, page, options.pagination?.limit]);

  // Initial fetch and refresh
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Auto-refresh
  useEffect(() => {
    if (!options.autoRefresh) return;
    
    const interval = setInterval(fetchTasks, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, fetchTasks]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    const unsubscribe = taskService.subscribeToUserTasks(user.id, (payload) => {
      console.log('Task update received:', payload);
      
      switch (payload.eventType) {
        case 'INSERT':
          setTasks(prev => [payload.new as Task, ...prev]);
          setTotal(prev => prev + 1);
          break;
          
        case 'UPDATE':
          setTasks(prev => prev.map(task => 
            task.id === payload.new.id ? payload.new as Task : task
          ));
          break;
          
        case 'DELETE':
          setTasks(prev => prev.filter(task => task.id !== payload.old.id));
          setTotal(prev => prev - 1);
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  // Actions
  const createTask = async (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const newTask = await taskService.create(task);
      // Real-time subscription will handle state update
      return newTask;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const updatedTask = await taskService.update(taskId, updates);
      // Real-time subscription will handle state update
      return updatedTask;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await taskService.delete(taskId);
      // Real-time subscription will handle state update
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteTasks = async (taskIds: string[]) => {
    try {
      await taskService.deleteMany(taskIds);
      // Real-time subscription will handle state updates
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const completeTask = async (taskId: string) => {
    try {
      const completedTask = await taskService.complete(taskId);
      // Real-time subscription will handle state update
      return completedTask;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const cancelTask = async (taskId: string) => {
    try {
      const cancelledTask = await taskService.cancel(taskId);
      // Real-time subscription will handle state update
      return cancelledTask;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const startTask = async (taskId: string) => {
    try {
      const startedTask = await taskService.start(taskId);
      // Real-time subscription will handle state update
      return startedTask;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    tasks,
    loading,
    error,
    total,
    page,
    totalPages,
    
    // Actions
    createTask,
    updateTask,
    deleteTask,
    deleteTasks,
    completeTask,
    cancelTask,
    startTask,
    
    // Utilities
    refresh: fetchTasks,
    setPage: (newPage: number) => setPage(newPage),
    setFilters: (newFilters: TaskFilters) => {
      setFilters(newFilters);
      setPage(1); // Reset to first page on filter change
    },
    setSort: (newSort: TaskSortOptions) => setSort(newSort)
  };
};

// Hook for task statistics
export const useTaskStatistics = () => {
  const { user } = useAuth();
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStatistics = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const stats = await taskService.getStatistics();
      setStatistics(stats);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching task statistics:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  return {
    statistics,
    loading,
    error,
    refresh: fetchStatistics
  };
};

// Hook for overdue tasks
export const useOverdueTasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchOverdueTasks = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await taskService.getOverdue();
      setTasks(result.tasks);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching overdue tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOverdueTasks();
  }, [fetchOverdueTasks]);

  return {
    tasks,
    loading,
    error,
    refresh: fetchOverdueTasks
  };
};

// Hook for high priority tasks
export const useHighPriorityTasks = (threshold = 0.7) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchHighPriorityTasks = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await taskService.getHighPriority(threshold);
      setTasks(result.tasks);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching high priority tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [user, threshold]);

  useEffect(() => {
    fetchHighPriorityTasks();
  }, [fetchHighPriorityTasks]);

  return {
    tasks,
    loading,
    error,
    refresh: fetchHighPriorityTasks
  };
};