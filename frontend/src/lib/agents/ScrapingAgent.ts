import { z } from 'zod';
import { Agent, AgentConfig } from './base/Agent';
import { AgentType, RequestMessage } from './base/types';
import FirecrawlApp from '@mendable/firecrawl-js';

// Input/Output schemas
const ScrapeUrlSchema = z.object({
  url: z.string().url(),
  formats: z.array(z.enum(['markdown', 'html', 'rawHtml', 'screenshot', 'links'])).optional(),
  onlyMainContent: z.boolean().optional(),
  timeout: z.number().optional(),
});

const BatchScrapeSchema = z.object({
  urls: z.array(z.string().url()),
  formats: z.array(z.enum(['markdown', 'html', 'rawHtml'])).optional(),
  onlyMainContent: z.boolean().optional(),
});

const MapWebsiteSchema = z.object({
  url: z.string().url(),
  search: z.string().optional(),
  limit: z.number().optional(),
});

const SearchWebSchema = z.object({
  query: z.string(),
  limit: z.number().default(5),
  scrapeOptions: z.object({
    formats: z.array(z.enum(['markdown', 'html', 'rawHtml'])).optional(),
    onlyMainContent: z.boolean().optional(),
  }).optional(),
});

const ExtractDataSchema = z.object({
  urls: z.array(z.string().url()),
  prompt: z.string(),
  schema: z.record(z.string(), z.any()).optional(),
});

const DeepResearchSchema = z.object({
  query: z.string(),
  maxDepth: z.number().default(3),
  maxUrls: z.number().default(50),
  timeLimit: z.number().default(120),
});

export class ScrapingAgent extends Agent {
  private firecrawl?: FirecrawlApp;

  constructor(config?: Partial<AgentConfig>) {
    super({
      name: 'Scraping Agent',
      type: AgentType.SCRAPING,
      description: 'Handles web scraping, data extraction, and web research',
      ...config,
    });

    this.registerActions();
  }

  protected async onInitialize(): Promise<void> {
    // Initialize Firecrawl if API key is available
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (apiKey) {
      this.firecrawl = new FirecrawlApp({ apiKey });
    } else {
      console.warn('Firecrawl API key not found. Scraping functionality will be limited.');
    }
  }

  protected async onShutdown(): Promise<void> {
    // Clean up any resources
  }

  protected async processRequest(message: RequestMessage): Promise<any> {
    const { action, payload } = message;

    switch (action) {
      case 'scrape_url':
        return this.scrapeUrl(payload);
      case 'batch_scrape':
        return this.batchScrape(payload);
      case 'map_website':
        return this.mapWebsite(payload);
      case 'search_web':
        return this.searchWeb(payload);
      case 'extract_data':
        return this.extractData(payload);
      case 'deep_research':
        return this.deepResearch(payload);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private registerActions(): void {
    this.registerAction('scrape_url', {
      name: 'scrape_url',
      description: 'Scrape content from a single URL',
      inputSchema: ScrapeUrlSchema,
      outputSchema: z.object({
        markdown: z.string().optional(),
        html: z.string().optional(),
        rawHtml: z.string().optional(),
        screenshot: z.string().optional(),
        links: z.array(z.string()).optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
    });

    this.registerAction('batch_scrape', {
      name: 'batch_scrape',
      description: 'Scrape multiple URLs in parallel',
      inputSchema: BatchScrapeSchema,
      outputSchema: z.array(z.object({
        url: z.string(),
        success: z.boolean(),
        data: z.any().optional(),
        error: z.string().optional(),
      })),
    });

    this.registerAction('map_website', {
      name: 'map_website',
      description: 'Map all URLs on a website',
      inputSchema: MapWebsiteSchema,
      outputSchema: z.array(z.string()),
    });

    this.registerAction('search_web', {
      name: 'search_web',
      description: 'Search the web and optionally scrape results',
      inputSchema: SearchWebSchema,
      outputSchema: z.array(z.object({
        title: z.string(),
        url: z.string(),
        description: z.string().optional(),
        content: z.string().optional(),
      })),
    });

    this.registerAction('extract_data', {
      name: 'extract_data',
      description: 'Extract structured data from web pages',
      inputSchema: ExtractDataSchema,
      outputSchema: z.array(z.record(z.string(), z.any())),
    });

    this.registerAction('deep_research', {
      name: 'deep_research',
      description: 'Conduct deep web research on a topic',
      inputSchema: DeepResearchSchema,
      outputSchema: z.object({
        finalAnalysis: z.string(),
        sources: z.array(z.string()),
        activities: z.array(z.any()).optional(),
      }),
    });
  }

  private async scrapeUrl(input: z.infer<typeof ScrapeUrlSchema>) {
    if (!this.firecrawl) {
      throw new Error('Firecrawl not initialized');
    }

    try {
      const result = await this.firecrawl.scrapeUrl(input.url, {
        formats: input.formats || ['markdown'],
        onlyMainContent: input.onlyMainContent,
        timeout: input.timeout,
      });

      // Emit event
      this.broadcast('url_scraped', {
        url: input.url,
        success: true,
        format: input.formats?.[0] || 'markdown',
      });

      return result;
    } catch (error) {
      this.broadcast('scraping_failed', {
        url: input.url,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async batchScrape(input: z.infer<typeof BatchScrapeSchema>) {
    if (!this.firecrawl) {
      throw new Error('Firecrawl not initialized');
    }

    const results = await Promise.allSettled(
      input.urls.map(url =>
        this.scrapeUrl({
          url,
          formats: input.formats,
          onlyMainContent: input.onlyMainContent,
        })
      )
    );

    return results.map((result, index) => ({
      url: input.urls[index],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : undefined,
      error: result.status === 'rejected' ? result.reason.message : undefined,
    }));
  }

  private async mapWebsite(input: z.infer<typeof MapWebsiteSchema>) {
    if (!this.firecrawl) {
      throw new Error('Firecrawl not initialized');
    }

    const result = await this.firecrawl.mapUrl(input.url, {
      search: input.search,
      limit: input.limit,
    });

    // Check if result is an array (success) or error response
    const urlCount = Array.isArray(result) ? result.length : 0;

    this.broadcast('website_mapped', {
      url: input.url,
      urlCount: urlCount,
    });

    return result;
  }

  private async searchWeb(input: z.infer<typeof SearchWebSchema>) {
    if (!this.firecrawl) {
      throw new Error('Firecrawl not initialized');
    }

    const result = await this.firecrawl.search(input.query, {
      limit: input.limit,
      scrapeOptions: input.scrapeOptions,
    });

    // Check if result has data property with results array
    const resultCount = (result && typeof result === 'object' && 'data' in result && Array.isArray(result.data)) 
      ? result.data.length 
      : 0;

    this.broadcast('web_searched', {
      query: input.query,
      resultCount: resultCount,
    });

    return result;
  }

  private async extractData(input: z.infer<typeof ExtractDataSchema>) {
    if (!this.firecrawl) {
      throw new Error('Firecrawl not initialized');
    }

    const result = await this.firecrawl.extract(
      input.urls,
      {
        prompt: input.prompt,
        schema: input.schema,
      }
    );

    this.broadcast('data_extracted', {
      urlCount: input.urls.length,
      hasSchema: !!input.schema,
    });

    return result;
  }

  private async deepResearch(input: z.infer<typeof DeepResearchSchema>) {
    if (!this.firecrawl) {
      throw new Error('Firecrawl not initialized');
    }

    // Deep research involves combining search and crawl
    const searchResults = await this.firecrawl.search(input.query, {
      limit: Math.min(input.maxUrls || 50, 10),
    });

    // Extract URLs from search results
    const urls = searchResults.data?.map((r: any) => r.url) || [];
    
    // Crawl the top results for deeper analysis
    const crawlPromises = urls.slice(0, 5).map((url: string) => 
      this.firecrawl?.scrapeUrl(url, {
        formats: ['markdown'],
        onlyMainContent: true
      }).catch(err => ({ error: err.message, url }))
    );

    const crawledData = await Promise.all(crawlPromises);
    
    const result = {
      query: input.query,
      sources: crawledData.filter(d => d && !d.error),
      searchResults: searchResults.data || []
    };

    this.broadcast('research_completed', {
      query: input.query,
      sourcesCount: result.sources?.length || 0,
    });

    return result;
  }
}