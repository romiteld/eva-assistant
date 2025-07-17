# Database Cleanup Analysis: Resume Parsing, Interview Center, and Candidates

## Overview
This document provides a comprehensive analysis of all database elements related to resume parsing, interview center, and candidates/applicants functionality that need to be removed from the eva-assistant codebase.

## Database Tables to Remove

### Core Tables (from initial_schema.sql)
1. **candidates** - Main candidates table with search functionality
   - Has triggers: `audit_trigger_candidates`, `set_timestamp_candidates`, `validate_candidate_data_trigger`
   - Has RLS policies for CRUD operations
   - Referenced by: `recruiter_candidates`, `recruiter_activities`

### Resume Parsing Tables
1. **applicant_profiles** - Stores applicant profile information
   - Has RLS policies for viewing and managing
   - Has trigger: `update_applicant_profiles_updated_at`
   
2. **resume_parsing_queue** - Queue for resume parsing operations
   - References: `applicants` table
   - Has RLS policy for managing parsing

3. **applicants** - Main applicants table
   - References: `job_postings`, `auth.users`, `a2a_agents`
   - Has trigger: `update_applicants_updated_at`
   - Has RLS policy for management

### Interview Center Tables
1. **interview_schedules** - Interview scheduling data
   - References: `applicants`, `job_postings`, `auth.users`, `a2a_agents`
   - Referenced by: `zoom_meetings`, `interview_metrics`
   - Has trigger: `update_interview_schedules_updated_at`
   - Has RLS policies

2. **interview_templates** - Interview question templates
   - References: `auth.users`
   - Has trigger: `update_interview_templates_updated_at`
   - Has RLS policies

3. **interview_metrics** - Interview performance metrics
   - References: `interview_schedules`
   - Has RLS policies

### Job/Recruitment Tables
1. **job_postings** - Job posting information
   - Referenced by: `applicants`, `interview_schedules`, `recruiter_candidates`, `recruiter_activities`, `recruitment_pipeline`
   - Has trigger: `update_job_postings_updated_at`
   - Has RLS policies

2. **recruitment_pipeline** - Recruitment pipeline stages
   - References: `applicant_profiles`, `job_postings`, `auth.users`
   - Has trigger: `update_recruitment_pipeline_updated_at`
   - Has RLS policies

3. **recruitment_agent_metrics** - AI agent metrics for recruitment
   - Has RLS policies

### Related Tables
1. **applicant_activities** - Activity tracking for applicants
   - References: `applicants`, `auth.users`
   - Has RLS policies

2. **applicant_evaluations** - Applicant evaluation records
   - References: `applicants`, `auth.users`
   - Has RLS policies

3. **recruiter_candidates** - Recruiter-candidate relationships
   - References: `candidates`, `job_postings`, `recruiters`
   - Has trigger: `update_recruiter_candidates_updated_at`
   - Has RLS policies

## Dependencies in Other Tables

### Tables with Foreign Keys to Remove
1. **zoom_meetings** - Has FK to `interview_schedules`
2. **twilio_communications** - Has FK to `applicants`
3. **recruiter_activities** - Has FK to `candidates` and `job_postings`
4. **pipeline_stage_history** - Has FK to `applicant_profiles`

## Order of Removal (to handle dependencies)

### Phase 1: Remove Foreign Key Constraints
```sql
-- Remove FKs from dependent tables first
ALTER TABLE zoom_meetings DROP CONSTRAINT zoom_meetings_interview_schedule_id_fkey;
ALTER TABLE twilio_communications DROP CONSTRAINT twilio_communications_applicant_id_fkey;
ALTER TABLE recruiter_activities DROP CONSTRAINT recruiter_activities_candidate_id_fkey;
ALTER TABLE recruiter_activities DROP CONSTRAINT recruiter_activities_job_posting_id_fkey;
ALTER TABLE pipeline_stage_history DROP CONSTRAINT pipeline_stage_history_applicant_id_fkey;
```

### Phase 2: Drop RLS Policies
```sql
-- Drop all RLS policies for tables being removed
DROP POLICY IF EXISTS "Users can manage own candidates" ON candidates;
DROP POLICY IF EXISTS "Users can view own candidates" ON candidates;
DROP POLICY IF EXISTS "Users can insert own candidates" ON candidates;
DROP POLICY IF EXISTS "Users can update own candidates" ON candidates;
DROP POLICY IF EXISTS "Users can delete own candidates" ON candidates;
DROP POLICY IF EXISTS "soft_delete_select_candidates" ON candidates;
-- ... (repeat for all tables)
```

### Phase 3: Drop Triggers
```sql
-- Drop all triggers
DROP TRIGGER IF EXISTS audit_trigger_candidates ON candidates;
DROP TRIGGER IF EXISTS set_timestamp_candidates ON candidates;
DROP TRIGGER IF EXISTS validate_candidate_data_trigger ON candidates;
DROP TRIGGER IF EXISTS update_applicant_profiles_updated_at ON applicant_profiles;
-- ... (repeat for all triggers)
```

### Phase 4: Drop Tables (in dependency order)
```sql
-- Drop dependent tables first
DROP TABLE IF EXISTS interview_metrics CASCADE;
DROP TABLE IF EXISTS applicant_evaluations CASCADE;
DROP TABLE IF EXISTS applicant_activities CASCADE;
DROP TABLE IF EXISTS resume_parsing_queue CASCADE;
DROP TABLE IF EXISTS interview_schedules CASCADE;
DROP TABLE IF EXISTS interview_templates CASCADE;
DROP TABLE IF EXISTS recruiter_candidates CASCADE;
DROP TABLE IF EXISTS recruitment_pipeline CASCADE;
DROP TABLE IF EXISTS recruitment_agent_metrics CASCADE;

-- Then drop main tables
DROP TABLE IF EXISTS applicants CASCADE;
DROP TABLE IF EXISTS applicant_profiles CASCADE;
DROP TABLE IF EXISTS job_postings CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;
```

### Phase 5: Drop Functions
```sql
-- Drop candidate search vector function
DROP FUNCTION IF EXISTS update_candidate_search_vector() CASCADE;
-- Drop candidate validation function
DROP FUNCTION IF EXISTS validate_candidate_data() CASCADE;
```

### Phase 6: Clean up Types
```sql
-- Check if types are used elsewhere before dropping
-- DROP TYPE IF EXISTS candidate_status CASCADE;
```

## Edge Functions to Update

The following Edge Functions reference these tables and need updating:
1. `/supabase/functions/agent-orchestrator/index.ts`
2. `/supabase/functions/_shared/agent-executor.ts`
3. `/supabase/functions/ai-agents/index.ts`
4. `/supabase/functions/websocket-handler/index.ts`

## Additional Considerations

1. **Data Migration**: Before removing, consider if any data needs to be migrated or archived
2. **Frontend Code**: All React components and API routes that interact with these tables need to be removed
3. **AI Agents**: Resume parser and interview center agents need to be removed from the codebase
4. **Types**: TypeScript types for these entities need to be removed
5. **API Routes**: All Next.js API routes handling these entities need removal

## Column Updates in Remaining Tables

After removal, check and update:
1. Remove any columns in zoom_meetings related to interviews
2. Remove any columns in twilio_communications related to applicants
3. Update any JSONB fields that might store references to removed entities