import { z } from 'zod';

// Agent types
export enum AgentType {
  SCRAPING = 'scraping',
  ANALYSIS = 'analysis',
  COMMUNICATION = 'communication',
  CALENDAR = 'calendar',
  CONTENT = 'content',
  DATA = 'data',
  WORKFLOW = 'workflow',
  RECRUITER_INTEL = 'recruiter_intel',
  DEAL_AUTOMATION = 'deal_automation',
}

// Message types
export enum MessageType {
  REQUEST = 'request',
  RESPONSE = 'response',
  EVENT = 'event',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
}

// Base message schema
export const BaseMessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string().optional(),
  type: z.nativeEnum(MessageType),
  timestamp: z.number(),
  correlationId: z.string().optional(),
});

// Request message schema
export const RequestMessageSchema = BaseMessageSchema.extend({
  type: z.literal(MessageType.REQUEST),
  action: z.string(),
  payload: z.any(),
  timeout: z.number().optional(),
});

// Response message schema
export const ResponseMessageSchema = BaseMessageSchema.extend({
  type: z.literal(MessageType.RESPONSE),
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
});

// Event message schema
export const EventMessageSchema = BaseMessageSchema.extend({
  type: z.literal(MessageType.EVENT),
  event: z.string(),
  data: z.any(),
});

// Error message schema
export const ErrorMessageSchema = BaseMessageSchema.extend({
  type: z.literal(MessageType.ERROR),
  error: z.string(),
  stack: z.string().optional(),
  code: z.string().optional(),
});

// Agent state schema
export const AgentStateSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(AgentType),
  status: z.enum(['idle', 'busy', 'error', 'offline']),
  capabilities: z.array(z.string()),
  metadata: z.record(z.string(), z.any()).optional(),
  lastHeartbeat: z.number(),
});

// Workflow state schema
export const WorkflowStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
  currentStep: z.string().optional(),
  steps: z.array(z.object({
    id: z.string(),
    agent: z.nativeEnum(AgentType),
    action: z.string(),
    status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
    input: z.any(),
    output: z.any().optional(),
    error: z.string().optional(),
    startTime: z.number().optional(),
    endTime: z.number().optional(),
  })),
  context: z.record(z.string(), z.any()),
  startTime: z.number(),
  endTime: z.number().optional(),
  error: z.string().optional(),
});

// Type exports
export type BaseMessage = z.infer<typeof BaseMessageSchema>;
export type RequestMessage = z.infer<typeof RequestMessageSchema>;
export type ResponseMessage = z.infer<typeof ResponseMessageSchema>;
export type EventMessage = z.infer<typeof EventMessageSchema>;
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;
export type AgentState = z.infer<typeof AgentStateSchema>;
export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

// Alias for backward compatibility
export type Message = BaseMessage;
export type AgentMessage = BaseMessage;

// Agent capability definitions
export const AgentCapabilities = {
  [AgentType.SCRAPING]: [
    'scrape_url',
    'batch_scrape',
    'map_website',
    'search_web',
    'extract_data',
    'deep_research',
  ],
  [AgentType.ANALYSIS]: [
    'analyze_text',
    'summarize',
    'extract_entities',
    'sentiment_analysis',
    'generate_insights',
    'answer_questions',
  ],
  [AgentType.COMMUNICATION]: [
    'send_email',
    'send_sms',
    'make_call',
    'schedule_call',
    'get_email_history',
    'get_sms_history',
  ],
  [AgentType.CALENDAR]: [
    'create_event',
    'update_event',
    'delete_event',
    'get_events',
    'find_free_slots',
    'schedule_meeting',
  ],
  [AgentType.CONTENT]: [
    'create_post',
    'schedule_post',
    'generate_content',
    'analyze_engagement',
    'get_analytics',
    'manage_campaigns',
  ],
  [AgentType.DATA]: [
    'query_database',
    'insert_data',
    'update_data',
    'delete_data',
    'backup_data',
    'analyze_data',
  ],
  [AgentType.WORKFLOW]: [
    'orchestrate',
    'coordinate',
    'monitor',
    'retry',
    'rollback',
    'report',
  ],
  [AgentType.RECRUITER_INTEL]: [
    'analyze_recruiter_performance',
    'generate_executive_summary',
    'predict_performance',
    'identify_top_performers',
    'detect_anomalies',
    'recommend_actions',
    'natural_language_query',
    'create_alert',
    'benchmark_analysis',
  ],
} as const;

// Agent action interfaces
export interface AgentAction {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<any>;
  outputSchema: z.ZodSchema<any>;
  timeout?: number;
}

export interface AgentCapability {
  actions: Record<string, AgentAction>;
  events: string[];
}