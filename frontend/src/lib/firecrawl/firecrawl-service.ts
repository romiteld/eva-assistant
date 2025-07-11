import FirecrawlApp from '@mendable/firecrawl-js';
import { supabase } from '@/lib/supabase/browser';
import { EventEmitter } from 'events';

interface FirecrawlConfig {
  apiKey: string;
  baseUrl?: string;
}

interface ScrapedData {
  id: string;
  url: string;
  title?: string;
  content: string;
  markdown: string;
  metadata?: any;
  timestamp: string;
}

interface CrawlJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  url: string;
  type: 'scrape' | 'crawl' | 'map' | 'search' | 'extract';
  options?: any;
  result?: any;
  error?: string;
  progress?: number;
  createdAt: string;
  updatedAt: string;
}

export class FirecrawlService extends EventEmitter {
  private client: FirecrawlApp;
  private activeJobs: Map<string, CrawlJob> = new Map();
  private streamInterval?: NodeJS.Timeout;

  constructor(config: FirecrawlConfig) {
    super();
    this.client = new FirecrawlApp({ apiKey: config.apiKey });
    this.setupRealtimeSubscriptions();
  }

  private setupRealtimeSubscriptions() {
    // Subscribe to crawl job updates for real-time streaming
    const channel = supabase
      .channel('firecrawl-jobs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'firecrawl_jobs'
        },
        (payload) => {
          this.handleJobUpdate(payload);
        }
      )
      .subscribe();

    // Cleanup on disconnect
    this.on('disconnect', () => {
      channel.unsubscribe();
    });
  }

  private handleJobUpdate(payload: any) {
    const { eventType, new: newData, old: oldData } = payload;
    
    switch (eventType) {
      case 'INSERT':
        this.emit('job:created', newData);
        break;
      case 'UPDATE':
        this.emit('job:updated', newData);
        if (newData.status === 'completed') {
          this.emit('job:completed', newData);
        }
        break;
      case 'DELETE':
        this.emit('job:deleted', oldData);
        break;
    }
  }

  // Scrape a single URL
  async scrapeUrl(url: string, options?: any): Promise<ScrapedData> {
    try {
      const job = this.createJob(url, 'scrape', options);
      this.emit('job:started', job);

      const result = await this.client.scrapeUrl(url, {
        formats: ['markdown', 'html'],
        ...options
      });

      // Type guard to check if result has data property
      if ('data' in result && result.data) {
        const data = result.data as any;
        const scrapedData: ScrapedData = {
          id: job.id,
          url,
          title: data?.metadata?.title,
          content: data?.html || '',
          markdown: data?.markdown || '',
          metadata: data?.metadata,
          timestamp: new Date().toISOString()
        };

        // Store in Supabase
        await this.storeScrapedData(scrapedData);

        job.status = 'completed';
        job.result = scrapedData;
        this.updateJob(job);

        return scrapedData;
      } else {
        throw new Error('Failed to scrape URL: No data returned');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('job:error', { url, error: errorMessage });
      throw error;
    }
  }

  // Crawl a website
  async crawlWebsite(url: string, params?: any): Promise<string> {
    try {
      const job = this.createJob(url, 'crawl', params);
      this.emit('job:started', job);

      const crawlResult = await this.client.crawlUrl(url, params);
      
      // Type guard to check if crawlResult has jobId
      if ('jobId' in crawlResult && crawlResult.jobId) {
        job.status = 'processing';
        job.result = { jobId: crawlResult.jobId };
        this.updateJob(job);

        // Start monitoring the crawl status
        this.monitorCrawlStatus(crawlResult.jobId as string, job.id);

        return crawlResult.jobId as string;
      } else {
        throw new Error('Failed to start crawl: No job ID returned');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('job:error', { url, error: errorMessage });
      throw error;
    }
  }

  // Monitor crawl status
  private async monitorCrawlStatus(crawlId: string, jobId: string) {
    const checkStatus = async () => {
      try {
        const status = await this.client.checkCrawlStatus(crawlId);
        const job = this.activeJobs.get(jobId);
        
        if (!job) return;

        // Type guard to check if status has the expected properties
        if ('status' in status && 'completed' in status && 'total' in status) {
          job.progress = Math.round((status.completed / status.total) * 100);
          this.updateJob(job);
          this.emit('crawl:progress', { jobId, status });

          if (status.status === 'completed') {
            job.status = 'completed';
            if ('data' in status && status.data) {
              job.result = status.data;
              this.updateJob(job);
              
              // Store crawled data
              await this.storeCrawledData(status.data, jobId);
              this.emit('crawl:completed', { jobId, data: status.data });
            }
            
            clearInterval(this.streamInterval);
          }
        }
      } catch (error) {
        console.error('Error checking crawl status:', error);
        clearInterval(this.streamInterval);
      }
    };

    // Check status every 2 seconds
    this.streamInterval = setInterval(checkStatus, 2000);
    checkStatus(); // Initial check
  }

  // Map a website (get all URLs)
  async mapWebsite(url: string, options?: any): Promise<string[]> {
    try {
      const job = this.createJob(url, 'map', options);
      this.emit('job:started', job);

      const result = await this.client.mapUrl(url, options);
      
      job.status = 'completed';
      job.result = result;
      this.updateJob(job);

      return Array.isArray(result) ? result : [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('job:error', { url, error: errorMessage });
      throw error;
    }
  }

  // Search the web
  async search(query: string, options?: any): Promise<any> {
    try {
      const job = this.createJob(query, 'search', options);
      this.emit('job:started', job);

      const result = await this.client.search(query, options);
      
      job.status = 'completed';
      job.result = result;
      this.updateJob(job);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('job:error', { url: query, error: errorMessage });
      throw error;
    }
  }

  // Extract structured data
  async extract(urls: string[], options?: any): Promise<any> {
    try {
      const job = this.createJob(urls.join(','), 'extract', options);
      this.emit('job:started', job);

      const result = await this.client.extract(urls, options);
      
      job.status = 'completed';
      job.result = result;
      this.updateJob(job);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('job:error', { url: urls.join(','), error: errorMessage });
      throw error;
    }
  }

  // Store scraped data in Supabase
  private async storeScrapedData(data: ScrapedData) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    await supabase
      .from('firecrawl_scraped_data')
      .insert({
        user_id: user.id,
        url: data.url,
        title: data.title,
        content: data.content,
        markdown: data.markdown,
        metadata: data.metadata,
        scraped_at: data.timestamp
      });
  }

  // Store crawled data in Supabase
  private async storeCrawledData(documents: any[], jobId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const records = documents.map(doc => ({
      user_id: user.id,
      job_id: jobId,
      url: doc.url,
      title: doc.metadata?.title,
      content: doc.html || doc.content,
      markdown: doc.markdown,
      metadata: doc.metadata,
      scraped_at: new Date().toISOString()
    }));

    await supabase
      .from('firecrawl_scraped_data')
      .insert(records);
  }

  // Create a new job
  private createJob(url: string, type: CrawlJob['type'], options?: any): CrawlJob {
    const job: CrawlJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      url,
      type,
      options,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.activeJobs.set(job.id, job);
    return job;
  }

  // Update job status
  private updateJob(job: CrawlJob) {
    job.updatedAt = new Date().toISOString();
    this.activeJobs.set(job.id, job);
    this.emit('job:updated', job);
  }

  // Get active jobs
  getActiveJobs(): CrawlJob[] {
    return Array.from(this.activeJobs.values());
  }

  // Get job by ID
  getJob(jobId: string): CrawlJob | undefined {
    return this.activeJobs.get(jobId);
  }

  // Cancel a job
  cancelJob(jobId: string) {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = 'Cancelled by user';
      this.updateJob(job);
      this.activeJobs.delete(jobId);
    }
  }

  // Clean up
  disconnect() {
    if (this.streamInterval) {
      clearInterval(this.streamInterval);
    }
    this.emit('disconnect');
    this.removeAllListeners();
  }
}

// Export singleton instance
let firecrawlInstance: FirecrawlService | null = null;

export const getFirecrawlService = () => {
  if (!firecrawlInstance) {
    const apiKey = process.env.NEXT_PUBLIC_FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error('NEXT_PUBLIC_FIRECRAWL_API_KEY is not set');
    }
    firecrawlInstance = new FirecrawlService({ apiKey });
  }
  return firecrawlInstance;
};