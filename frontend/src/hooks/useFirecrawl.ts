import { useState, useEffect, useCallback } from 'react';
import { getFirecrawlService, FirecrawlService } from '@/lib/firecrawl/firecrawl-service';
import { useAuth } from '@/hooks/useAuth';

interface UseFirecrawlReturn {
  // State
  isLoading: boolean;
  error: string | null;
  activeJobs: any[];
  
  // Methods
  scrapeUrl: (url: string, options?: any) => Promise<any>;
  crawlWebsite: (url: string, options?: any) => Promise<string>;
  mapWebsite: (url: string, options?: any) => Promise<string[]>;
  search: (query: string, options?: any) => Promise<any>;
  extract: (urls: string[], options?: any) => Promise<any>;
  cancelJob: (jobId: string) => void;
  
  // Service instance
  service: FirecrawlService | null;
}

export function useFirecrawl(): UseFirecrawlReturn {
  const { user } = useAuth();
  const [service, setService] = useState<FirecrawlService | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    try {
      const firecrawlService = getFirecrawlService();
      setService(firecrawlService);

      // Set up event listeners
      const handleJobUpdate = () => {
        setActiveJobs(firecrawlService.getActiveJobs());
      };

      firecrawlService.on('job:started', handleJobUpdate);
      firecrawlService.on('job:updated', handleJobUpdate);
      firecrawlService.on('job:completed', handleJobUpdate);
      firecrawlService.on('job:error', (data: any) => {
        setError(data.error);
        handleJobUpdate();
      });

      return () => {
        firecrawlService.off('job:started', handleJobUpdate);
        firecrawlService.off('job:updated', handleJobUpdate);
        firecrawlService.off('job:completed', handleJobUpdate);
        firecrawlService.off('job:error', handleJobUpdate);
      };
    } catch (err) {
      console.error('Failed to initialize Firecrawl service:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize Firecrawl');
    }
  }, [user]);

  const scrapeUrl = useCallback(async (url: string, options?: any) => {
    if (!service) throw new Error('Firecrawl service not initialized');
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await service.scrapeUrl(url, options);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Scraping failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const crawlWebsite = useCallback(async (url: string, options?: any) => {
    if (!service) throw new Error('Firecrawl service not initialized');
    
    setIsLoading(true);
    setError(null);
    
    try {
      const jobId = await service.crawlWebsite(url, options);
      return jobId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Crawling failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const mapWebsite = useCallback(async (url: string, options?: any) => {
    if (!service) throw new Error('Firecrawl service not initialized');
    
    setIsLoading(true);
    setError(null);
    
    try {
      const urls = await service.mapWebsite(url, options);
      return urls;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Mapping failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const search = useCallback(async (query: string, options?: any) => {
    if (!service) throw new Error('Firecrawl service not initialized');
    
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await service.search(query, options);
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const extract = useCallback(async (urls: string[], options?: any) => {
    if (!service) throw new Error('Firecrawl service not initialized');
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await service.extract(urls, options);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Extraction failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const cancelJob = useCallback((jobId: string) => {
    if (!service) return;
    service.cancelJob(jobId);
  }, [service]);

  return {
    isLoading,
    error,
    activeJobs,
    scrapeUrl,
    crawlWebsite,
    mapWebsite,
    search,
    extract,
    cancelJob,
    service
  };
}