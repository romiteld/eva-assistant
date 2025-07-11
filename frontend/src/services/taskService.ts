// Task Management Service

import { createClient } from '@/lib/supabase/browser';

const supabase = createClient();
import { 
  Task, 
  TaskStatus, 
  TaskDependency, 
  TaskTemplate, 
  TaskStatusTransition,
  TaskWithDependencies,
  TaskStatistics,
  TASK_VALIDATION,
  VALID_STATUS_TRANSITIONS
} from '@/types/task';

export class TaskService {
  // Task CRUD operations
  static async createTask(task: Partial<Task>): Promise<Task> {
    this.validateTask(task);
    
    const { data, error } = await supabase
      .from('tasks')
      .insert(task)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    // Validate status transitions if status is being updated
    if (updates.status) {
      const currentTask = await this.getTask(id);
      this.validateStatusTransition(currentTask.status, updates.status);
    }
    
    this.validateTask(updates);
    
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getTask(id: string): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getTasks(filters?: {
    status?: TaskStatus;
    assigned_agent?: string;
    category?: string;
    tags?: string[];
    parent_task_id?: string;
  }): Promise<Task[]> {
    let query = supabase.from('tasks').select('*');
    
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.assigned_agent) {
      query = query.eq('assigned_agent', filters.assigned_agent);
    }
    if (filters?.category) {
      query = query.eq('category', filters.category);
    }
    if (filters?.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }
    if (filters?.parent_task_id !== undefined) {
      query = filters.parent_task_id 
        ? query.eq('parent_task_id', filters.parent_task_id)
        : query.is('parent_task_id', null);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  static async deleteTask(id: string): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // Task dependencies
  static async addDependency(dependency: Omit<TaskDependency, 'id' | 'created_at'>): Promise<TaskDependency> {
    const { data, error } = await supabase
      .from('task_dependencies')
      .insert(dependency)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async removeDependency(id: string): Promise<void> {
    const { error } = await supabase
      .from('task_dependencies')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  static async getTaskDependencies(taskId: string): Promise<TaskDependency[]> {
    const { data, error } = await supabase
      .from('task_dependencies')
      .select('*')
      .or(`task_id.eq.${taskId},depends_on_task_id.eq.${taskId}`);
    
    if (error) throw error;
    return data;
  }

  static async getTaskWithDependencies(id: string): Promise<TaskWithDependencies> {
    const { data, error } = await supabase
      .from('v_tasks_with_dependencies')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  // Task templates
  static async createTemplate(template: Omit<TaskTemplate, 'id' | 'created_at' | 'updated_at' | 'usage_count'>): Promise<TaskTemplate> {
    const { data, error } = await supabase
      .from('task_templates')
      .insert(template)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getTemplates(category?: string): Promise<TaskTemplate[]> {
    let query = supabase
      .from('task_templates')
      .select('*')
      .eq('is_active', true);
    
    if (category) {
      query = query.eq('category', category);
    }
    
    const { data, error } = await query.order('usage_count', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  static async createTaskFromTemplate(templateId: string, overrides?: Partial<Task>): Promise<Task> {
    // Get template
    const { data: template, error: templateError } = await supabase
      .from('task_templates')
      .select('*')
      .eq('id', templateId)
      .single();
    
    if (templateError) throw templateError;
    
    // Create task from template
    const taskData = {
      ...template.template_data,
      ...overrides
    };
    
    const task = await this.createTask(taskData);
    
    // Update template usage count
    await supabase
      .from('task_templates')
      .update({ usage_count: template.usage_count + 1 })
      .eq('id', templateId);
    
    return task;
  }

  // Status transitions
  static async getTaskHistory(taskId: string): Promise<TaskStatusTransition[]> {
    const { data, error } = await supabase
      .from('task_status_transitions')
      .select('*')
      .eq('task_id', taskId)
      .order('transitioned_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  // Statistics
  static async getTaskStatistics(userId?: string): Promise<TaskStatistics> {
    let query = supabase.from('v_task_statistics').select('*');
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.single();
    
    if (error) throw error;
    return data;
  }

  // Batch operations
  static async updateTasksPriority(taskIds: string[], priority: number): Promise<void> {
    if (priority < TASK_VALIDATION.PRIORITY_MIN || priority > TASK_VALIDATION.PRIORITY_MAX) {
      throw new Error(`Priority must be between ${TASK_VALIDATION.PRIORITY_MIN} and ${TASK_VALIDATION.PRIORITY_MAX}`);
    }
    
    const { error } = await supabase
      .from('tasks')
      .update({ priority })
      .in('id', taskIds);
    
    if (error) throw error;
  }

  static async assignTasksToAgent(taskIds: string[], agentName: string): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .update({ assigned_agent: agentName })
      .in('id', taskIds);
    
    if (error) throw error;
  }

  // Validation methods
  private static validateTask(task: Partial<Task>): void {
    if (task.title && task.title.length > TASK_VALIDATION.TITLE_MAX_LENGTH) {
      throw new Error(`Title must be less than ${TASK_VALIDATION.TITLE_MAX_LENGTH} characters`);
    }
    
    if (task.description && task.description.length > TASK_VALIDATION.DESCRIPTION_MAX_LENGTH) {
      throw new Error(`Description must be less than ${TASK_VALIDATION.DESCRIPTION_MAX_LENGTH} characters`);
    }
    
    if (task.priority !== undefined) {
      if (task.priority < TASK_VALIDATION.PRIORITY_MIN || task.priority > TASK_VALIDATION.PRIORITY_MAX) {
        throw new Error(`Priority must be between ${TASK_VALIDATION.PRIORITY_MIN} and ${TASK_VALIDATION.PRIORITY_MAX}`);
      }
    }
    
    if (task.tags) {
      if (task.tags.length > TASK_VALIDATION.TAGS_MAX_COUNT) {
        throw new Error(`Cannot have more than ${TASK_VALIDATION.TAGS_MAX_COUNT} tags`);
      }
      
      for (const tag of task.tags) {
        if (tag.length > TASK_VALIDATION.TAG_MAX_LENGTH) {
          throw new Error(`Tag "${tag}" exceeds maximum length of ${TASK_VALIDATION.TAG_MAX_LENGTH} characters`);
        }
      }
    }
  }

  private static validateStatusTransition(from: TaskStatus, to: TaskStatus): void {
    const validTransitions = VALID_STATUS_TRANSITIONS[from];
    
    if (!validTransitions.includes(to)) {
      throw new Error(`Invalid status transition from ${from} to ${to}`);
    }
  }

  // Utility methods
  static async getOverdueTasks(): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .lt('due_date', new Date().toISOString())
      .in('status', [TaskStatus.PENDING, TaskStatus.IN_PROGRESS])
      .order('due_date', { ascending: true });
    
    if (error) throw error;
    return data;
  }

  static async getTasksByDueDate(startDate: Date, endDate: Date): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .gte('due_date', startDate.toISOString())
      .lte('due_date', endDate.toISOString())
      .order('due_date', { ascending: true });
    
    if (error) throw error;
    return data;
  }

  static async searchTasks(searchTerm: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }
}