// Task Management Types

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  priority: number; // 0-10
  status: TaskStatus;
  due_date?: string;
  assigned_agent?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  
  // New fields
  parent_task_id?: string;
  estimated_hours?: number;
  actual_hours?: number;
  completion_percentage: number;
  tags: string[];
  category?: string;
  is_recurring: boolean;
  recurrence_pattern?: RecurrencePattern;
  next_recurrence_date?: string;
  completed_at?: string;
  cancelled_at?: string;
  started_at?: string;
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: DependencyType;
  created_at: string;
  created_by: string;
}

export enum DependencyType {
  BLOCKS = 'blocks',
  SUBTASK = 'subtask',
  RELATED = 'related'
}

export interface TaskTemplate {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  template_data: Partial<Task>;
  category?: string;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface TaskStatusTransition {
  id: string;
  task_id: string;
  from_status?: TaskStatus;
  to_status: TaskStatus;
  transitioned_by: string;
  transition_reason?: string;
  transitioned_at: string;
}

export interface TaskWithDependencies extends Task {
  dependency_count: number;
  dependent_count: number;
  depends_on: string[];
  dependents: string[];
}

export interface TaskStatistics {
  user_id: string;
  total_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  completed_tasks: number;
  cancelled_tasks: number;
  overdue_tasks: number;
  avg_completion_hours: number;
}

// Validation schemas
export const TASK_VALIDATION = {
  PRIORITY_MIN: 0,
  PRIORITY_MAX: 10,
  TITLE_MAX_LENGTH: 255,
  DESCRIPTION_MAX_LENGTH: 5000,
  TAGS_MAX_COUNT: 20,
  TAG_MAX_LENGTH: 50
};

// Status transition rules
export const VALID_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.PENDING]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.PENDING],
  [TaskStatus.COMPLETED]: [], // Cannot transition from completed
  [TaskStatus.CANCELLED]: []  // Cannot transition from cancelled
};