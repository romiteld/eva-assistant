# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EVA (Executive Virtual Assistant) is an AI-powered recruitment platform for financial advisor recruiting, built for The Well Recruiting Solutions. It's a full-stack web application using Next.js, Supabase, and AI agents for automation.

### Implementation Status

**✅ Fully Working Features (19/23):**
- Microsoft OAuth with PKCE implementation (standalone, no Supabase OAuth)
- Magic Link authentication via Supabase
- Token Manager with auto-refresh for OAuth providers
- Voice Agent with Gemini Live API integration
- AI Content Studio Ultra with predictive analytics
- Recruiter Intel Tool with analytics dashboard
- Task Management interface
- Enhanced Lead Generation Agent with Zoho CRM sync
- Firecrawl integration (web scraping, crawling, search)
- WebSocket server for real-time features
- Database schema with 10 migrations applied
- **Outlook Email Integration** (send, reply, draft, search)
- **Outlook Calendar Integration** (events, scheduling, Teams meetings)
- **Outlook Contacts Integration** (get, create, manage)
- **SharePoint Integration** (sites, files, folders, search)
- **OneDrive Integration** (browse, upload files)
- **Agent Orchestrator v2** (UI and backend Edge Function implemented)
- **LinkedIn OAuth Integration** (profile access, messaging, lead enrichment)
- **Twilio Integration** (SMS, voice calls, phone numbers, IVR, conference calls, recordings, transcriptions)

**⚠️ Partially Working Features (3/25):**
- Outreach Campaign Management (UI complete, agent needs testing)
- **Microsoft Teams Integration** (channels, messages - backend only, no UI)
- **Automated Email Templates** (backend exists, needs UI)

**🚧 Pending Features (1/25):**
- Zoom integration for meetings

**🔧 Features Needing UI/Routes (4):**
- File upload system (needs Supabase Storage integration)
- SharePoint/OneDrive file management UI
- Analytics dashboard components
- Microsoft Teams collaboration interface

**🎨 AI/Advanced Features Not Started (4):**
- AI image generation
- Post Predictor feature
- Competitor Analysis tool UI
- Comprehensive test suite

**💅 UI Library Not Installed (1):**
- Shadcn components installation

### Current Issues

1. **Environment Configuration**:
   - ✅ Supabase credentials configured
   - ✅ Microsoft Entra ID configured (standalone PKCE OAuth, NOT using Supabase OAuth)
   - ✅ Gemini API key configured
   - ✅ Zoho CRM tokens configured
   - ✅ Firecrawl API key configured

## Essential Commands

### Development
```bash
# Install dependencies (from root)
npm install

# Run development server with WebSocket support
npm run dev

# Initialize database (run once)
cd frontend && npm run db:init

# Run development server only (without WebSocket)
cd frontend && npm run dev:next
```

### Testing
```bash
# Run unit tests
cd frontend && npm test

# Run tests in watch mode
cd frontend && npm run test:watch

# Run tests with coverage
cd frontend && npm run test:coverage

# Run E2E tests
cd frontend && npm run test:e2e

# Run E2E tests with UI
cd frontend && npm run test:e2e:ui

# Run single test file
cd frontend && npm test -- path/to/test.test.ts
```

### Build & Production
```bash
# Build for production
cd frontend && npm run build

# Start production server
cd frontend && npm start

# Lint code
cd frontend && npm run lint
```

### Database & Supabase
```bash
# Initialize database
cd frontend && npm run db:init

# Test database connection
cd frontend && npm run db:test

# Access Supabase locally
# API: http://localhost:54321
# Studio: http://localhost:54323
```

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 14.2.30, React 18.3.1, TypeScript
- **Styling**: Tailwind CSS with glassmorphic design
- **State**: Zustand, TanStack Query
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **AI**: Google Gemini (2.5 Pro/Flash), Pipecat AI (voice)
- **Real-time**: Socket.io, WebSockets, Supabase Realtime
- **Integrations**: Zoho CRM, Microsoft 365 (Graph API), Twilio, Firecrawl

### Directory Structure
```
/frontend/src/
├── app/              # Next.js app router pages
├── components/       # React components (organized by feature)
├── lib/             
│   ├── agents/      # AI agent implementations
│   ├── supabase/    # Database client & services
│   └── services/    # External API integrations
├── hooks/           # Custom React hooks
└── types/           # TypeScript type definitions

/supabase/
├── functions/       # Edge Functions (Deno runtime)
├── migrations/      # Database schema versions
└── config.toml      # Local development config
```

### Key Architectural Patterns

1. **Multi-Agent System**: The application uses specialized AI agents for different tasks (research, communication, workflow). Each agent type has 5 specialized sub-agents working in parallel.

2. **Serverless Architecture**: All backend logic runs on Supabase Edge Functions, eliminating traditional server management.

3. **Real-time Updates**: Combines Socket.io for WebRTC/voice features with Supabase Realtime for database changes.

4. **Type Safety**: Extensive TypeScript usage with strict mode enabled. Path aliases configured (@/ for src/).

5. **Authentication Flow**: Magic Link OTP + Microsoft OAuth through Supabase Auth with JWT tokens.

6. **Navigation Structure**: Dual navigation system - sidebar for main features, tabs within dashboard for sub-features.

### Implemented AI Agent Systems

1. **Deep Thinking Orchestrator** (`/lib/agents/deep-thinking-orchestrator.ts`)
   - Analysis, Planning, Execution, Validation, and Learning sub-agents
   - Complex problem solving with multi-perspective analysis

2. **Enhanced Lead Generation Agent** (`/lib/agents/enhanced-lead-generation.ts`)
   - Web scraping, qualification, scoring, enrichment, and outreach sub-agents
   - Integrated Zoho CRM sync with automatic lead creation

3. **AI Content Studio** (`/lib/agents/ai-content-studio.ts`)
   - Market analysis, creative generation, optimization, multimedia, and distribution agents
   - Predictive analytics and competitor analysis integration

4. **Resume Parser Pipeline** (`/lib/agents/resume-parser-pipeline.ts`)
   - Extraction, analysis, matching, verification, and recommendation agents
   - Automated candidate screening and ranking

5. **AI Interview Center** (`/lib/agents/ai-interview-center.ts`)
   - Scheduling, question generation, guide creation, communication, and intelligence agents
   - Smart calendar integration and interview optimization

### Development Guidelines

1. **Component Structure**: Components are organized by feature in the components directory. Each feature has its own subdirectory.

2. **API Calls**: All Supabase operations go through the lib/supabase directory. External APIs use lib/services.

3. **Error Handling**: Comprehensive error boundaries and try-catch blocks. Errors are logged to monitoring services.

4. **Testing Requirements**: 
   - Unit tests required for all business logic
   - 80% code coverage threshold enforced
   - E2E tests for critical user flows
   - Mock Service Worker (MSW) for API mocking

5. **Environment Variables**: Required vars are documented in frontend/.env.example. Never commit .env files.

### Common Development Tasks

**Working with AI Agents:**
- **IMPORTANT**: All agents require a `user_id` parameter for proper authentication and data isolation
- Pass the authenticated user's ID when initializing any agent
- Example: `new EnhancedLeadGenerationAgent(..., { userId: 'authenticated-user-id' })`

**Adding a new feature to the dashboard:**
1. Add navigation item to `/src/components/dashboard/Sidebar.tsx`
2. Create page component in `/src/app/dashboard/[feature-name]/page.tsx`
3. Import and use existing components from `/src/components/`
4. Connect to relevant AI agents from `/src/lib/agents/`

**Adding a new API endpoint:**
1. Create Edge Function in `supabase/functions/`
2. Add TypeScript types in `frontend/src/types/`
3. Create service wrapper in `frontend/src/lib/services/`
4. Add error handling and retry logic

**Creating a new component:**
1. Check existing components for patterns
2. Use Radix UI primitives when available
3. Apply Tailwind classes consistently
4. Include proper TypeScript props interface

**Database changes:**
1. Create migration in `supabase/migrations/`
2. Update TypeScript types
3. Run `npm run db:init` to apply locally
4. Test with existing data

**Fixing Supabase client issues:**
- Use `/src/lib/supabase/browser.ts` for client-side code
- Avoid creating multiple Supabase instances
- The client is now a singleton to prevent "Multiple GoTrueClient" warnings

### Performance Considerations

- Use React.memo for expensive components
- Implement virtual scrolling for large lists (react-window)
- Leverage TanStack Query for caching
- Minimize bundle size with dynamic imports
- WebSocket connections are managed centrally

### Security Notes

- All API routes require authentication
- Row Level Security (RLS) enabled on all tables
- Input validation with Zod schemas
- XSS protection through React's default escaping
- CORS configured for production domains only### Feature Status Summary

**Working Dashboard Routes:**
- `/dashboard` - Main dashboard with tabs
- `/dashboard/voice` - Voice Agent with Gemini Live
- `/dashboard/lead-generation` - AI-powered lead search with Zoho CRM sync
- `/dashboard/content-studio` - AI content creation with predictive analytics
- `/dashboard/orchestrator` - Agent monitoring (static data only)
- `/dashboard/outreach` - Campaign management
- `/dashboard/resume-parser` - Resume processing pipeline
- `/dashboard/interview-center` - AI interview scheduling
- `/dashboard/recruiter-intel` - Analytics dashboard
- `/dashboard/tasks` - Task management
- `/dashboard/firecrawl` - Web scraping, crawling, and search tools

### Microsoft 365 Integration Details

The platform includes comprehensive Microsoft 365 integration through the Microsoft Graph API:

**Implementation Files:**
- `/lib/integrations/microsoft365.ts` - Full Microsoft365Client with all services
- `/lib/microsoft/graph-client.ts` - Core Graph API client
- `/lib/auth/microsoft-oauth.ts` - OAuth PKCE authentication flow
- `/lib/auth/token-manager.ts` - Token refresh management

**API Routes Available:**
- `/api/microsoft/emails` - Email operations
- `/api/microsoft/calendar` - Calendar management  
- `/api/microsoft/contacts` - Contact management

**Recruitment-Specific Features:**
- Interview scheduling with automatic Teams meeting creation
- Candidate folder creation in SharePoint
- Email search for candidate communications
- Bulk calendar availability checking

**Note:** While SharePoint, OneDrive, and Teams have full backend implementation, they lack dedicated API routes and UI components. The Microsoft365Client in `/lib/integrations/microsoft365.ts` provides all necessary methods.

### Authentication Configuration Notes

**Microsoft OAuth Setup:**
- Uses standalone OAuth 2.0 with PKCE flow (no Supabase OAuth provider)
- Redirect URIs configured in Entra ID app registration:
  - Production: `https://eva.thewell.solutions/auth/microsoft/callback`
  - Local: `http://localhost:3000/auth/microsoft/callback`
- Client-side PKCE implementation in `/lib/auth/microsoft-oauth.ts`
- No longer uses Supabase OAuth callback URLs

**Recent Cleanup (2025-07-15):**
- Removed all OAuth test pages (`test-oauth-flow`, `debug-oauth`, `test-oauth-diagnostics`, `test-microsoft-oauth`, `test-supabase-auth`)
- Supabase OAuth provider configuration has been removed from the project
- All authentication now uses either Magic Link (Supabase) or standalone Microsoft OAuth (PKCE)
