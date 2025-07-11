export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Enums
export enum TaskStatus {
  pending = 'pending',
  in_progress = 'in_progress',
  completed = 'completed',
  cancelled = 'cancelled'
}

export enum AgentStatus {
  available = 'available',
  busy = 'busy',
  offline = 'offline',
  overloaded = 'overloaded'
}

export enum AgentHealthStatus {
  healthy = 'healthy',
  degraded = 'degraded',
  unhealthy = 'unhealthy'
}

export enum AgentTaskStatus {
  assigned = 'assigned',
  in_progress = 'in_progress',
  completed = 'completed',
  failed = 'failed',
  cancelled = 'cancelled'
}

export enum ChatMessageRole {
  user = 'user',
  assistant = 'assistant',
  function = 'function'
}

export enum WorkflowStatus {
  draft = 'draft',
  active = 'active',
  paused = 'paused',
  completed = 'completed',
  failed = 'failed',
  cancelled = 'cancelled'
}

export enum ErrorSeverity {
  low = 'low',
  medium = 'medium',
  high = 'high',
  critical = 'critical'
}

export enum TemplateCategory {
  recruiting = 'recruiting',
  follow_up = 'follow_up',
  scheduling = 'scheduling',
  welcome = 'welcome',
  rejection = 'rejection',
  offer = 'offer',
  referral = 'referral',
  networking = 'networking',
  custom = 'custom'
}

// Helper types
export type Timestamp = string
export type UUID = string

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name?: string
          avatar_url?: string
          preferences?: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name?: string
          avatar_url?: string
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          avatar_url?: string
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: UUID
          email: string
          created_at: Timestamp
          updated_at: Timestamp
          role?: string
          full_name?: string
        }
        Insert: {
          id?: UUID
          email: string
          created_at?: Timestamp
          updated_at?: Timestamp
          role?: string
          full_name?: string
        }
        Update: {
          id?: UUID
          email?: string
          created_at?: Timestamp
          updated_at?: Timestamp
          role?: string
          full_name?: string
        }
      }
      tasks: {
        Row: {
          id: UUID
          title: string
          description?: string
          status: TaskStatus
          priority: number
          created_at: Timestamp
          updated_at: Timestamp
          user_id: UUID
          due_date?: Timestamp
          labels?: string[]
          agent_type?: string
          assigned_agent?: string
          metadata?: Json
          parent_task_id?: UUID
          estimated_hours?: number
          actual_hours?: number
          completion_percentage: number
          tags: string[]
          category?: string
          is_recurring: boolean
          recurrence_pattern?: Json
          next_recurrence_date?: Timestamp
          completed_at?: Timestamp
          cancelled_at?: Timestamp
          started_at?: Timestamp
        }
        Insert: {
          id?: UUID
          title: string
          description?: string
          status?: TaskStatus
          priority?: number
          created_at?: Timestamp
          updated_at?: Timestamp
          user_id: UUID
          due_date?: Timestamp
          labels?: string[]
          agent_type?: string
          assigned_agent?: string
          metadata?: Json
          parent_task_id?: UUID
          estimated_hours?: number
          actual_hours?: number
          completion_percentage?: number
          tags?: string[]
          category?: string
          is_recurring?: boolean
          recurrence_pattern?: Json
          next_recurrence_date?: Timestamp
          completed_at?: Timestamp
          cancelled_at?: Timestamp
          started_at?: Timestamp
        }
        Update: {
          id?: UUID
          title?: string
          description?: string
          status?: TaskStatus
          priority?: number
          created_at?: Timestamp
          updated_at?: Timestamp
          user_id?: UUID
          due_date?: Timestamp
          labels?: string[]
          agent_type?: string
          assigned_agent?: string
          metadata?: Json
          parent_task_id?: UUID
          estimated_hours?: number
          actual_hours?: number
          completion_percentage?: number
          tags?: string[]
          category?: string
          is_recurring?: boolean
          recurrence_pattern?: Json
          next_recurrence_date?: Timestamp
          completed_at?: Timestamp
          cancelled_at?: Timestamp
          started_at?: Timestamp
        }
      }
      agents: {
        Row: {
          id: UUID
          name: string
          type: string
          status: AgentStatus
          max_concurrent_tasks: number
          current_tasks: number
          total_capacity: number
          current_load: number
          average_task_duration?: number
          success_rate: number
          total_tasks_completed: number
          total_tasks_failed: number
          cpu_usage: number
          memory_usage: number
          capabilities: Json
          specializations: Json
          config: Json
          priority: number
          created_at: Timestamp
          updated_at: Timestamp
          last_active_at: Timestamp
          last_health_check?: Timestamp
          health_status: AgentHealthStatus
        }
        Insert: {
          id?: UUID
          name: string
          type: string
          status?: AgentStatus
          max_concurrent_tasks?: number
          current_tasks?: number
          total_capacity?: number
          current_load?: number
          average_task_duration?: number
          success_rate?: number
          total_tasks_completed?: number
          total_tasks_failed?: number
          cpu_usage?: number
          memory_usage?: number
          capabilities?: Json
          specializations?: Json
          config?: Json
          priority?: number
          created_at?: Timestamp
          updated_at?: Timestamp
          last_active_at?: Timestamp
          last_health_check?: Timestamp
          health_status?: AgentHealthStatus
        }
        Update: {
          id?: UUID
          name?: string
          type?: string
          status?: AgentStatus
          max_concurrent_tasks?: number
          current_tasks?: number
          total_capacity?: number
          current_load?: number
          average_task_duration?: number
          success_rate?: number
          total_tasks_completed?: number
          total_tasks_failed?: number
          cpu_usage?: number
          memory_usage?: number
          capabilities?: Json
          specializations?: Json
          config?: Json
          priority?: number
          created_at?: Timestamp
          updated_at?: Timestamp
          last_active_at?: Timestamp
          last_health_check?: Timestamp
          health_status?: AgentHealthStatus
        }
      }
      agent_tasks: {
        Row: {
          id: UUID
          agent_id: UUID
          task_id: UUID
          task_type: string
          priority: number
          estimated_duration?: number
          actual_duration?: number
          status: AgentTaskStatus
          assigned_at: Timestamp
          started_at?: Timestamp
          completed_at?: Timestamp
          cpu_usage?: number
          memory_usage?: number
          result?: Json
          error?: Json
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: {
          id?: UUID
          agent_id: UUID
          task_id: UUID
          task_type: string
          priority?: number
          estimated_duration?: number
          actual_duration?: number
          status?: AgentTaskStatus
          assigned_at?: Timestamp
          started_at?: Timestamp
          completed_at?: Timestamp
          cpu_usage?: number
          memory_usage?: number
          result?: Json
          error?: Json
          created_at?: Timestamp
          updated_at?: Timestamp
        }
        Update: {
          id?: UUID
          agent_id?: UUID
          task_id?: UUID
          task_type?: string
          priority?: number
          estimated_duration?: number
          actual_duration?: number
          status?: AgentTaskStatus
          assigned_at?: Timestamp
          started_at?: Timestamp
          completed_at?: Timestamp
          cpu_usage?: number
          memory_usage?: number
          result?: Json
          error?: Json
          created_at?: Timestamp
          updated_at?: Timestamp
        }
      }
      agent_metrics: {
        Row: {
          id: UUID
          agent_id: UUID
          timestamp: Timestamp
          load_percentage: number
          active_tasks: number
          completed_tasks: number
          failed_tasks: number
          cpu_usage?: number
          memory_usage?: number
          average_response_time?: number
          success_rate?: number
          created_at: Timestamp
        }
        Insert: {
          id?: UUID
          agent_id: UUID
          timestamp?: Timestamp
          load_percentage: number
          active_tasks: number
          completed_tasks: number
          failed_tasks: number
          cpu_usage?: number
          memory_usage?: number
          average_response_time?: number
          success_rate?: number
          created_at?: Timestamp
        }
        Update: {
          id?: UUID
          agent_id?: UUID
          timestamp?: Timestamp
          load_percentage?: number
          active_tasks?: number
          completed_tasks?: number
          failed_tasks?: number
          cpu_usage?: number
          memory_usage?: number
          average_response_time?: number
          success_rate?: number
          created_at?: Timestamp
        }
      }
      chat_sessions: {
        Row: {
          id: UUID
          user_id: UUID
          title: string
          model: string
          created_at: Timestamp
          updated_at: Timestamp
          metadata: Json
        }
        Insert: {
          id?: UUID
          user_id: UUID
          title: string
          model?: string
          created_at?: Timestamp
          updated_at?: Timestamp
          metadata?: Json
        }
        Update: {
          id?: UUID
          user_id?: UUID
          title?: string
          model?: string
          created_at?: Timestamp
          updated_at?: Timestamp
          metadata?: Json
        }
      }
      chat_messages: {
        Row: {
          id: UUID
          session_id: UUID
          role: ChatMessageRole
          content: string
          function_call?: Json
          function_result?: Json
          timestamp: Timestamp
          metadata: Json
          created_at: Timestamp
        }
        Insert: {
          id?: UUID
          session_id: UUID
          role: ChatMessageRole
          content: string
          function_call?: Json
          function_result?: Json
          timestamp: Timestamp
          metadata?: Json
          created_at?: Timestamp
        }
        Update: {
          id?: UUID
          session_id?: UUID
          role?: ChatMessageRole
          content?: string
          function_call?: Json
          function_result?: Json
          timestamp?: Timestamp
          metadata?: Json
          created_at?: Timestamp
        }
      }
      workflows: {
        Row: {
          id: UUID
          user_id: UUID
          name: string
          description?: string
          status: WorkflowStatus
          steps: Json
          current_step?: number
          metadata?: Json
          created_at: Timestamp
          updated_at: Timestamp
          started_at?: Timestamp
          completed_at?: Timestamp
        }
        Insert: {
          id?: UUID
          user_id: UUID
          name: string
          description?: string
          status?: WorkflowStatus
          steps: Json
          current_step?: number
          metadata?: Json
          created_at?: Timestamp
          updated_at?: Timestamp
          started_at?: Timestamp
          completed_at?: Timestamp
        }
        Update: {
          id?: UUID
          user_id?: UUID
          name?: string
          description?: string
          status?: WorkflowStatus
          steps?: Json
          current_step?: number
          metadata?: Json
          created_at?: Timestamp
          updated_at?: Timestamp
          started_at?: Timestamp
          completed_at?: Timestamp
        }
      }
      error_logs: {
        Row: {
          id: UUID
          user_id?: UUID
          error_message: string
          error_code?: string
          error_stack?: string
          severity: ErrorSeverity
          context?: Json
          resolved: boolean
          resolved_at?: Timestamp
          created_at: Timestamp
        }
        Insert: {
          id?: UUID
          user_id?: UUID
          error_message: string
          error_code?: string
          error_stack?: string
          severity?: ErrorSeverity
          context?: Json
          resolved?: boolean
          resolved_at?: Timestamp
          created_at?: Timestamp
        }
        Update: {
          id?: UUID
          user_id?: UUID
          error_message?: string
          error_code?: string
          error_stack?: string
          severity?: ErrorSeverity
          context?: Json
          resolved?: boolean
          resolved_at?: Timestamp
          created_at?: Timestamp
        }
      }
      recruiters: {
        Row: {
          id: UUID
          user_id: UUID
          name: string
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: {
          id?: UUID
          user_id: UUID
          name: string
          created_at?: Timestamp
          updated_at?: Timestamp
        }
        Update: {
          id?: UUID
          user_id?: UUID
          name?: string
          created_at?: Timestamp
          updated_at?: Timestamp
        }
      }
      oauth_tokens: {
        Row: {
          id: UUID
          user_id: UUID
          provider: string
          access_token: string
          refresh_token?: string
          expires_at?: Timestamp
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: {
          id?: UUID
          user_id: UUID
          provider: string
          access_token: string
          refresh_token?: string
          expires_at?: Timestamp
          created_at?: Timestamp
          updated_at?: Timestamp
        }
        Update: {
          id?: UUID
          user_id?: UUID
          provider?: string
          access_token?: string
          refresh_token?: string
          expires_at?: Timestamp
          created_at?: Timestamp
          updated_at?: Timestamp
        }
      }
    }
    Views: {
      agent_workload_summary: {
        Row: {
          id: UUID
          name: string
          type: string
          status: AgentStatus
          current_tasks: number
          max_concurrent_tasks: number
          current_load: number
          success_rate: number
          health_status: AgentHealthStatus
          tasks_last_hour?: number
          avg_duration_last_hour?: number
        }
      }
      email_templates: {
        Row: {
          id: UUID
          user_id: UUID
          name: string
          subject: string
          body: string
          category: TemplateCategory
          variables: Json
          tags: string[]
          is_active: boolean
          usage_count: number
          last_used_at: Timestamp | null
          metadata: Json
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: {
          id?: UUID
          user_id: UUID
          name: string
          subject: string
          body: string
          category: TemplateCategory
          variables?: Json
          tags?: string[]
          is_active?: boolean
          usage_count?: number
          last_used_at?: Timestamp | null
          metadata?: Json
          created_at?: Timestamp
          updated_at?: Timestamp
        }
        Update: {
          id?: UUID
          user_id?: UUID
          name?: string
          subject?: string
          body?: string
          category?: TemplateCategory
          variables?: Json
          tags?: string[]
          is_active?: boolean
          usage_count?: number
          last_used_at?: Timestamp | null
          metadata?: Json
          created_at?: Timestamp
          updated_at?: Timestamp
        }
      }
      email_template_usage: {
        Row: {
          id: UUID
          template_id: UUID
          user_id: UUID
          recipient_email: string
          recipient_name: string | null
          subject: string
          body: string
          variables_used: Json
          sent_at: Timestamp
          status: string
          metadata: Json
        }
        Insert: {
          id?: UUID
          template_id: UUID
          user_id: UUID
          recipient_email: string
          recipient_name?: string | null
          subject: string
          body: string
          variables_used?: Json
          sent_at?: Timestamp
          status?: string
          metadata?: Json
        }
        Update: {
          id?: UUID
          template_id?: UUID
          user_id?: UUID
          recipient_email?: string
          recipient_name?: string | null
          subject?: string
          body?: string
          variables_used?: Json
          sent_at?: Timestamp
          status?: string
          metadata?: Json
        }
      }
    }
    Functions: {
      update_agent_load: {
        Args: Record<string, never>
        Returns: void
      }
      calculate_agent_score: {
        Args: {
          p_agent_id: UUID
          p_task_type: string
          p_required_capabilities?: Json
        }
        Returns: number
      }
      update_updated_at_column: {
        Args: Record<string, never>
        Returns: void
      }
    }
    Enums: {
      task_status: TaskStatus
      agent_status: AgentStatus
      agent_health_status: AgentHealthStatus
      agent_task_status: AgentTaskStatus
      chat_message_role: ChatMessageRole
      workflow_status: WorkflowStatus
      error_severity: ErrorSeverity
      template_category: TemplateCategory
    }
  }
}