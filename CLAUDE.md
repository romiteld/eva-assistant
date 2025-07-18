# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EVA (Executive Virtual Assistant) is an AI-powered recruitment platform for financial advisor recruiting, built for The Well Recruiting Solutions. It's a full-stack web application using Next.js, Supabase, and AI agents for automation.

### Recent Updates (January 18, 2025)
- **Security Hardening Complete**: Microsoft OAuth secrets moved server-side, webhook signatures enforced
- **Integration Fixes**: LinkedIn OAuth UI, MS365 Calendar permissions, Twilio configuration UI
- **UI/UX Enhancements**: Loading states, error boundaries, enhanced toast system, confirmation dialogs
- **Backend Implementations**: Agent Orchestrator Edge Function, generic queue system, Teams UI
- **Mobile Responsiveness**: Fixed all iPhone UI issues with proper viewport configuration, touch targets, responsive grids, and scrolling

### Implementation Status

**✅ Fully Working Features (23/27):**
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
- **Microsoft Teams Integration** (Full UI at /dashboard/teams with channels, messaging, meeting creation)
- **Generic Queue System** (Redis/Upstash with fallback, handles all async operations)
- **Enhanced Security Middleware** (Centralized webhook validation, rate limiting)
- **Advanced UI Components** (Loading states, enhanced toasts, confirmation dialogs)

**⚠️ Partially Working Features (2/27):**
- Outreach Campaign Management (UI complete, agent needs testing)
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
   - ✅ LinkedIn OAuth credentials (requires user authentication)
   - ✅ Twilio credentials (configuration UI available at /dashboard/settings/twilio)
   - ✅ Webhook secrets for all providers

### Critical Security Updates (January 18, 2025)

1. **Microsoft OAuth Client Secret**:
   - Moved from client-side to server-side only
   - Created `/api/auth/microsoft/token` endpoint for secure token exchange
   - Fixed OAuth state validation for CSRF protection
   - **Action Required**: Rotate Microsoft client secret in Azure Portal

2. **Webhook Security**:
   - Centralized validation middleware at `/middleware/webhook-validation.ts`
   - All webhooks now require signature validation
   - Provider-specific validation logic implemented
   - Timing-safe comparison to prevent timing attacks

3. **Rate Limiting**:
   - AI endpoints: 10 requests/minute
   - API endpoints: 60 requests/minute  
   - Auth endpoints: 5 requests/15 minutes
   - Webhook endpoints: Protected with provider-specific limits

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
- `/dashboard/voice` - Voice Agent with Gemini Live (enhanced with permission dialogs)
- `/dashboard/lead-generation` - AI-powered lead search with Zoho CRM sync (now with pagination)
- `/dashboard/content-studio` - AI content creation with predictive analytics (added loading states)
- `/dashboard/orchestrator` - Agent monitoring (real-time with Edge Function)
- `/dashboard/outreach` - Campaign management
- `/dashboard/recruiter-intel` - Analytics dashboard
- `/dashboard/tasks` - Task management
- `/dashboard/firecrawl` - Intelligence Hub (redesigned UI)
- `/dashboard/teams` - Microsoft Teams collaboration (NEW)
- `/dashboard/zoho` - Queue monitoring dashboard (NEW)
- `/dashboard/settings/twilio` - Twilio configuration (NEW)

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
- `/api/microsoft/token` - Secure OAuth token exchange (NEW)
- `/api/settings/twilio` - Twilio configuration management (NEW)
- `/api/webhooks/*` - All webhook endpoints with signature validation
- `/api/queue/*` - Queue management and monitoring

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

### Navigation System Architecture (Updated 2025-07-17)

**Sidebar Component** (`/src/components/dashboard/Sidebar.tsx`):
- Organized navigation into 8 logical groups with 24 total items
- Full accessibility support with ARIA labels and keyboard navigation
- Responsive design: slide-out overlay on mobile, collapsible sidebar on desktop
- Glassmorphic design with smooth Framer Motion animations

**Navigation Groups**:
1. **Overview**: Dashboard
2. **AI Tools**: Voice Agent, Agent Orchestrator, Content Studio, Intelligence Hub, Recruiter Intel, Post Predictor
3. **Workflow & Automation**: Deal Automation, Workflow Designer, Task Management
4. **Communication**: Lead Generation, Outreach Campaigns, Email Templates, Messages
5. **Integrations**: Zoho CRM, Twilio, Zoom, LinkedIn, SharePoint
6. **Analytics & Data**: Analytics, Competitor Analysis
7. **Files & Documents**: File Manager, Documents
8. **System**: Settings

**Accessibility Features**:
- ARIA labels on all interactive elements
- Focus ring indicators (purple) for keyboard navigation
- Screen reader support with proper roles and states
- `aria-current="page"` for active navigation items
- Enhanced keyboard navigation with arrow keys, Home, End, and Escape
- Focus management using useRef and useCallback hooks
- Skip to main content link for keyboard users
- Accessible tooltips with role="tooltip" and aria-describedby

**Note**: Intelligence Hub uses route `/dashboard/firecrawl` for backward compatibility while displaying "Intelligence Hub" in the UI

### Recent UI Improvements (Updated 2025-07-18)

**Enhanced User Experience**:
1. **Improved Permission Handling**: Voice Agent now has a proper permission dialog for microphone access with clear visual indicators
2. **Form Validation**: All forms now use toast notifications instead of browser alerts for a non-blocking user experience
3. **Loading States**: Added comprehensive loading indicators to Content Studio and Intelligence Hub pages
4. **Pagination**: Lead Generation results now have pagination (5 items per page) with smart page number display
5. **Confirmation Dialogs**: Created reusable ConfirmationDialog component to replace browser confirm() calls across the platform
6. **API Key Validation**: Lead Generation page validates Zoho API key on mount with clear error messaging

**Component Enhancements**:
- **VoiceControl**: Added permission dialog and error handling
- **LeadGenerationPage**: Implemented pagination and API key validation
- **FileList**: Replaced confirm() with ConfirmationDialog
- **ZoomMeetingManager**: Integrated ConfirmationDialog for delete and start actions
- **EmailTemplateList**: Uses ConfirmationDialog for template deletion
- **SharePointBrowser**: Implemented ConfirmationDialog for item deletion

**UI Consistency**:
- Standardized error messaging with toast notifications
- Consistent loading indicators across all async operations
- Unified confirmation dialog experience
- Improved accessibility with proper ARIA labels and keyboard navigation

### New Components and Services (January 18, 2025)

**UI Components**:
- `/components/ui/loading-states.tsx` - Comprehensive loading states (AI, skeleton, pulse)
- `/components/ui/enhanced-toast.tsx` - Advanced toast system with actions and promise support
- `/components/ui/confirmation-dialog.tsx` - Reusable confirmation dialogs
- `/components/ui/integration-status.tsx` - Integration health monitoring
- `/components/dashboard/TeamsUI.tsx` - Full Microsoft Teams interface

**Services**:
- `/lib/services/queue-manager.ts` - Generic queue system for all async operations
- `/lib/middleware/webhook-validation.ts` - Centralized webhook security
- `/lib/auth/secure-token-manager.ts` - Enhanced token management with encryption
- `/lib/services/twilio-sync.ts` - Real-time Twilio synchronization
- `/lib/monitoring/integration-health.ts` - Integration health checks

**Edge Functions**:
- `agent-orchestrator` - Real-time agent coordination (deployed)
- `queue-processor` - Background job processing
- `webhook-handler` - Centralized webhook processing

### Deployment Instructions (Updated January 18, 2025)

**Environment Variables Required**:
```bash
# Microsoft OAuth (CRITICAL - Server-side only!)
MICROSOFT_CLIENT_SECRET=your-secret-here  # MUST rotate if exposed
MICROSOFT_CLIENT_ID=bfa77df6-6952-4d0f-9816-003b3101b9da
MICROSOFT_TENANT_ID=29ee1479-b5f7-48c5-b665-7de9a8a9033e

# Webhook Secrets (Generate with: openssl rand -hex 32)
EMAIL_WEBHOOK_SECRET=generate-strong-secret
ZOHO_WEBHOOK_TOKEN=your-zoho-webhook-token
ZOOM_WEBHOOK_SECRET_TOKEN=your-zoom-webhook-secret
TWILIO_AUTH_TOKEN=your-twilio-auth-token
LINKEDIN_WEBHOOK_SECRET=your-linkedin-webhook-secret

# New Integrations
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_PHONE_NUMBER=+1234567890

# AI Services
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key
```

**Edge Functions Deployment**:
```bash
# Deploy all Edge Functions
cd supabase
supabase functions deploy agent-orchestrator
supabase functions deploy gemini-websocket
supabase functions deploy queue-processor
supabase functions deploy webhook-handler
```

**Pre-Production Security Checklist**:
1. ✅ Rotate Microsoft OAuth client secret (CRITICAL)
2. ✅ Configure webhook endpoints in external services
3. ✅ Set up Redis/Upstash for production
4. ✅ Configure rate limiting rules
5. ✅ Enable security headers and CORS
6. ✅ Set up monitoring and alerts
7. ✅ Configure backup strategy
8. ✅ Test rollback procedures
9. ✅ Verify all webhook signatures
10. ✅ Enable audit logging

**Integration Health Monitoring**:
- Use `/dashboard/settings` to monitor integration status
- Check webhook delivery logs in each provider's dashboard
- Monitor queue performance at `/dashboard/zoho`
- Review security logs for failed authentications
