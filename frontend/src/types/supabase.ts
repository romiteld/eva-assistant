// Re-export Database types from the generated database types
export type { Database } from './database'

// Export common table types for convenience
import type { Database } from './database'

export type Tables = Database['public']['Tables']
export type Enums = Database['public']['Enums']

// Common table row types
export type Profile = Tables['profiles']['Row']
export type ProfileInsert = Tables['profiles']['Insert']
export type ProfileUpdate = Tables['profiles']['Update']

export type Task = Tables['tasks']['Row']
export type TaskInsert = Tables['tasks']['Insert']
export type TaskUpdate = Tables['tasks']['Update']

// TODO: Add these tables to database schema
// export type Lead = Tables['leads']['Row']
// export type LeadInsert = Tables['leads']['Insert']
// export type LeadUpdate = Tables['leads']['Update']

// export type Content = Tables['content']['Row']
// export type ContentInsert = Tables['content']['Insert']
// export type ContentUpdate = Tables['content']['Update']

// export type Campaign = Tables['campaigns']['Row']
// export type CampaignInsert = Tables['campaigns']['Insert']
// export type CampaignUpdate = Tables['campaigns']['Update']

// export type Interview = Tables['interviews']['Row']
// export type InterviewInsert = Tables['interviews']['Insert']
// export type InterviewUpdate = Tables['interviews']['Update']

// export type Application = Tables['applications']['Row']
// export type ApplicationInsert = Tables['applications']['Insert']
// export type ApplicationUpdate = Tables['applications']['Update']

export type OAuthToken = Tables['oauth_tokens']['Row']
export type OAuthTokenInsert = Tables['oauth_tokens']['Insert']
export type OAuthTokenUpdate = Tables['oauth_tokens']['Update']

// Email templates are views, not tables
export type EmailTemplate = Database['public']['Views']['email_templates']['Row']
export type EmailTemplateInsert = Database['public']['Views']['email_templates']['Insert']
export type EmailTemplateUpdate = Database['public']['Views']['email_templates']['Update']

export type EmailTemplateUsage = Database['public']['Views']['email_template_usage']['Row']
export type EmailTemplateUsageInsert = Database['public']['Views']['email_template_usage']['Insert']
export type EmailTemplateUsageUpdate = Database['public']['Views']['email_template_usage']['Update']

// Enum types
export type TaskStatus = Enums['task_status']
export type TemplateCategory = Enums['template_category']
// TODO: Add these enums to database schema
// export type TaskPriority = Enums['task_priority']
// export type LeadStatus = Enums['lead_status']
// export type ContentStatus = Enums['content_status']
// export type CampaignStatus = Enums['campaign_status']
// export type InterviewStatus = Enums['interview_status']
// export type ApplicationStatus = Enums['application_status']

// Helper types
export type { Json } from './database'