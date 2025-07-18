# Resume Parsing & Interview Center Impact Analysis

## Executive Summary

This analysis identifies all integration points and dependencies for the Resume Parsing and Interview Center features in the EVA Assistant codebase. Removing these features would require significant refactoring across multiple systems.

## 1. Database Schema Dependencies

### Primary Tables
- **`public.candidates`** (001_initial_schema.sql)
  - Core table storing candidate information
  - Referenced by multiple other tables
  - Contains fields: name, email, phone, linkedin_url, skills, status, etc.

- **`public.interviews`** (20240112_interviews_table.sql)
  - Stores Zoom meeting details for interviews
  - Links to candidates via email
  - Tracks interview status and outcomes

### Related Tables with Foreign Key Dependencies
- **`public.deals`** - Has `candidate_id` foreign key reference
- **`public.lead_scores`** - Has `candidate_id` foreign key reference  
- **`public.recruiter_candidates`** - Has `candidate_id` foreign key reference
- **`public.recruiter_metrics`** - Tracks interview metrics (interviews_scheduled, candidates_submitted)

## 2. Agent System Integration

### Resume Parser Pipeline Agent
- **Location**: `/lib/agents/resume-parser-pipeline.ts`
- **Type**: Analysis agent registered in orchestrator
- **Sub-agents**:
  - Extraction Agent
  - Analysis Agent
  - Matching Agent
  - Verification Agent
  - Recommendation Agent

### AI Interview Center Agent
- **Location**: `/lib/agents/ai-interview-center.ts`
- **Type**: Scheduling agent registered in orchestrator
- **Sub-agents**:
  - Scheduling Agent
  - Question Generation Agent
  - Guide Creation Agent
  - Communication Agent
  - Intelligence Agent

### Agent Orchestrator Registration
- Both agents are registered in:
  - `/supabase/functions/agent-orchestrator/index.ts`
  - `/supabase/functions/_shared/agent-executor.ts`

## 3. Email Automation Integration

### Email Rules Engine (`/lib/automation/email-rules.ts`)
- **Rule**: "Candidate Application Processing" (lines 94-116)
  - Triggers on resume attachments
  - Actions: `parse_resume`, `match_to_jobs`, `create_contact`
- **Parse Resume Action** (lines 507-539)
  - Extracts candidate data from email attachments
  - Updates contact records with parsed information

### Email Templates (`010_email_templates.sql`)
- Pre-built templates for:
  - Initial Candidate Outreach
  - Interview Follow-up
  - Interview Scheduling
  - All reference candidate/interview workflows

## 4. UI Components & Routes

### Dashboard Integration
- **Sidebar Navigation** (`/components/dashboard/Sidebar.tsx`)
  - Resume Parser menu item
  - Interview Center menu item

### Page Components
- `/app/dashboard/resume-parser/page.tsx` - Resume parsing interface
- `/app/dashboard/interview-center/page.tsx` - Interview scheduling interface
- `/app/dashboard/candidates/page.tsx` - Candidate management page

### Shared Components
- `/components/recruiting/applicant-pipeline.tsx` - Visual pipeline
- `/components/recruiting/ai-interview-scheduler.tsx` - Interview scheduling UI
- `/components/files/ResumeUpload.tsx` - Resume upload component
- `/components/tables/CandidatesTable.tsx` - Candidate data table

## 5. Integration Points

### Zoho CRM Integration
- **Candidate Management**:
  - `createCandidatePlacement()` method in `/lib/integrations/zoho.ts`
  - Syncs candidate data to Zoho Contacts module
  - Links candidates to deals/placements

### Microsoft 365 Integration
- **Recruitment-Specific Features** (per CLAUDE.md):
  - Interview scheduling with automatic Teams meeting creation
  - Candidate folder creation in SharePoint
  - Email search for candidate communications
  - Bulk calendar availability checking

### Twilio Integration
- Interview-related call logging
- Candidate communication tracking
- IVR flows potentially reference interview scheduling

### Zoom Integration
- Direct integration with interviews table
- Meeting creation for candidate interviews
- Recording management for interview sessions

## 6. Workflow & Automation Dependencies

### Deal Automation Agent
- References candidates in deal creation
- `createContactAction()` creates candidate records
- Links deals to candidates for placement tracking

### Lead Generation & Scoring
- Lead scores table references candidates
- Qualification workflows include candidate evaluation
- Scoring factors may include interview performance

### Task Management
- Interview scheduling creates tasks
- Follow-up tasks reference candidates
- Task metadata includes candidate/interview IDs

## 7. SEO & Marketing Features

### SEO Configuration
- `/lib/seo/config.ts` - Includes resume parser and interview center metadata
- `/lib/seo/dashboard-metadata.ts` - Dashboard page SEO
- Sitemap generation includes these routes

### Analytics & Reporting
- Recruiter metrics track candidate/interview data
- Performance dashboards show interview-to-offer ratios
- Placement analytics depend on candidate tracking

## 8. Testing & Documentation

### Test Files
- E2E tests reference resume parser and interview center
- Integration tests validate agent functionality
- Performance tests include candidate data operations

### Documentation References
- MasterTodoList.md lists both as working features
- CLAUDE.md identifies them as fully implemented
- Multiple implementation guides reference the features

## 9. Data Flow Dependencies

### Critical Data Flows
1. **Email → Resume Parse → Candidate Creation → Deal Creation**
2. **Lead Generation → Candidate Scoring → Interview Scheduling**
3. **Interview Completion → Placement → Revenue Tracking**
4. **Candidate Data → Zoho Sync → Reporting**

### Cross-Feature Dependencies
- Deals require candidates for placement tracking
- Revenue calculations depend on placement data
- Recruiter performance metrics need interview data
- Email automation relies on candidate matching

## 10. Migration Complexity

### High-Impact Areas Requiring Refactoring
1. **Database Schema**
   - Remove foreign key constraints
   - Update dependent tables
   - Migrate existing data

2. **Agent Orchestrator**
   - Remove agent registrations
   - Update workflow definitions
   - Modify execution paths

3. **Email Automation**
   - Remove candidate-related rules
   - Update action handlers
   - Modify templates

4. **UI Navigation**
   - Remove menu items
   - Update routing
   - Remove page components

5. **Integration Services**
   - Update Zoho sync logic
   - Modify Microsoft 365 features
   - Adjust Zoom integration

### Estimated Impact
- **Code Changes**: 50+ files
- **Database Migrations**: 5+ tables affected
- **Feature Dependencies**: 15+ features would need updates
- **Testing Updates**: 20+ test files
- **Documentation**: 10+ documentation files

## Recommendations

1. **Phased Approach**: Remove features gradually to minimize disruption
2. **Data Migration**: Plan for existing candidate/interview data
3. **Feature Flags**: Use feature flags for gradual rollback
4. **Alternative Solutions**: Consider lightweight replacements for critical workflows
5. **Communication**: Notify users well in advance of feature removal

## Risk Assessment

### High Risk Areas
- Breaking deal creation workflow
- Losing historical placement data
- Disrupting email automation
- Breaking Zoho CRM sync

### Medium Risk Areas
- UI navigation updates
- Test suite modifications
- Documentation updates
- SEO impact

### Low Risk Areas
- Removing unused agent code
- Cleaning up database schema
- Updating configuration files