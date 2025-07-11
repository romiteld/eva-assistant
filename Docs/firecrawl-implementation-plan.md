# Firecrawl Implementation Plan for EVA Assistant

## Overview
Based on the analysis of Firecrawl app examples, here's a comprehensive implementation plan to integrate these features into EVA's existing architecture.

## 1. Core Functionality Analysis

### 1.1 URL to Image Generator (url-to-image-imagen4-gemini-flash)
**Core Features:**
- Multi-step workflow with progress tracking
- Firecrawl scraping for website content
- AI prompt generation using Gemini
- Image generation with multiple style options
- Real-time streaming for "thinking" steps

**Key Technologies:**
- Next.js with TypeScript
- Firecrawl API for web scraping
- Gemini API for prompt generation
- Imagen 4 API for image generation
- Streaming response handling

### 1.2 AI Resume Job Matching
**Core Features:**
- PDF resume parsing
- Job posting scraping from multiple sources
- AI-powered matching evaluation
- Discord notifications for matches
- Database for job sources

**Key Technologies:**
- Streamlit (Python)
- Firecrawl batch scraping
- OpenAI/LLM for matching
- SQLite for persistence

### 1.3 Email to Company Intelligence
**Core Features:**
- Domain extraction from email
- Company website scraping
- Recent news search
- Funding information gathering
- Partnership alignment analysis
- Report generation (MD/HTML/JSON)

**Key Technologies:**
- LangGraph for workflow orchestration
- Firecrawl search API
- OpenAI for analysis
- Multi-format report generation

### 1.4 Search to Slides
**Core Features:**
- Search result aggregation
- AI-powered slide content generation
- HTML presentation generation
- Multiple slide types (title, list, quote, stats)

**Key Technologies:**
- Firecrawl search API
- OpenAI for content generation
- Reveal.js for presentations

### 1.5 Post Predictor (Twitter/X)
**Core Features:**
- Tweet analysis
- Trend analysis with optional Firecrawl enhancement
- Virality score prediction
- Animated chart visualization

**Key Technologies:**
- Next.js with TypeScript
- Chart.js for visualizations
- API key management in browser

### 1.6 Search Competitor Analysis
**Core Features:**
- Multi-strategy search with retries
- Competitor website scraping
- AI-powered data extraction
- Comprehensive report generation
- LangGraph workflow with conditional edges

**Key Technologies:**
- LangGraph for workflow
- Firecrawl search and scrape
- OpenAI for analysis
- Marked for HTML generation

## 2. Implementation Architecture

### 2.1 Component Structure

```typescript
// Core Components
/components
  /firecrawl
    /UrlToImage
      - ImageStyleSelector.tsx
      - ProgressBar.tsx
      - ResultDisplay.tsx
      - StreamingPromptDisplay.tsx
    /CompanyIntel
      - EmailInput.tsx
      - CompanyAnalysis.tsx
      - AlignmentScore.tsx
      - ReportGenerator.tsx
    /CompetitorAnalysis
      - SearchStrategies.tsx
      - CompetitorGrid.tsx
      - AnalysisReport.tsx
    /PostPredictor
      - TweetInput.tsx
      - PredictionChart.tsx
      - TrendAnalysis.tsx
    /SearchToSlides
      - SearchResults.tsx
      - SlidePreview.tsx
      - PresentationViewer.tsx
    /shared
      - ApiKeyManager.tsx
      - StreamingDisplay.tsx
      - ProgressIndicator.tsx
      - ReportExporter.tsx
```

### 2.2 API Routes Structure

```typescript
// API Routes
/api
  /firecrawl
    /scrape
      - route.ts (unified scraping endpoint)
    /search
      - route.ts (search functionality)
    /batch-scrape
      - route.ts (multiple URL scraping)
  /ai
    /gemini
      - route.ts (Gemini integration with streaming)
    /openai
      - route.ts (OpenAI integration)
    /imagen
      - route.ts (Image generation)
  /analysis
    /company-intel
      - route.ts (company analysis workflow)
    /competitor
      - route.ts (competitor analysis)
    /post-prediction
      - route.ts (social media prediction)
  /reports
    /generate
      - route.ts (multi-format report generation)
    /export
      - route.ts (PDF/HTML/JSON export)
```

### 2.3 Database Schema Additions

```sql
-- Job Sources for Resume Matching
CREATE TABLE job_sources (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  name TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Company Intel Cache
CREATE TABLE company_intel (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  domain TEXT NOT NULL,
  company_data JSONB,
  recent_news JSONB,
  funding_info JSONB,
  alignment_analysis JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

-- Competitor Analysis Results
CREATE TABLE competitor_analyses (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  competitors JSONB,
  analysis_data JSONB,
  report_markdown TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Change Detection Tracking
CREATE TABLE change_tracking (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  last_content_hash TEXT,
  last_checked TIMESTAMP,
  change_detected BOOLEAN DEFAULT false,
  changes JSONB
);
```

### 2.4 Real-time Features Implementation

#### WebSocket Integration for Live Updates
```typescript
// WebSocket handler for real-time updates
import { Server } from 'socket.io';

export class FirecrawlWebSocketHandler {
  private io: Server;
  
  constructor(server: any) {
    this.io = new Server(server);
    this.setupHandlers();
  }
  
  setupHandlers() {
    this.io.on('connection', (socket) => {
      // Handle crawl progress
      socket.on('crawl:start', async (data) => {
        const { url, options } = data;
        // Start crawl and emit progress
        this.startCrawlWithProgress(socket, url, options);
      });
      
      // Handle live change detection
      socket.on('watch:start', async (data) => {
        const { url, interval } = data;
        this.startWatching(socket, url, interval);
      });
    });
  }
  
  async startCrawlWithProgress(socket: any, url: string, options: any) {
    // Implement crawl with progress updates
    const crawlId = await firecrawl.crawlUrl(url, {
      ...options,
      webhook: {
        url: process.env.WEBHOOK_URL,
        headers: { 'X-Socket-ID': socket.id }
      }
    });
    
    // Emit progress updates
    socket.emit('crawl:progress', { crawlId, status: 'started' });
  }
  
  async startWatching(socket: any, url: string, interval: number) {
    // Implement change detection with polling
    const watchInterval = setInterval(async () => {
      const changes = await this.checkForChanges(url);
      if (changes) {
        socket.emit('change:detected', { url, changes });
      }
    }, interval);
    
    socket.on('disconnect', () => {
      clearInterval(watchInterval);
    });
  }
}
```

#### Streaming Response Handler
```typescript
// Streaming handler for AI responses
export async function* streamAIResponse(prompt: string, apiKey: string) {
  const response = await fetch('/api/ai/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    body: JSON.stringify({ prompt })
  });
  
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const data = JSON.parse(line);
          yield data;
        } catch (e) {
          console.error('Failed to parse streaming chunk:', e);
        }
      }
    }
  }
}
```

### 2.5 Error Handling and Retry Logic

```typescript
// Robust error handling with retries
export class FirecrawlService {
  private maxRetries = 3;
  private retryDelay = 1000;
  
  async scrapeWithRetry(url: string, options?: any): Promise<any> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this.scrape(url, options);
      } catch (error) {
        lastError = error as Error;
        console.error(`Attempt ${attempt + 1} failed:`, error);
        
        if (attempt < this.maxRetries - 1) {
          await this.delay(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }
    
    throw new Error(`Failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 2.6 UI/UX Requirements

#### Progress Indicators
- Multi-step progress bars with animations
- Real-time status updates
- Loading messages that change based on current operation
- Smooth transitions between steps

#### Interactive Components
- Drag-and-drop for file uploads
- Click-to-copy functionality
- Expandable/collapsible sections
- Animated charts and visualizations

#### Responsive Design
- Mobile-first approach
- Adaptive layouts for different screen sizes
- Touch-friendly interactions
- Optimized loading states

## 3. Integration with EVA's Existing Architecture

### 3.1 Database Integration
```typescript
// Extend existing Supabase integration
export async function saveFirecrawlResult(data: any) {
  const { data: result, error } = await supabase
    .from('firecrawl_results')
    .insert({
      type: data.type,
      url: data.url,
      content: data.content,
      metadata: data.metadata,
      user_id: data.userId
    })
    .select()
    .single();
    
  if (error) throw error;
  return result;
}
```

### 3.2 Authentication Integration
```typescript
// Use existing auth context
export function useFirecrawlAuth() {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState<string>('');
  
  useEffect(() => {
    // Load user's Firecrawl API key from secure storage
    if (user) {
      loadUserApiKey(user.id).then(setApiKey);
    }
  }, [user]);
  
  return { apiKey, setApiKey, userId: user?.id };
}
```

### 3.3 State Management Integration
```typescript
// Redux slice for Firecrawl features
export const firecrawlSlice = createSlice({
  name: 'firecrawl',
  initialState: {
    scrapeResults: {},
    searchResults: [],
    crawlProgress: {},
    activeJobs: []
  },
  reducers: {
    setScrapeResult: (state, action) => {
      state.scrapeResults[action.payload.url] = action.payload.data;
    },
    updateCrawlProgress: (state, action) => {
      state.crawlProgress[action.payload.jobId] = action.payload.progress;
    }
  }
});
```

## 4. Best Practices and Optimizations

### 4.1 Caching Strategy
- Cache scrape results with TTL
- Implement intelligent cache invalidation
- Use Redis for distributed caching

### 4.2 Rate Limiting
- Implement per-user rate limits
- Queue management for batch operations
- Graceful degradation when limits reached

### 4.3 Security Considerations
- Secure API key storage
- Input validation and sanitization
- CORS configuration for API endpoints
- Content Security Policy for generated content

### 4.4 Performance Optimizations
- Lazy loading for heavy components
- Image optimization for generated content
- Efficient data structures for large results
- Background job processing for long operations

## 5. Testing Strategy

### 5.1 Unit Tests
```typescript
// Example test for scraping service
describe('FirecrawlService', () => {
  it('should retry failed requests', async () => {
    const service = new FirecrawlService();
    mockFirecrawlAPI.failTimes(2);
    
    const result = await service.scrapeWithRetry('https://example.com');
    expect(result).toBeDefined();
    expect(mockFirecrawlAPI.calls).toBe(3);
  });
});
```

### 5.2 Integration Tests
- Test complete workflows end-to-end
- Mock external APIs for reliability
- Test error scenarios and edge cases

### 5.3 E2E Tests
- Test user flows with Playwright
- Verify real-time features work correctly
- Test responsive design on multiple devices

## 6. Deployment Considerations

### 6.1 Environment Variables
```env
# Firecrawl Configuration
FIRECRAWL_API_KEY=your-key
FIRECRAWL_WEBHOOK_URL=https://your-app.com/webhooks/firecrawl

# AI Services
OPENAI_API_KEY=your-key
GEMINI_API_KEY=your-key
FAL_API_KEY=your-key

# WebSocket Configuration
WS_PORT=3001
WS_ORIGIN=https://your-app.com
```

### 6.2 Infrastructure Requirements
- WebSocket server for real-time features
- Background job processor (Bull/BullMQ)
- Redis for caching and job queues
- CDN for generated content

## 7. Timeline and Priorities

### Phase 1 (Week 1-2): Core Infrastructure
- Set up API routes and services
- Implement basic scraping functionality
- Add database schema changes

### Phase 2 (Week 3-4): Feature Implementation
- URL to Image generator
- Company Intelligence tool
- Basic real-time features

### Phase 3 (Week 5-6): Advanced Features
- Competitor Analysis with LangGraph
- Search to Slides generator
- Post Predictor

### Phase 4 (Week 7-8): Polish and Optimization
- Performance optimization
- Enhanced error handling
- Comprehensive testing
- Documentation

This implementation plan provides a solid foundation for integrating Firecrawl's powerful features into EVA while maintaining compatibility with the existing architecture.