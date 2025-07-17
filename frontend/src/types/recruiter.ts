import { z } from 'zod';

// Enums
export const CompanyTypeEnum = z.enum(['agency', 'independent', 'internal', 'executive_search']);
export const PerformanceTierEnum = z.enum(['platinum', 'gold', 'silver', 'bronze']);
export const RelationshipTypeEnum = z.enum(['sourced', 'submitted', 'interviewing', 'offered', 'placed', 'rejected', 'withdrawn']);
export const StatusEnum = z.enum(['active', 'inactive', 'completed']);
export const ActivityTypeEnum = z.enum(['call', 'email', 'meeting', 'submission', 'offer_negotiation', 'placement', 'note']);
export const PlacementOutcomeEnum = z.enum(['successful', 'guarantee_period', 'terminated', 'resigned']);
export const PeriodTypeEnum = z.enum(['monthly', 'quarterly', 'yearly']);
export const RankingTypeEnum = z.enum(['overall', 'by_revenue', 'by_placements', 'by_quality', 'by_speed']);

// Commission structure schema
export const CommissionStructureSchema = z.object({
  type: z.enum(['percentage', 'flat_fee', 'tiered']),
  rate: z.number().optional(),
  minimum_fee: z.number().optional(),
  tiers: z.array(z.object({
    min_revenue: z.number(),
    max_revenue: z.number().optional(),
    rate: z.number()
  })).optional()
});

// Recruiter schema
export const RecruiterSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  full_name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  linkedin_url: z.string().url().nullable(),
  company_name: z.string().nullable(),
  company_type: CompanyTypeEnum.nullable(),
  specializations: z.array(z.string()),
  industry_focus: z.array(z.string()),
  geographic_coverage: z.array(z.string()),
  experience_years: z.number().int().nullable(),
  commission_structure: CommissionStructureSchema.nullable(),
  performance_tier: PerformanceTierEnum.nullable(),
  is_active: z.boolean().default(true),
  notes: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

// Recruiter metrics schema
export const RecruiterMetricsSchema = z.object({
  id: z.string().uuid(),
  recruiter_id: z.string().uuid(),
  period_start: z.string(),
  period_end: z.string(),
  period_type: PeriodTypeEnum,
  
  // Placement metrics
  placements_count: z.number().int().default(0),
  offers_extended: z.number().int().default(0),
  offers_accepted: z.number().int().default(0),
  
  // Financial metrics
  total_revenue: z.number().default(0),
  average_placement_fee: z.number().nullable(),
  highest_placement_fee: z.number().nullable(),
  
  // Performance ratios
  offer_acceptance_ratio: z.number().nullable(),
  fill_rate: z.number().nullable(),
  
  // Time metrics
  time_to_fill_avg: z.number().int().nullable(),
  time_to_submit_avg: z.number().int().nullable(),
  
  // Quality metrics
  placement_retention_rate: z.number().nullable(),
  client_satisfaction_score: z.number().min(0).max(10).nullable(),
  
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});


// Recruiter activity schema
export const RecruiterActivitySchema = z.object({
  id: z.string().uuid(),
  recruiter_id: z.string().uuid(),
  activity_type: ActivityTypeEnum,
  activity_date: z.string().datetime(),
  
  // Related entities
  contact_id: z.string().uuid().nullable(),
  
  // Activity details
  duration_minutes: z.number().int().nullable(),
  outcome: z.string().nullable(),
  notes: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  
  created_at: z.string().datetime()
});

// Recruiter ranking schema
export const RecruiterRankingSchema = z.object({
  id: z.string().uuid(),
  period_start: z.string(),
  period_end: z.string(),
  ranking_type: RankingTypeEnum,
  
  rankings: z.array(z.object({
    recruiter_id: z.string().uuid(),
    rank: z.number().int(),
    score: z.number(),
    metrics: z.record(z.string(), z.unknown())
  })),
  
  // Benchmark statistics
  avg_placements: z.number().nullable(),
  avg_revenue: z.number().nullable(),
  avg_fill_rate: z.number().nullable(),
  avg_time_to_fill: z.number().int().nullable(),
  
  created_at: z.string().datetime()
});

// Recruiter dashboard view schema
export const RecruiterDashboardSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string(),
  email: z.string().email(),
  company_name: z.string().nullable(),
  performance_tier: PerformanceTierEnum.nullable(),
  is_active: z.boolean(),
  recent_placements: z.number().int(),
  recent_revenue: z.number(),
  active_contacts: z.number().int(),
  last_activity: z.string().datetime()
});

// Type exports
export type Recruiter = z.infer<typeof RecruiterSchema>;
export type RecruiterMetrics = z.infer<typeof RecruiterMetricsSchema>;
export type RecruiterActivity = z.infer<typeof RecruiterActivitySchema>;
export type RecruiterRanking = z.infer<typeof RecruiterRankingSchema>;
export type RecruiterDashboard = z.infer<typeof RecruiterDashboardSchema>;
export type CommissionStructure = z.infer<typeof CommissionStructureSchema>;

// Form schemas for creating/updating
export const RecruiterFormSchema = RecruiterSchema.omit({
  id: true,
  created_at: true,
  updated_at: true
});


export const RecruiterActivityFormSchema = RecruiterActivitySchema.omit({
  id: true,
  created_at: true
});

// Type exports for forms
export type RecruiterForm = z.infer<typeof RecruiterFormSchema>;
export type RecruiterActivityForm = z.infer<typeof RecruiterActivityFormSchema>;

// Search/filter schemas
export const RecruiterSearchSchema = z.object({
  query: z.string().optional(),
  company_type: CompanyTypeEnum.optional(),
  performance_tier: PerformanceTierEnum.optional(),
  specializations: z.array(z.string()).optional(),
  industry_focus: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
  min_experience_years: z.number().int().optional(),
  max_experience_years: z.number().int().optional()
});

export const RecruiterMetricsFilterSchema = z.object({
  recruiter_id: z.string().uuid().optional(),
  period_type: PeriodTypeEnum.optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  min_revenue: z.number().optional(),
  min_placements: z.number().int().optional()
});

export type RecruiterSearch = z.infer<typeof RecruiterSearchSchema>;
export type RecruiterMetricsFilter = z.infer<typeof RecruiterMetricsFilterSchema>;