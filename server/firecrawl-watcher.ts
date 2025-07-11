// Firecrawl Watch Mode Integration
import { Server, Socket } from 'socket.io';
import { SupabaseClient } from '@supabase/supabase-js';
import FirecrawlApp from '@mendable/firecrawl-js';

interface WatchSession {
  sessionId: string;
  userId: string;
  url: string;
  options: WatchOptions;
  status: 'active' | 'paused' | 'stopped';
  startTime: number;
  lastCheck: number;
  changes: UrlChange[];
}

interface WatchOptions {
  checkInterval: number; // in seconds
  includeSubpages: boolean;
  depth: number;
  alertThreshold: number; // percentage of change to trigger alert
  selectors?: string[]; // specific elements to watch
  excludeSelectors?: string[];
  compareMode: 'text' | 'html' | 'visual';
}

interface UrlChange {
  timestamp: number;
  url: string;
  changeType: 'content' | 'structure' | 'visual' | 'new_page' | 'removed_page';
  changePercentage: number;
  details: {
    added?: string[];
    removed?: string[];
    modified?: string[];
    screenshot?: string;
  };
}

interface CrawlProgress {
  sessionId: string;
  status: 'crawling' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentUrl: string;
  totalUrls: number;
  processedUrls: number;
  errors: string[];
}

export class FirecrawlWatcher {
  private io: Server;
  private supabase: SupabaseClient;
  private firecrawl: FirecrawlApp;
  private watchSessions: Map<string, WatchSession>;
  private watchTimers: Map<string, NodeJS.Timer>;
  private crawlJobs: Map<string, any>;
  private pageSnapshots: Map<string, any>;

  constructor(io: Server, supabase: SupabaseClient) {
    this.io = io;
    this.supabase = supabase;
    this.firecrawl = new FirecrawlApp({
      apiKey: process.env.FIRECRAWL_API_KEY!
    });
    this.watchSessions = new Map();
    this.watchTimers = new Map();
    this.crawlJobs = new Map();
    this.pageSnapshots = new Map();
  }

  handleConnection(socket: Socket) {
    const userId = socket.data.userId;

    // Start watching a URL
    socket.on('firecrawl:watch', async (data: {
      url: string;
      options?: Partial<WatchOptions>;
    }) => {
      const sessionId = await this.startWatching(socket, userId, data);
      socket.emit('firecrawl:watch-started', { sessionId });
    });

    // Stop watching
    socket.on('firecrawl:stop-watch', (sessionId: string) => {
      this.stopWatching(sessionId);
      socket.emit('firecrawl:watch-stopped', { sessionId });
    });

    // Pause/resume watching
    socket.on('firecrawl:pause-watch', (sessionId: string) => {
      this.pauseWatching(sessionId);
      socket.emit('firecrawl:watch-paused', { sessionId });
    });

    socket.on('firecrawl:resume-watch', (sessionId: string) => {
      this.resumeWatching(sessionId);
      socket.emit('firecrawl:watch-resumed', { sessionId });
    });

    // Start crawl with progress tracking
    socket.on('firecrawl:crawl-start', async (data: {
      url: string;
      options?: {
        maxDepth?: number;
        limit?: number;
        includeSubdomains?: boolean;
        excludePaths?: string[];
        includePaths?: string[];
      };
    }) => {
      await this.startCrawlWithProgress(socket, userId, data);
    });

    // Get watch session details
    socket.on('firecrawl:get-session', (sessionId: string) => {
      const session = this.watchSessions.get(sessionId);
      if (session && session.userId === userId) {
        socket.emit('firecrawl:session-details', session);
      }
    });

    // Get all active sessions for user
    socket.on('firecrawl:list-sessions', () => {
      const userSessions = Array.from(this.watchSessions.values())
        .filter(session => session.userId === userId);
      socket.emit('firecrawl:sessions-list', userSessions);
    });

    // Manual check for changes
    socket.on('firecrawl:check-now', async (sessionId: string) => {
      const session = this.watchSessions.get(sessionId);
      if (session && session.userId === userId) {
        await this.checkForChanges(sessionId);
      }
    });

    // Update watch options
    socket.on('firecrawl:update-options', (data: {
      sessionId: string;
      options: Partial<WatchOptions>;
    }) => {
      const session = this.watchSessions.get(data.sessionId);
      if (session && session.userId === userId) {
        session.options = { ...session.options, ...data.options };
        
        // Restart timer with new interval if needed
        if (data.options.checkInterval) {
          this.restartTimer(data.sessionId);
        }
        
        socket.emit('firecrawl:options-updated', { sessionId: data.sessionId });
      }
    });
  }

  private async startWatching(
    socket: Socket,
    userId: string,
    data: {
      url: string;
      options?: Partial<WatchOptions>;
    }
  ): Promise<string> {
    const sessionId = `watch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const defaultOptions: WatchOptions = {
      checkInterval: 300, // 5 minutes
      includeSubpages: false,
      depth: 1,
      alertThreshold: 5, // 5% change triggers alert
      compareMode: 'text'
    };

    const session: WatchSession = {
      sessionId,
      userId,
      url: data.url,
      options: { ...defaultOptions, ...data.options },
      status: 'active',
      startTime: Date.now(),
      lastCheck: Date.now(),
      changes: []
    };

    this.watchSessions.set(sessionId, session);

    // Take initial snapshot
    await this.takeSnapshot(sessionId);

    // Start monitoring
    this.startTimer(sessionId);

    // Log to database
    await this.supabase.from('watch_sessions').insert({
      id: sessionId,
      user_id: userId,
      url: data.url,
      options: session.options,
      status: 'active',
      started_at: new Date().toISOString()
    });

    return sessionId;
  }

  private async takeSnapshot(sessionId: string) {
    const session = this.watchSessions.get(sessionId);
    if (!session) return;

    try {
      const scrapeResult = await this.firecrawl.scrapeUrl(session.url, {
        formats: ['markdown', 'html', 'screenshot'],
        onlyMainContent: true,
        waitFor: 2000
      });

      const snapshot = {
        timestamp: Date.now(),
        content: scrapeResult.markdown,
        html: scrapeResult.html,
        screenshot: scrapeResult.screenshot,
        metadata: scrapeResult.metadata
      };

      // Store snapshot
      const snapshotKey = `${sessionId}:${session.url}`;
      this.pageSnapshots.set(snapshotKey, snapshot);

      // Save to database
      await this.supabase.from('page_snapshots').insert({
        session_id: sessionId,
        url: session.url,
        content: snapshot.content,
        html: snapshot.html,
        screenshot_url: snapshot.screenshot,
        metadata: snapshot.metadata,
        created_at: new Date().toISOString()
      });

    } catch (error) {
      console.error('Failed to take snapshot:', error);
      this.io.to(`user:${session.userId}`).emit('firecrawl:snapshot-error', {
        sessionId,
        error: error.message
      });
    }
  }

  private async checkForChanges(sessionId: string) {
    const session = this.watchSessions.get(sessionId);
    if (!session || session.status !== 'active') return;

    try {
      // Get current content
      const currentResult = await this.firecrawl.scrapeUrl(session.url, {
        formats: ['markdown', 'html', 'screenshot'],
        onlyMainContent: true,
        waitFor: 2000
      });

      const snapshotKey = `${sessionId}:${session.url}`;
      const previousSnapshot = this.pageSnapshots.get(snapshotKey);

      if (previousSnapshot) {
        // Compare content
        const changes = this.compareContent(
          previousSnapshot,
          currentResult,
          session.options
        );

        if (changes.changePercentage > session.options.alertThreshold) {
          // Significant change detected
          const change: UrlChange = {
            timestamp: Date.now(),
            url: session.url,
            changeType: 'content',
            changePercentage: changes.changePercentage,
            details: changes.details
          };

          session.changes.push(change);
          session.lastCheck = Date.now();

          // Notify user
          this.io.to(`user:${session.userId}`).emit('firecrawl:change-detected', {
            sessionId,
            change
          });

          // Save change to database
          await this.supabase.from('url_changes').insert({
            session_id: sessionId,
            url: session.url,
            change_type: change.changeType,
            change_percentage: change.changePercentage,
            details: change.details,
            detected_at: new Date().toISOString()
          });

          // Update snapshot
          this.pageSnapshots.set(snapshotKey, {
            timestamp: Date.now(),
            content: currentResult.markdown,
            html: currentResult.html,
            screenshot: currentResult.screenshot,
            metadata: currentResult.metadata
          });
        }
      }

      // Check subpages if enabled
      if (session.options.includeSubpages) {
        await this.checkSubpages(session, currentResult.links);
      }

    } catch (error) {
      console.error('Error checking for changes:', error);
      this.io.to(`user:${session.userId}`).emit('firecrawl:check-error', {
        sessionId,
        error: error.message
      });
    }
  }

  private compareContent(
    previous: any,
    current: any,
    options: WatchOptions
  ): {
    changePercentage: number;
    details: any;
  } {
    let changePercentage = 0;
    const details: any = {
      added: [],
      removed: [],
      modified: []
    };

    switch (options.compareMode) {
      case 'text':
        // Compare markdown content
        const prevLines = previous.content.split('\n');
        const currLines = current.markdown.split('\n');
        
        // Simple diff algorithm
        const added = currLines.filter(line => !prevLines.includes(line));
        const removed = prevLines.filter(line => !currLines.includes(line));
        
        details.added = added.slice(0, 10); // Limit to 10 examples
        details.removed = removed.slice(0, 10);
        
        const totalLines = Math.max(prevLines.length, currLines.length);
        changePercentage = ((added.length + removed.length) / totalLines) * 100;
        break;
        
      case 'html':
        // Compare HTML structure
        // This would use a more sophisticated HTML diff algorithm
        break;
        
      case 'visual':
        // Compare screenshots using image diff
        // This would require image processing capabilities
        break;
    }

    return { changePercentage, details };
  }

  private async checkSubpages(session: WatchSession, links: string[]) {
    // Filter links based on depth and include/exclude rules
    const validLinks = links.filter(link => {
      try {
        const url = new URL(link);
        const baseUrl = new URL(session.url);
        return url.hostname === baseUrl.hostname;
      } catch {
        return false;
      }
    });

    // Check each subpage (with rate limiting)
    for (const link of validLinks.slice(0, 10)) { // Limit to 10 subpages
      const snapshotKey = `${session.sessionId}:${link}`;
      
      if (!this.pageSnapshots.has(snapshotKey)) {
        // New page detected
        const change: UrlChange = {
          timestamp: Date.now(),
          url: link,
          changeType: 'new_page',
          changePercentage: 100,
          details: {}
        };

        session.changes.push(change);
        
        this.io.to(`user:${session.userId}`).emit('firecrawl:change-detected', {
          sessionId: session.sessionId,
          change
        });
      }
    }
  }

  private async startCrawlWithProgress(
    socket: Socket,
    userId: string,
    data: {
      url: string;
      options?: any;
    }
  ) {
    const crawlId = `crawl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Start async crawl
      const crawlResult = await this.firecrawl.crawlUrl(data.url, {
        ...data.options,
        webhook: `${process.env.BACKEND_URL}/api/firecrawl/webhook/${crawlId}`
      });

      this.crawlJobs.set(crawlId, {
        id: crawlId,
        userId,
        jobId: crawlResult.id,
        startTime: Date.now(),
        status: 'crawling'
      });

      socket.emit('firecrawl:crawl-started', {
        crawlId,
        jobId: crawlResult.id
      });

      // Start polling for progress
      this.pollCrawlProgress(socket, crawlId, crawlResult.id);

    } catch (error) {
      console.error('Failed to start crawl:', error);
      socket.emit('firecrawl:crawl-error', {
        error: error.message
      });
    }
  }

  private async pollCrawlProgress(socket: Socket, crawlId: string, jobId: string) {
    const checkProgress = async () => {
      try {
        const status = await this.firecrawl.checkCrawlStatus(jobId);
        
        const progress: CrawlProgress = {
          sessionId: crawlId,
          status: status.status,
          progress: (status.completed / status.total) * 100,
          currentUrl: status.current || '',
          totalUrls: status.total,
          processedUrls: status.completed,
          errors: status.errors || []
        };

        socket.emit('firecrawl:crawl-progress', progress);

        if (status.status === 'completed') {
          // Get results
          const results = status.data;
          
          socket.emit('firecrawl:crawl-completed', {
            crawlId,
            results: {
              urls: results.length,
              data: results.slice(0, 100) // Limit initial data
            }
          });

          // Save results to database
          await this.saveCrawlResults(crawlId, results);
          
          // Clean up
          this.crawlJobs.delete(crawlId);
        } else if (status.status === 'failed') {
          socket.emit('firecrawl:crawl-failed', {
            crawlId,
            error: 'Crawl job failed'
          });
          this.crawlJobs.delete(crawlId);
        } else {
          // Continue polling
          setTimeout(() => checkProgress(), 2000);
        }
      } catch (error) {
        console.error('Error checking crawl progress:', error);
        socket.emit('firecrawl:crawl-error', {
          crawlId,
          error: error.message
        });
      }
    };

    checkProgress();
  }

  private async saveCrawlResults(crawlId: string, results: any[]) {
    try {
      // Save crawl metadata
      await this.supabase.from('crawl_jobs').insert({
        id: crawlId,
        url_count: results.length,
        completed_at: new Date().toISOString(),
        status: 'completed'
      });

      // Save individual pages (batch insert)
      const pages = results.map(page => ({
        crawl_id: crawlId,
        url: page.url,
        title: page.metadata?.title,
        content: page.markdown,
        html: page.html,
        metadata: page.metadata,
        created_at: new Date().toISOString()
      }));

      await this.supabase.from('crawled_pages').insert(pages);

    } catch (error) {
      console.error('Failed to save crawl results:', error);
    }
  }

  private startTimer(sessionId: string) {
    const session = this.watchSessions.get(sessionId);
    if (!session) return;

    const timer = setInterval(async () => {
      await this.checkForChanges(sessionId);
    }, session.options.checkInterval * 1000);

    this.watchTimers.set(sessionId, timer);
  }

  private restartTimer(sessionId: string) {
    this.stopTimer(sessionId);
    this.startTimer(sessionId);
  }

  private stopTimer(sessionId: string) {
    const timer = this.watchTimers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.watchTimers.delete(sessionId);
    }
  }

  private stopWatching(sessionId: string) {
    const session = this.watchSessions.get(sessionId);
    if (session) {
      session.status = 'stopped';
      this.stopTimer(sessionId);
      
      // Update database
      this.supabase
        .from('watch_sessions')
        .update({
          status: 'stopped',
          stopped_at: new Date().toISOString()
        })
        .eq('id', sessionId);
    }
  }

  private pauseWatching(sessionId: string) {
    const session = this.watchSessions.get(sessionId);
    if (session && session.status === 'active') {
      session.status = 'paused';
      this.stopTimer(sessionId);
    }
  }

  private resumeWatching(sessionId: string) {
    const session = this.watchSessions.get(sessionId);
    if (session && session.status === 'paused') {
      session.status = 'active';
      this.startTimer(sessionId);
    }
  }

  handleDisconnect(socket: Socket) {
    const userId = socket.data.userId;
    
    // Pause all active sessions for this user
    for (const [sessionId, session] of this.watchSessions) {
      if (session.userId === userId && session.status === 'active') {
        this.pauseWatching(sessionId);
      }
    }
  }

  async cleanup() {
    // Stop all timers
    for (const timer of this.watchTimers.values()) {
      clearInterval(timer);
    }
    this.watchTimers.clear();
    
    // Clear sessions
    this.watchSessions.clear();
    this.crawlJobs.clear();
    this.pageSnapshots.clear();
  }
}