import { useState, useEffect, useCallback } from 'react';

interface APIRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

interface APIResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

export function useSecureAPI() {
  const [csrfToken, setCSRFToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch CSRF token on mount
  useEffect(() => {
    fetchCSRFToken();
  }, []);

  const fetchCSRFToken = async () => {
    try {
      const response = await fetch('/api/csrf');
      const data = await response.json();
      setCSRFToken(data.csrfToken);
    } catch (error) {
      console.error('Failed to fetch CSRF token:', error);
    }
  };

  const makeRequest = useCallback(async <T = any>(
    endpoint: string,
    options: APIRequestOptions = {}
  ): Promise<APIResponse<T>> => {
    if (!csrfToken) {
      await fetchCSRFToken();
    }

    setLoading(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken || '',
        ...options.headers,
      };

      const response = await fetch(endpoint, {
        method: options.method || 'POST',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          error: data.error || 'Request failed',
          status: response.status,
        };
      }

      return {
        data: data.data || data,
        status: response.status,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Network error',
        status: 0,
      };
    } finally {
      setLoading(false);
    }
  }, [csrfToken]);

  // Firecrawl API methods
  const firecrawl = {
    scrape: async (url: string, options?: any) => {
      return makeRequest('/api/firecrawl', {
        body: { action: 'scrape', url, ...options },
      });
    },
    crawl: async (url: string, options?: any) => {
      return makeRequest('/api/firecrawl', {
        body: { action: 'crawl', url, ...options },
      });
    },
    map: async (url: string, options?: any) => {
      return makeRequest('/api/firecrawl', {
        body: { action: 'map', url, ...options },
      });
    },
    extract: async (urls: string | string[], schema: any, prompt?: string) => {
      return makeRequest('/api/firecrawl', {
        body: { action: 'extract', urls, schema, prompt },
      });
    },
    search: async (query: string, options?: any) => {
      return makeRequest('/api/firecrawl', {
        body: { action: 'search', query, ...options },
      });
    },
  };

  // Gemini API methods
  const gemini = {
    generate: async (prompt: string, options?: any) => {
      return makeRequest('/api/gemini', {
        body: { prompt, ...options },
      });
    },
    stream: async (prompt: string, options?: any) => {
      if (!csrfToken) {
        await fetchCSRFToken();
      }

      const params = new URLSearchParams({
        prompt,
        ...(options || {}),
      });

      const response = await fetch(`/api/gemini?${params}`, {
        headers: {
          'x-csrf-token': csrfToken || '',
        },
        credentials: 'include',
      });

      return response.body;
    },
  };

  // File upload method
  const uploadFile = async (file: File, options?: { bucket?: string; path?: string }) => {
    if (!csrfToken) {
      await fetchCSRFToken();
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (options?.bucket) formData.append('bucket', options.bucket);
      if (options?.path) formData.append('path', options.path);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken || '',
        },
        body: formData,
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          error: data.error || 'Upload failed',
          status: response.status,
        };
      }

      return {
        data: data.data || data,
        status: response.status,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Upload error',
        status: 0,
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    firecrawl,
    gemini,
    uploadFile,
    makeRequest,
    csrfToken,
  };
}