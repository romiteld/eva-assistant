-- Migration: Remove Candidate, Resume Parser, and Interview Center Features
-- This migration removes all database elements related to these deprecated features

-- Step 1: Drop foreign key constraints from dependent tables
ALTER TABLE IF EXISTS zoom_meetings DROP CONSTRAINT IF EXISTS zoom_meetings_interview_schedule_id_fkey;
ALTER TABLE IF EXISTS twilio_communications DROP CONSTRAINT IF EXISTS twilio_communications_applicant_id_fkey;
ALTER TABLE IF EXISTS recruiter_activities DROP CONSTRAINT IF EXISTS recruiter_activities_candidate_id_fkey;
ALTER TABLE IF EXISTS recruiter_activities DROP CONSTRAINT IF EXISTS recruiter_activities_job_posting_id_fkey;
ALTER TABLE IF EXISTS pipeline_stage_history DROP CONSTRAINT IF EXISTS pipeline_stage_history_applicant_id_fkey;
ALTER TABLE IF EXISTS deals DROP CONSTRAINT IF EXISTS deals_candidate_id_fkey;

-- Step 2: Drop RLS policies
DROP POLICY IF EXISTS "Users can view own applicant profiles" ON applicant_profiles;
DROP POLICY IF EXISTS "Users can create own applicant profiles" ON applicant_profiles;
DROP POLICY IF EXISTS "Users can update own applicant profiles" ON applicant_profiles;
DROP POLICY IF EXISTS "Users can delete own applicant profiles" ON applicant_profiles;

DROP POLICY IF EXISTS "Users can view own resume parsing queue" ON resume_parsing_queue;
DROP POLICY IF EXISTS "Users can create resume parsing jobs" ON resume_parsing_queue;
DROP POLICY IF EXISTS "Users can update own parsing jobs" ON resume_parsing_queue;

DROP POLICY IF EXISTS "Users can view own applicants" ON applicants;
DROP POLICY IF EXISTS "Users can create applicants" ON applicants;
DROP POLICY IF EXISTS "Users can update own applicants" ON applicants;
DROP POLICY IF EXISTS "Users can delete own applicants" ON applicants;

DROP POLICY IF EXISTS "Users can view own interview schedules" ON interview_schedules;
DROP POLICY IF EXISTS "Users can create interview schedules" ON interview_schedules;
DROP POLICY IF EXISTS "Users can update own interview schedules" ON interview_schedules;
DROP POLICY IF EXISTS "Users can delete own interview schedules" ON interview_schedules;

DROP POLICY IF EXISTS "Users can view interview templates" ON interview_templates;
DROP POLICY IF EXISTS "Users can create interview templates" ON interview_templates;
DROP POLICY IF EXISTS "Users can update own interview templates" ON interview_templates;
DROP POLICY IF EXISTS "Users can delete own interview templates" ON interview_templates;

DROP POLICY IF EXISTS "Users can view own interview metrics" ON interview_metrics;
DROP POLICY IF EXISTS "Users can create interview metrics" ON interview_metrics;

DROP POLICY IF EXISTS "Users can manage own candidates" ON candidates;
DROP POLICY IF EXISTS "Users can view own job postings" ON job_postings;
DROP POLICY IF EXISTS "Users can create job postings" ON job_postings;
DROP POLICY IF EXISTS "Users can update own job postings" ON job_postings;
DROP POLICY IF EXISTS "Users can delete own job postings" ON job_postings;

DROP POLICY IF EXISTS "Users can view own recruitment pipeline" ON recruitment_pipeline;
DROP POLICY IF EXISTS "Users can create recruitment pipeline entries" ON recruitment_pipeline;
DROP POLICY IF EXISTS "Users can update own recruitment pipeline" ON recruitment_pipeline;

DROP POLICY IF EXISTS "Users can view own recruiter candidates" ON recruiter_candidates;
DROP POLICY IF EXISTS "Users can create recruiter candidates" ON recruiter_candidates;
DROP POLICY IF EXISTS "Users can update own recruiter candidates" ON recruiter_candidates;
DROP POLICY IF EXISTS "Users can delete own recruiter candidates" ON recruiter_candidates;

-- Step 3: Drop triggers
DROP TRIGGER IF EXISTS update_applicant_profiles_updated_at ON applicant_profiles;
DROP TRIGGER IF EXISTS update_resume_parsing_queue_updated_at ON resume_parsing_queue;
DROP TRIGGER IF EXISTS update_applicants_updated_at ON applicants;
DROP TRIGGER IF EXISTS update_interview_schedules_updated_at ON interview_schedules;
DROP TRIGGER IF EXISTS update_interview_templates_updated_at ON interview_templates;
DROP TRIGGER IF EXISTS update_interview_metrics_updated_at ON interview_metrics;
DROP TRIGGER IF EXISTS update_candidates_updated_at ON candidates;
DROP TRIGGER IF EXISTS update_candidate_search_vector_trigger ON candidates;
DROP TRIGGER IF EXISTS update_job_postings_updated_at ON job_postings;
DROP TRIGGER IF EXISTS update_recruitment_pipeline_updated_at ON recruitment_pipeline;
DROP TRIGGER IF EXISTS update_recruiter_candidates_updated_at ON recruiter_candidates;

-- Step 4: Drop tables in dependency order
DROP TABLE IF EXISTS applicant_evaluations CASCADE;
DROP TABLE IF EXISTS applicant_activities CASCADE;
DROP TABLE IF EXISTS recruiter_candidates CASCADE;
DROP TABLE IF EXISTS recruitment_agent_metrics CASCADE;
DROP TABLE IF EXISTS recruitment_pipeline CASCADE;
DROP TABLE IF EXISTS job_postings CASCADE;
DROP TABLE IF EXISTS interview_metrics CASCADE;
DROP TABLE IF EXISTS interview_templates CASCADE;
DROP TABLE IF EXISTS interview_schedules CASCADE;
DROP TABLE IF EXISTS applicants CASCADE;
DROP TABLE IF EXISTS resume_parsing_queue CASCADE;
DROP TABLE IF EXISTS applicant_profiles CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;

-- Step 5: Drop functions
DROP FUNCTION IF EXISTS update_candidate_search_vector() CASCADE;
DROP FUNCTION IF EXISTS validate_candidate_data() CASCADE;

-- Step 6: Remove candidate_id column from deals table if it exists
ALTER TABLE IF EXISTS deals DROP COLUMN IF EXISTS candidate_id;

-- Step 7: Remove interview_schedule_id from zoom_meetings if it exists
ALTER TABLE IF EXISTS zoom_meetings DROP COLUMN IF EXISTS interview_schedule_id;

-- Step 8: Remove applicant_id from twilio_communications if it exists
ALTER TABLE IF EXISTS twilio_communications DROP COLUMN IF EXISTS applicant_id;

-- Step 9: Clean up any references in recruiter_activities
ALTER TABLE IF EXISTS recruiter_activities DROP COLUMN IF EXISTS candidate_id;
ALTER TABLE IF EXISTS recruiter_activities DROP COLUMN IF EXISTS job_posting_id;

-- Step 10: Remove applicant_id from pipeline_stage_history if it exists
ALTER TABLE IF EXISTS pipeline_stage_history DROP COLUMN IF EXISTS applicant_id;

-- Add comment to document this migration
COMMENT ON SCHEMA public IS 'EVA Platform schema - Candidate features removed on 2025-01-17';