import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase/browser';
import { firecrawl, firecrawlEvents } from './client';
import { 
  gatherCompanyIntel, 
  predictPostPerformance, 
  analyzeCompetitors, 
  matchResumeToJobs 
} from './agents';

// Hook for real-time Firecrawl operations
export function useFirecrawl() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to Firecrawl events
  useEffect(() => {
    const handleProgress = (data: any) => {
      setProgress({ current: data.progress || 0, total: data.total || 0 });
    };

    const handleError = (data: any) => {
      setError(data.error?.message || 'Operation failed');
      setLoading(false);
    };

    const handleComplete = () => {
      setLoading(false);
    };

    firecrawlEvents.on('crawl:progress', handleProgress);
    firecrawlEvents.on('scrape:error', handleError);
    firecrawlEvents.on('crawl:error', handleError);
    firecrawlEvents.on('search:error', handleError);
    firecrawlEvents.on('extract:error', handleError);
    firecrawlEvents.on('scrape:complete', handleComplete);
    firecrawlEvents.on('crawl:complete', handleComplete);
    firecrawlEvents.on('search:complete', handleComplete);
    firecrawlEvents.on('extract:complete', handleComplete);

    return () => {
      firecrawlEvents.off('crawl:progress', handleProgress);
      firecrawlEvents.off('scrape:error', handleError);
      firecrawlEvents.off('crawl:error', handleError);
      firecrawlEvents.off('search:error', handleError);
      firecrawlEvents.off('extract:error', handleError);
      firecrawlEvents.off('scrape:complete', handleComplete);
      firecrawlEvents.off('crawl:complete', handleComplete);
      firecrawlEvents.off('search:complete', handleComplete);
      firecrawlEvents.off('extract:complete', handleComplete);
    };
  }, []);

  // Scrape URL with streaming
  const scrapeUrl = useCallback(async (url: string, options?: any) => {
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const stream = firecrawl.scrapeStream(url, options);
      for await (const data of stream) {
        setResults(prev => [...prev, data]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Crawl website with progress
  const crawlWebsite = useCallback(async (url: string, options?: any) => {
    setLoading(true);
    setError(null);
    setResults([]);
    setProgress({ current: 0, total: 0 });

    try {
      const stream = firecrawl.crawlStream(url, options);
      for await (const data of stream) {
        if (data.type === 'progress') {
          setProgress({ current: data.progress, total: data.total });
        } else {
          setResults(prev => [...prev, data]);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Map website
  const mapWebsite = useCallback(async (url: string, options?: any) => {
    setLoading(true);
    setError(null);

    try {
      const links = await firecrawl.map(url, options);
      setResults(links);
      return links;
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Search with streaming
  const search = useCallback(async (query: string, options?: any) => {
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const stream = firecrawl.searchStream(query, options);
      for await (const result of stream) {
        setResults(prev => [...prev, result]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Extract structured data
  const extract = useCallback(async (urls: string[], schema: any, options?: any) => {
    setLoading(true);
    setError(null);

    try {
      const data = await firecrawl.extract(urls, schema, options);
      setResults([data]);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Agent operations
  const agents = {
    gatherCompanyIntel: useCallback(async (domain: string, context: any) => {
      setLoading(true);
      setError(null);
      try {
        const intel = await gatherCompanyIntel(domain, context);
        setResults([intel]);
        return intel;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    }, []),

    predictPostPerformance: useCallback(async (content: string, platform: 'twitter' | 'linkedin') => {
      setLoading(true);
      setError(null);
      try {
        const prediction = await predictPostPerformance(content, platform);
        setResults([prediction]);
        return prediction;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    }, []),

    analyzeCompetitors: useCallback(async (domains: string[], focusAreas: string[]) => {
      setLoading(true);
      setError(null);
      try {
        const analysis = await analyzeCompetitors(domains, focusAreas);
        setResults([analysis]);
        return analysis;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    }, []),

    matchResumeToJobs: useCallback(async (resumeText: string, requirements: any) => {
      setLoading(true);
      setError(null);
      try {
        const matches = await matchResumeToJobs(resumeText, requirements);
        setResults(matches);
        return matches;
      } catch (err: any) {
        setError(err.message);
        return [];
      } finally {
        setLoading(false);
      }
    }, []),
  };

  return {
    loading,
    progress,
    results,
    error,
    scrapeUrl,
    crawlWebsite,
    mapWebsite,
    search,
    extract,
    agents,
  };
}