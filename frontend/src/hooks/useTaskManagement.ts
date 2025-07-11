// Task Management React Hook

import { useState, useEffect, useCallback } from 'react';
import { TaskService } from '@/services/taskService';
import { 
  Task, 
  TaskStatus, 
  TaskDependency, 
  TaskTemplate,
  TaskWithDependencies,
  TaskStatistics 
} from '@/types/task';
import { useToast } from '@/components/ui/use-toast';

interface UseTaskManagementOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useTaskManagement(options: UseTaskManagementOptions = {}) {
  const { autoRefresh = false, refreshInterval = 30000 } = options;
  const { toast } = useToast();
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [statistics, setStatistics] = useState<TaskStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch tasks
  const fetchTasks = useCallback(async (filters?: Parameters<typeof TaskService.getTasks>[0]) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await TaskService.getTasks(filters);
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
      toast({
        title: 'Error',
        description: 'Failed to fetch tasks',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Create task
  const createTask = useCallback(async (task: Partial<Task>) => {
    setLoading(true);
    setError(null);
    
    try {
      const newTask = await TaskService.createTask(task);
      setTasks(prev => [newTask, ...prev]);
      
      toast({
        title: 'Success',
        description: 'Task created successfully'
      });
      
      return newTask;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create task';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Update task
  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    setLoading(true);
    setError(null);
    
    try {
      const updatedTask = await TaskService.updateTask(id, updates);
      setTasks(prev => prev.map(t => t.id === id ? updatedTask : t));
      
      toast({
        title: 'Success',
        description: 'Task updated successfully'
      });
      
      return updatedTask;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update task';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Delete task
  const deleteTask = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      await TaskService.deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
      
      toast({
        title: 'Success',
        description: 'Task deleted successfully'
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete task';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Change task status
  const changeTaskStatus = useCallback(async (id: string, status: TaskStatus, reason?: string) => {
    const updates: Partial<Task> = { 
      status,
      metadata: { status_change_reason: reason }
    };
    
    return updateTask(id, updates);
  }, [updateTask]);

  // Add dependency
  const addDependency = useCallback(async (dependency: Omit<TaskDependency, 'id' | 'created_at'>) => {
    setLoading(true);
    setError(null);
    
    try {
      const newDependency = await TaskService.addDependency(dependency);
      
      toast({
        title: 'Success',
        description: 'Dependency added successfully'
      });
      
      return newDependency;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add dependency';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Create task from template
  const createFromTemplate = useCallback(async (templateId: string, overrides?: Partial<Task>) => {
    setLoading(true);
    setError(null);
    
    try {
      const newTask = await TaskService.createTaskFromTemplate(templateId, overrides);
      setTasks(prev => [newTask, ...prev]);
      
      toast({
        title: 'Success',
        description: 'Task created from template successfully'
      });
      
      return newTask;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create task from template';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Fetch templates
  const fetchTemplates = useCallback(async (category?: string) => {
    try {
      const data = await TaskService.getTemplates(category);
      setTemplates(data);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to fetch templates',
        variant: 'destructive'
      });
    }
  }, [toast]);

  // Fetch statistics
  const fetchStatistics = useCallback(async (userId?: string) => {
    try {
      const data = await TaskService.getTaskStatistics(userId);
      setStatistics(data);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to fetch statistics',
        variant: 'destructive'
      });
    }
  }, [toast]);

  // Batch operations
  const batchUpdatePriority = useCallback(async (taskIds: string[], priority: number) => {
    setLoading(true);
    setError(null);
    
    try {
      await TaskService.updateTasksPriority(taskIds, priority);
      
      // Update local state
      setTasks(prev => prev.map(t => 
        taskIds.includes(t.id) ? { ...t, priority } : t
      ));
      
      toast({
        title: 'Success',
        description: `Updated priority for ${taskIds.length} tasks`
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update priorities';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const batchAssignAgent = useCallback(async (taskIds: string[], agentName: string) => {
    setLoading(true);
    setError(null);
    
    try {
      await TaskService.assignTasksToAgent(taskIds, agentName);
      
      // Update local state
      setTasks(prev => prev.map(t => 
        taskIds.includes(t.id) ? { ...t, assigned_agent: agentName } : t
      ));
      
      toast({
        title: 'Success',
        description: `Assigned ${taskIds.length} tasks to ${agentName}`
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign tasks';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchTasks();
      }, refreshInterval);
      
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchTasks]);

  // Initial fetch
  useEffect(() => {
    fetchTasks();
    fetchTemplates();
    fetchStatistics();
  }, [fetchStatistics, fetchTasks, fetchTemplates]);

  return {
    // State
    tasks,
    templates,
    statistics,
    loading,
    error,
    
    // Actions
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    changeTaskStatus,
    addDependency,
    createFromTemplate,
    fetchTemplates,
    fetchStatistics,
    batchUpdatePriority,
    batchAssignAgent,
    
    // Computed values
    overdueTasks: tasks.filter(t => 
      t.due_date && 
      new Date(t.due_date) < new Date() && 
      ![TaskStatus.COMPLETED, TaskStatus.CANCELLED].includes(t.status as TaskStatus)
    ),
    tasksByStatus: tasks.reduce((acc, task) => {
      const status = task.status as TaskStatus;
      if (!acc[status]) acc[status] = [];
      acc[status].push(task);
      return acc;
    }, {} as Record<TaskStatus, Task[]>)
  };
}