# Agent Implementation Plans - Final Analysis Phase

## Agent 7: UI Components & Integration Developer

### CRUD Interface Components

#### 1. Candidates CRUD Enhancement
**Priority**: High | **Estimated Time**: 2-3 days

**Current Status**: 
- `CandidatesTable.tsx` exists with read-only functionality
- Uses `PaginatedTable` component with virtual scrolling
- Missing create/update/delete operations

**Implementation Plan**:

```typescript
// Path: /frontend/src/components/candidates/CandidateModal.tsx
interface CandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate?: Candidate;
  onSave: (candidate: Candidate) => Promise<void>;
}

// Key Features:
- Form validation with Zod schemas
- Skills tags input with autocomplete
- LinkedIn URL validation
- Phone number formatting
- Status dropdown with color coding
- File upload for resume/documents
```

**Database Integration**:
```typescript
// Path: /frontend/src/lib/supabase/candidates.ts
export async function createCandidate(userId: string, data: CreateCandidateData) {
  const { data: candidate, error } = await supabase
    .from('candidates')
    .insert({ ...data, user_id: userId })
    .select()
    .single();
  
  if (error) throw error;
  return candidate;
}

export async function updateCandidate(id: string, data: UpdateCandidateData) {
  const { data: candidate, error } = await supabase
    .from('candidates')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return candidate;
}
```

**Required Files**:
- `/components/candidates/CandidateModal.tsx` - Create/Edit form
- `/components/candidates/CandidateDeleteConfirm.tsx` - Delete confirmation
- `/lib/supabase/candidates.ts` - Database operations
- `/hooks/useCandidates.ts` - React Query hooks

#### 2. Unified Messages UI
**Priority**: High | **Estimated Time**: 3-4 days

**Current Status**: 
- No unified messaging interface exists
- Email integration exists in Microsoft365Client
- Need to consolidate email, LinkedIn, SMS, and internal messages

**Implementation Plan**:

```typescript
// Path: /frontend/src/components/messages/UnifiedMessagesInterface.tsx
interface Message {
  id: string;
  type: 'email' | 'linkedin' | 'sms' | 'internal';
  subject?: string;
  content: string;
  sender: Contact;
  recipients: Contact[];
  timestamp: Date;
  thread_id?: string;
  attachments?: Attachment[];
  status: 'sent' | 'delivered' | 'read' | 'failed';
}

// Key Features:
- Threaded conversation view
- Multi-channel message composition
- Attachment handling
- Message search and filtering
- Real-time updates via WebSocket
```

**Database Schema Addition**:
```sql
-- Path: /supabase/migrations/011_unified_messages.sql
CREATE TABLE IF NOT EXISTS public.unified_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  thread_id UUID,
  type TEXT NOT NULL CHECK (type IN ('email', 'linkedin', 'sms', 'internal')),
  subject TEXT,
  content TEXT NOT NULL,
  sender_id UUID,
  recipients JSONB NOT NULL,
  attachments JSONB DEFAULT '[]',
  status TEXT DEFAULT 'sent',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. Task Management Database Connection
**Priority**: Medium | **Estimated Time**: 1-2 days

**Current Status**: 
- `TasksTable.tsx` uses mock data
- Database schema exists in `tasks` table
- Missing real-time synchronization

**Implementation Plan**:

```typescript
// Path: /frontend/src/hooks/useTasks.ts
export function useTasks(userId: string) {
  return useQuery({
    queryKey: ['tasks', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    staleTime: 30000, // 30 seconds
  });
}

// Real-time subscription
export function useTasksSubscription(userId: string) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const subscription = supabase
      .channel(`tasks:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        queryClient.invalidateQueries(['tasks', userId]);
      })
      .subscribe();
    
    return () => subscription.unsubscribe();
  }, [userId, queryClient]);
}
```

#### 4. Real-time Updates Implementation
**Priority**: High | **Estimated Time**: 2-3 days

**Current Status**: 
- WebSocket infrastructure exists
- Supabase Realtime configured
- Need to implement optimistic updates

**Implementation Plan**:

```typescript
// Path: /frontend/src/hooks/useRealtimeUpdates.ts
export function useRealtimeUpdates() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    // Candidates real-time updates
    const candidatesChannel = supabase
      .channel('candidates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'candidates'
      }, (payload) => {
        queryClient.setQueryData(['candidates'], (old: any) => {
          if (!old) return old;
          
          switch (payload.eventType) {
            case 'INSERT':
              return { ...old, data: [...old.data, payload.new] };
            case 'UPDATE':
              return {
                ...old,
                data: old.data.map((item: any) =>
                  item.id === payload.new.id ? payload.new : item
                )
              };
            case 'DELETE':
              return {
                ...old,
                data: old.data.filter((item: any) => item.id !== payload.old.id)
              };
            default:
              return old;
          }
        });
      })
      .subscribe();
    
    return () => candidatesChannel.unsubscribe();
  }, [queryClient]);
}
```

## Agent 8: Microsoft Teams & SharePoint UI Developer

### Microsoft Teams Integration
**Priority**: Medium | **Estimated Time**: 4-5 days

**Current Status**: 
- Backend Teams integration exists in `microsoft365.ts`
- No UI components for Teams functionality
- Missing API routes for Teams operations

**Implementation Plan**:

#### 1. Teams Channel Browser
```typescript
// Path: /frontend/src/components/microsoft/TeamsChannelBrowser.tsx
interface TeamsChannelBrowserProps {
  onSelectChannel: (teamId: string, channelId: string) => void;
}

export function TeamsChannelBrowser({ onSelectChannel }: TeamsChannelBrowserProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  
  // Features:
  // - Tree view of teams and channels
  // - Search functionality
  // - Recent channels quick access
  // - Channel member count display
  // - Permissions indicator
}
```

#### 2. API Routes for Teams
```typescript
// Path: /frontend/src/app/api/microsoft/teams/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get('teamId');
  
  if (teamId) {
    // Get channels for specific team
    const channels = await microsoft365Client.getTeamChannels(teamId);
    return NextResponse.json(channels);
  } else {
    // Get all teams
    const teams = await microsoft365Client.getTeams();
    return NextResponse.json(teams);
  }
}

export async function POST(request: Request) {
  const { teamId, channelId, message } = await request.json();
  
  const result = await microsoft365Client.sendTeamsMessage(
    teamId,
    channelId,
    message
  );
  
  return NextResponse.json(result);
}
```

### SharePoint File Management
**Priority**: Medium | **Estimated Time**: 3-4 days

**Current Status**: 
- Backend SharePoint integration exists
- No UI for file management
- Missing file upload/download components

**Implementation Plan**:

#### 1. SharePoint File Explorer
```typescript
// Path: /frontend/src/components/sharepoint/SharePointFileExplorer.tsx
interface SharePointFileExplorerProps {
  siteId: string;
  driveId: string;
  onFileSelect?: (file: SharePointFile) => void;
}

export function SharePointFileExplorer({
  siteId,
  driveId,
  onFileSelect
}: SharePointFileExplorerProps) {
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<SharePointFile[]>([]);
  const [folders, setFolders] = useState<SharePointFolder[]>([]);
  
  // Features:
  // - Breadcrumb navigation
  // - File/folder icons
  // - Context menu for file operations
  // - Drag and drop upload
  // - File preview modal
  // - Search within current folder
}
```

#### 2. File Upload Component
```typescript
// Path: /frontend/src/components/sharepoint/FileUploader.tsx
interface FileUploaderProps {
  siteId: string;
  driveId: string;
  currentPath: string;
  onUploadComplete: (files: SharePointFile[]) => void;
}

export function FileUploader({
  siteId,
  driveId,
  currentPath,
  onUploadComplete
}: FileUploaderProps) {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [dragOver, setDragOver] = useState(false);
  
  // Features:
  // - Multiple file selection
  // - Progress tracking
  // - Cancel upload functionality
  // - File type validation
  // - Size limit enforcement
}
```

### OneDrive Integration
**Priority**: Low | **Estimated Time**: 2-3 days

**Current Status**: 
- Backend OneDrive integration exists
- Can reuse SharePoint file components
- Need OneDrive-specific API routes

**Implementation Plan**:

```typescript
// Path: /frontend/src/app/api/microsoft/onedrive/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path') || '/root';
  
  const files = await microsoft365Client.getOneDriveFiles(path);
  return NextResponse.json(files);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  
  const buffer = await file.arrayBuffer();
  const result = await microsoft365Client.uploadToOneDrive(file.name, buffer);
  
  return NextResponse.json(result);
}
```

## Agent 9: Analytics & Monitoring Developer

### PostHog/Mixpanel Integration
**Priority**: High | **Estimated Time**: 2-3 days

**Current Status**: 
- No analytics integration exists
- Need to choose between PostHog vs Mixpanel
- No event tracking implemented

**Implementation Plan**:

#### 1. Analytics Provider Setup
```typescript
// Path: /frontend/src/lib/analytics/posthog.ts
import { PostHog } from 'posthog-js';

class AnalyticsClient {
  private posthog: PostHog | null = null;
  
  init(userId?: string) {
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      this.posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
        loaded: (posthog) => {
          if (userId) {
            posthog.identify(userId);
          }
        }
      });
    }
  }
  
  track(event: string, properties?: Record<string, any>) {
    this.posthog?.capture(event, properties);
  }
  
  identify(userId: string, traits?: Record<string, any>) {
    this.posthog?.identify(userId, traits);
  }
  
  page(name: string, properties?: Record<string, any>) {
    this.posthog?.capture('$pageview', { page_name: name, ...properties });
  }
}

export const analytics = new AnalyticsClient();
```

#### 2. Event Tracking Hooks
```typescript
// Path: /frontend/src/hooks/useAnalytics.ts
export function useAnalytics() {
  const trackEvent = useCallback((event: string, properties?: Record<string, any>) => {
    analytics.track(event, properties);
  }, []);
  
  const trackPageView = useCallback((pageName: string, properties?: Record<string, any>) => {
    analytics.page(pageName, properties);
  }, []);
  
  const trackUserAction = useCallback((action: string, context?: Record<string, any>) => {
    analytics.track('user_action', { action, ...context });
  }, []);
  
  return { trackEvent, trackPageView, trackUserAction };
}
```

### Custom Event Tracking
**Priority**: High | **Estimated Time**: 1-2 days

**Current Status**: 
- `analytics_events` table exists in database
- No custom tracking implementation
- Need to track recruitment-specific events

**Implementation Plan**:

```typescript
// Path: /frontend/src/lib/analytics/events.ts
export interface RecruitmentEvent {
  type: 'candidate_created' | 'interview_scheduled' | 'email_sent' | 'task_completed';
  properties: Record<string, any>;
  userId: string;
  candidateId?: string;
  dealId?: string;
}

export class RecruitmentAnalytics {
  static async trackCandidateCreated(candidateId: string, source: string) {
    await this.track({
      type: 'candidate_created',
      properties: { candidateId, source },
      userId: getCurrentUserId(),
      candidateId
    });
  }
  
  static async trackInterviewScheduled(candidateId: string, interviewType: string) {
    await this.track({
      type: 'interview_scheduled',
      properties: { candidateId, interviewType },
      userId: getCurrentUserId(),
      candidateId
    });
  }
  
  private static async track(event: RecruitmentEvent) {
    // Track in PostHog
    analytics.track(event.type, event.properties);
    
    // Store in database
    await supabase
      .from('analytics_events')
      .insert({
        user_id: event.userId,
        event_type: event.type,
        event_data: event.properties,
        candidate_id: event.candidateId,
        deal_id: event.dealId
      });
  }
}
```

### Real-time Dashboards
**Priority**: Medium | **Estimated Time**: 3-4 days

**Current Status**: 
- Basic monitoring exists in `SystemHealthMonitor.tsx`
- Need recruitment-specific dashboards
- No real-time metrics display

**Implementation Plan**:

```typescript
// Path: /frontend/src/components/analytics/RecruitmentDashboard.tsx
export function RecruitmentDashboard() {
  const [metrics, setMetrics] = useState<RecruitmentMetrics>();
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');
  
  // Real-time metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      const response = await fetch(`/api/analytics/recruitment?range=${timeRange}`);
      const data = await response.json();
      setMetrics(data);
    };
    
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [timeRange]);
  
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Active Candidates"
          value={metrics?.activeCandidates || 0}
          change={metrics?.candidateGrowth || 0}
          icon={<Users className="w-5 h-5" />}
        />
        <MetricCard
          title="Interviews Scheduled"
          value={metrics?.interviewsScheduled || 0}
          change={metrics?.interviewGrowth || 0}
          icon={<Calendar className="w-5 h-5" />}
        />
        <MetricCard
          title="Placements This Month"
          value={metrics?.placements || 0}
          change={metrics?.placementGrowth || 0}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          title="Pipeline Value"
          value={metrics?.pipelineValue || 0}
          change={metrics?.pipelineGrowth || 0}
          icon={<DollarSign className="w-5 h-5" />}
          format="currency"
        />
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CandidateFlowChart data={metrics?.candidateFlow} />
        <InterviewSuccessChart data={metrics?.interviewSuccess} />
      </div>
    </div>
  );
}
```

### Error Monitoring with Sentry
**Priority**: High | **Estimated Time**: 1-2 days

**Current Status**: 
- No error monitoring configured
- Basic error boundaries exist
- Need Sentry integration

**Implementation Plan**:

```typescript
// Path: /frontend/src/lib/monitoring/sentry.ts
import * as Sentry from '@sentry/nextjs';

export function initSentry() {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 1.0,
      beforeSend(event, hint) {
        // Filter out common errors
        if (event.exception) {
          const error = hint.originalException;
          if (error && error.message?.includes('ResizeObserver loop limit exceeded')) {
            return null;
          }
        }
        return event;
      },
      integrations: [
        new Sentry.BrowserTracing({
          tracingOrigins: ['localhost', /^\//],
        }),
      ],
    });
  }
}

export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, { extra: context });
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  Sentry.captureMessage(message, level);
}
```

## Agent 10: Database & Performance Optimizer

### Missing Migrations Analysis
**Priority**: High | **Estimated Time**: 1-2 days

**Current Status**: 
- 9 migrations applied
- Missing some table relationships
- Need to audit schema completeness

**Implementation Plan**:

```sql
-- Path: /supabase/migrations/012_schema_improvements.sql

-- Add missing foreign key constraints
ALTER TABLE public.candidates 
ADD COLUMN first_name TEXT,
ADD COLUMN last_name TEXT;

-- Update existing name column to be computed
UPDATE public.candidates 
SET first_name = split_part(name, ' ', 1),
    last_name = split_part(name, ' ', 2);

-- Add missing indexes for performance
CREATE INDEX CONCURRENTLY idx_candidates_name_gin ON public.candidates USING gin(to_tsvector('english', name));
CREATE INDEX CONCURRENTLY idx_candidates_email_hash ON public.candidates USING hash(email);
CREATE INDEX CONCURRENTLY idx_tasks_user_status ON public.tasks(user_id, status);
CREATE INDEX CONCURRENTLY idx_deals_stage_amount ON public.deals(stage, amount);

-- Add missing constraints
ALTER TABLE public.candidates 
ADD CONSTRAINT candidates_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Add audit columns
ALTER TABLE public.candidates 
ADD COLUMN created_by UUID REFERENCES public.users(id),
ADD COLUMN updated_by UUID REFERENCES public.users(id);
```

### Index Optimization
**Priority**: High | **Estimated Time**: 1-2 days

**Current Status**: 
- Basic indexes exist
- Need composite indexes for common queries
- Missing partial indexes

**Implementation Plan**:

```sql
-- Path: /supabase/migrations/013_index_optimization.sql

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY idx_candidates_user_status_created 
ON public.candidates(user_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY idx_tasks_user_priority_due 
ON public.tasks(user_id, priority DESC, due_date ASC) 
WHERE status IN ('pending', 'in_progress');

CREATE INDEX CONCURRENTLY idx_deals_user_stage_amount 
ON public.deals(user_id, stage, amount DESC);

-- Partial indexes for active records
CREATE INDEX CONCURRENTLY idx_candidates_active 
ON public.candidates(user_id, updated_at DESC) 
WHERE status NOT IN ('rejected', 'placed');

CREATE INDEX CONCURRENTLY idx_tasks_active 
ON public.tasks(user_id, due_date ASC) 
WHERE status IN ('pending', 'in_progress');

-- GIN indexes for search
CREATE INDEX CONCURRENTLY idx_candidates_skills_gin 
ON public.candidates USING gin(skills);

CREATE INDEX CONCURRENTLY idx_documents_metadata_gin 
ON public.documents USING gin(metadata);
```

### Virtual Scrolling Implementation
**Priority**: Medium | **Estimated Time**: 2-3 days

**Current Status**: 
- `VirtualizedList.tsx` exists
- `PaginatedTable.tsx` exists
- Need to optimize for large datasets

**Implementation Plan**:

```typescript
// Path: /frontend/src/components/virtualized/VirtualizedCandidateList.tsx
import { FixedSizeList as List } from 'react-window';
import { useInfiniteQuery } from '@tanstack/react-query';

interface VirtualizedCandidateListProps {
  height: number;
  itemHeight: number;
  userId: string;
}

export function VirtualizedCandidateList({
  height,
  itemHeight,
  userId
}: VirtualizedCandidateListProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['candidates', userId],
    queryFn: ({ pageParam = 0 }) => fetchCandidates(userId, pageParam),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.hasMore) {
        return pages.length * 50; // 50 items per page
      }
      return undefined;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const allCandidates = data?.pages.flatMap(page => page.candidates) ?? [];

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const candidate = allCandidates[index];
    
    // Load more data when near the end
    if (index === allCandidates.length - 5 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
    
    return (
      <div style={style} className="border-b border-gray-800 hover:bg-gray-800/30">
        <CandidateRow candidate={candidate} />
      </div>
    );
  };

  return (
    <List
      height={height}
      itemCount={allCandidates.length}
      itemSize={itemHeight}
      width="100%"
    >
      {Row}
    </List>
  );
}
```

### Query Performance Tuning
**Priority**: High | **Estimated Time**: 2-3 days

**Current Status**: 
- No query optimization implemented
- Need to analyze slow queries
- Missing query result caching

**Implementation Plan**:

```typescript
// Path: /frontend/src/lib/supabase/optimized-queries.ts
export class OptimizedQueries {
  // Cached query for frequent candidate searches
  static async searchCandidates(
    userId: string,
    query: string,
    filters: CandidateFilters
  ) {
    const cacheKey = `candidates:${userId}:${query}:${JSON.stringify(filters)}`;
    
    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    let queryBuilder = supabase
      .from('candidates')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        current_position,
        current_company,
        status,
        skills,
        created_at
      `)
      .eq('user_id', userId);
    
    // Add text search if query provided
    if (query) {
      queryBuilder = queryBuilder.textSearch('search_vector', query);
    }
    
    // Add filters
    if (filters.status) {
      queryBuilder = queryBuilder.eq('status', filters.status);
    }
    
    if (filters.skills) {
      queryBuilder = queryBuilder.overlaps('skills', filters.skills);
    }
    
    if (filters.experienceRange) {
      queryBuilder = queryBuilder
        .gte('years_experience', filters.experienceRange.min)
        .lte('years_experience', filters.experienceRange.max);
    }
    
    const { data, error } = await queryBuilder
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    
    // Cache result for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(data));
    
    return data;
  }
  
  // Optimized dashboard metrics query
  static async getDashboardMetrics(userId: string) {
    const { data, error } = await supabase.rpc('get_dashboard_metrics', {
      user_id: userId
    });
    
    if (error) throw error;
    return data;
  }
}

// Database function for dashboard metrics
-- Path: /supabase/migrations/014_dashboard_functions.sql
CREATE OR REPLACE FUNCTION get_dashboard_metrics(user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_candidates', (SELECT COUNT(*) FROM candidates WHERE candidates.user_id = $1),
    'active_candidates', (SELECT COUNT(*) FROM candidates WHERE candidates.user_id = $1 AND status NOT IN ('rejected', 'placed')),
    'interviews_this_week', (SELECT COUNT(*) FROM tasks WHERE tasks.user_id = $1 AND assigned_agent = 'interview' AND created_at >= NOW() - INTERVAL '7 days'),
    'deals_in_pipeline', (SELECT COUNT(*) FROM deals WHERE deals.user_id = $1 AND stage NOT IN ('closed_won', 'closed_lost')),
    'pipeline_value', (SELECT COALESCE(SUM(amount), 0) FROM deals WHERE deals.user_id = $1 AND stage NOT IN ('closed_won', 'closed_lost')),
    'placement_rate', (
      SELECT CASE 
        WHEN COUNT(*) = 0 THEN 0 
        ELSE (COUNT(*) FILTER (WHERE status = 'placed')::FLOAT / COUNT(*) * 100)
      END
      FROM candidates 
      WHERE candidates.user_id = $1 
      AND created_at >= NOW() - INTERVAL '30 days'
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Implementation Timeline

### Phase 1 (Week 1-2): Core CRUD & Database
- Agent 7: Candidates CRUD interface
- Agent 10: Missing migrations and index optimization
- Agent 7: Task management database connection

### Phase 2 (Week 3-4): Analytics & Monitoring
- Agent 9: PostHog integration and event tracking
- Agent 9: Sentry error monitoring
- Agent 10: Query performance optimization

### Phase 3 (Week 5-6): Microsoft Integration & UI
- Agent 8: Teams channel browser and messaging
- Agent 8: SharePoint file management
- Agent 7: Unified messages interface

### Phase 4 (Week 7-8): Advanced Features & Polish
- Agent 7: Real-time updates implementation
- Agent 9: Real-time dashboards
- Agent 10: Virtual scrolling optimization
- Agent 8: OneDrive integration

## Success Metrics

1. **Performance**: 
   - Page load times < 2 seconds
   - Query response times < 500ms
   - Virtual scrolling supports 10,000+ items

2. **User Experience**:
   - All CRUD operations functional
   - Real-time updates working
   - Error rates < 1%

3. **Integration Quality**:
   - Microsoft 365 features fully functional
   - Analytics tracking 20+ events
   - 95% test coverage on new components

4. **Database Performance**:
   - Query optimization reduces load by 40%
   - All indexes properly utilized
   - No N+1 query issues

This implementation plan provides concrete, actionable steps for each agent with specific file paths, code patterns, and timeline estimates based on the current EVA Assistant codebase.