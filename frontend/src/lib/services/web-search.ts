// Advanced Web Search Service - No Firecrawl API Required
// Implements multiple search strategies for Eva's brain

import { EventEmitter } from 'events';

// Search result interface
export interface SearchResult {
  title: string;
  url: string;
  content: string;
  snippet?: string;
  source?: string;
  timestamp?: string;
}

// Search options
export interface SearchOptions {
  limit?: number;
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
  region?: string;
  safeSearch?: boolean;
  type?: 'web' | 'news' | 'images' | 'videos';
}

// Financial data interface
export interface FinancialData {
  symbol: string;
  price?: number;
  currency?: string;
  change?: number;
  changePercent?: number;
  marketCap?: number;
  volume?: number;
  high?: number;
  low?: number;
  timestamp: string;
  source: string;
}

// Web search event emitter
export const webSearchEvents = new EventEmitter();

// CORS proxy for client-side requests
const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://cors-anywhere.herokuapp.com/',
];

// Search engines configuration
const SEARCH_ENGINES = {
  duckduckgo: {
    url: 'https://html.duckduckgo.com/html/',
    method: 'POST',
    params: (query: string) => new URLSearchParams({ q: query }).toString(),
  },
  searx: {
    url: 'https://searx.be/search',
    method: 'GET',
    params: (query: string) => new URLSearchParams({ 
      q: query, 
      format: 'json',
      engines: 'google,bing,duckduckgo',
    }).toString(),
  },
  brave: {
    url: 'https://search.brave.com/api/search',
    method: 'GET',
    requiresKey: true,
    params: (query: string, options?: SearchOptions) => new URLSearchParams({
      q: query,
      count: String(options?.limit || 10),
    }).toString(),
  },
};

// Financial data sources
const FINANCIAL_SOURCES = {
  coinGecko: {
    url: 'https://api.coingecko.com/api/v3',
    endpoints: {
      price: '/simple/price',
      search: '/search',
      trending: '/search/trending',
    },
  },
  yahooFinance: {
    url: 'https://query1.finance.yahoo.com/v8/finance',
    endpoints: {
      quote: '/quote',
      search: '/search',
    },
  },
};

export class WebSearchService {
  private events: EventEmitter;
  private braveApiKey?: string;
  
  constructor() {
    this.events = webSearchEvents;
    this.braveApiKey = process.env.NEXT_PUBLIC_BRAVE_API_KEY;
  }

  // Main search method - tries multiple strategies
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    this.events.emit('search:start', { query, options });
    
    // Try multiple search strategies in parallel
    const strategies = [
      this.searchWithDuckDuckGo(query, options),
      this.searchWithSearx(query, options),
      this.braveApiKey ? this.searchWithBrave(query, options) : Promise.resolve([]),
      this.searchWithWebScraping(query, options),
    ];
    
    try {
      // Race all strategies and return first successful result
      const results = await Promise.race(
        strategies.map(p => p.catch(() => []))
      );
      
      // If no results from race, try to get any successful result
      if (!results || results.length === 0) {
        const allResults = await Promise.allSettled(strategies);
        for (const result of allResults) {
          if (result.status === 'fulfilled' && result.value.length > 0) {
            this.events.emit('search:complete', { query, results: result.value });
            return result.value;
          }
        }
      }
      
      this.events.emit('search:complete', { query, results });
      return results || [];
    } catch (error) {
      this.events.emit('search:error', { query, error });
      return this.getFallbackResults(query);
    }
  }

  // Search for financial data
  async searchFinancial(query: string): Promise<SearchResult[]> {
    const symbols = this.extractFinancialSymbols(query);
    if (symbols.length === 0) {
      return this.search(query + ' finance stock price');
    }
    
    const results: SearchResult[] = [];
    
    for (const symbol of symbols) {
      try {
        const data = await this.fetchFinancialData(symbol);
        results.push(this.formatFinancialResult(data));
      } catch (error) {
        console.error(`Failed to fetch data for ${symbol}:`, error);
      }
    }
    
    // Add general search results
    const generalResults = await this.search(query + ' latest news');
    results.push(...generalResults.slice(0, 3));
    
    return results;
  }

  // DuckDuckGo search implementation
  private async searchWithDuckDuckGo(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    try {
      const formData = new FormData();
      formData.append('q', query);
      
      const response = await fetch(SEARCH_ENGINES.duckduckgo.url, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('DuckDuckGo search failed');
      
      const html = await response.text();
      return this.parseDuckDuckGoResults(html, options?.limit || 10);
    } catch (error) {
      console.error('DuckDuckGo search error:', error);
      throw error;
    }
  }

  // Searx search implementation
  private async searchWithSearx(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    try {
      const url = `${SEARCH_ENGINES.searx.url}?${SEARCH_ENGINES.searx.params(query)}`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error('Searx search failed');
      
      const data = await response.json();
      return this.formatSearxResults(data.results || [], options?.limit || 10);
    } catch (error) {
      console.error('Searx search error:', error);
      throw error;
    }
  }

  // Brave search implementation
  private async searchWithBrave(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    if (!this.braveApiKey) {
      throw new Error('Brave API key not configured');
    }
    
    try {
      const url = `${SEARCH_ENGINES.brave.url}?${SEARCH_ENGINES.brave.params(query, options)}`;
      const response = await fetch(url, {
        headers: {
          'X-Subscription-Token': this.braveApiKey,
        },
      });
      
      if (!response.ok) throw new Error('Brave search failed');
      
      const data = await response.json();
      return this.formatBraveResults(data.web?.results || [], options?.limit || 10);
    } catch (error) {
      console.error('Brave search error:', error);
      throw error;
    }
  }

  // Web scraping fallback
  private async searchWithWebScraping(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    // Use a CORS proxy to fetch Google search results
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    
    for (const proxy of CORS_PROXIES) {
      try {
        const response = await fetch(proxy + encodeURIComponent(searchUrl));
        if (response.ok) {
          const html = await response.text();
          return this.parseGoogleResults(html, options?.limit || 10);
        }
      } catch (error) {
        continue;
      }
    }
    
    throw new Error('All web scraping attempts failed');
  }

  // Fetch financial data
  private async fetchFinancialData(symbol: string): Promise<FinancialData> {
    // Try CoinGecko for crypto
    try {
      const cryptoId = this.getCryptoId(symbol);
      if (cryptoId) {
        const response = await fetch(
          `${FINANCIAL_SOURCES.coinGecko.url}${FINANCIAL_SOURCES.coinGecko.endpoints.price}?ids=${cryptoId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
        );
        
        if (response.ok) {
          const data = await response.json();
          const coinData = data[cryptoId];
          
          return {
            symbol: symbol.toUpperCase(),
            price: coinData.usd,
            currency: 'USD',
            change: coinData.usd_24h_change,
            changePercent: coinData.usd_24h_change,
            marketCap: coinData.usd_market_cap,
            volume: coinData.usd_24h_vol,
            timestamp: new Date().toISOString(),
            source: 'CoinGecko',
          };
        }
      }
    } catch (error) {
      console.error('CoinGecko API error:', error);
    }
    
    // Fallback to mock data with helpful information
    return {
      symbol: symbol.toUpperCase(),
      timestamp: new Date().toISOString(),
      source: 'Real-time data unavailable',
    };
  }

  // Parse DuckDuckGo HTML results
  private parseDuckDuckGoResults(html: string, limit: number): SearchResult[] {
    const results: SearchResult[] = [];
    
    // Simple regex parsing for DuckDuckGo results
    const resultRegex = /<a class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([^<]+)<\/a>/g;
    let match;
    
    while ((match = resultRegex.exec(html)) !== null && results.length < limit) {
      results.push({
        url: match[1],
        title: match[2].trim(),
        content: match[3].trim(),
        source: 'DuckDuckGo',
      });
    }
    
    return results;
  }

  // Parse Google HTML results
  private parseGoogleResults(html: string, limit: number): SearchResult[] {
    const results: SearchResult[] = [];
    
    // Extract search results from Google HTML
    const resultRegex = /<h3[^>]*>([^<]+)<\/h3>[\s\S]*?<a[^>]*href="([^"]+)"[\s\S]*?<span[^>]*>([^<]+)<\/span>/g;
    let match;
    
    while ((match = resultRegex.exec(html)) !== null && results.length < limit) {
      results.push({
        title: match[1].trim(),
        url: match[2],
        content: match[3].trim(),
        source: 'Google',
      });
    }
    
    return results;
  }

  // Format Searx results
  private formatSearxResults(results: any[], limit: number): SearchResult[] {
    return results.slice(0, limit).map(result => ({
      title: result.title || 'No title',
      url: result.url || '',
      content: result.content || result.description || 'No description available',
      source: result.engine || 'Searx',
    }));
  }

  // Format Brave results
  private formatBraveResults(results: any[], limit: number): SearchResult[] {
    return results.slice(0, limit).map(result => ({
      title: result.title || 'No title',
      url: result.url || '',
      content: result.description || 'No description available',
      snippet: result.snippet,
      source: 'Brave',
    }));
  }

  // Format financial result
  private formatFinancialResult(data: FinancialData): SearchResult {
    let content = `${data.symbol} Financial Data\n`;
    
    if (data.price) {
      content += `Current Price: $${data.price.toFixed(2)} ${data.currency || 'USD'}\n`;
    }
    
    if (data.change !== undefined) {
      const changeStr = data.change > 0 ? `+${data.change.toFixed(2)}` : data.change.toFixed(2);
      content += `24h Change: ${changeStr} (${data.changePercent?.toFixed(2)}%)\n`;
    }
    
    if (data.marketCap) {
      content += `Market Cap: $${(data.marketCap / 1e9).toFixed(2)}B\n`;
    }
    
    if (data.volume) {
      content += `24h Volume: $${(data.volume / 1e6).toFixed(2)}M\n`;
    }
    
    content += `\nSource: ${data.source}\nUpdated: ${new Date(data.timestamp).toLocaleString()}`;
    
    return {
      title: `${data.symbol} Price Information`,
      url: this.getFinancialUrl(data.symbol),
      content,
      source: data.source,
      timestamp: data.timestamp,
    };
  }

  // Extract financial symbols from query
  private extractFinancialSymbols(query: string): string[] {
    const symbols: string[] = [];
    const queryLower = query.toLowerCase();
    
    // Common crypto symbols
    const cryptoMap: Record<string, string> = {
      'bitcoin': 'BTC',
      'btc': 'BTC',
      'ethereum': 'ETH',
      'eth': 'ETH',
      'xrp': 'XRP',
      'ripple': 'XRP',
      'cardano': 'ADA',
      'ada': 'ADA',
      'solana': 'SOL',
      'sol': 'SOL',
      'dogecoin': 'DOGE',
      'doge': 'DOGE',
      'polkadot': 'DOT',
      'dot': 'DOT',
      'chainlink': 'LINK',
      'link': 'LINK',
    };
    
    // Check for crypto mentions
    for (const [key, symbol] of Object.entries(cryptoMap)) {
      if (queryLower.includes(key)) {
        symbols.push(symbol);
      }
    }
    
    // Extract stock tickers (uppercase letters 1-5 chars)
    const tickerRegex = /\b[A-Z]{1,5}\b/g;
    const matches = query.match(tickerRegex);
    if (matches) {
      symbols.push(...matches);
    }
    
    return [...new Set(symbols)];
  }

  // Get crypto ID for CoinGecko
  private getCryptoId(symbol: string): string | null {
    const cryptoIds: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'XRP': 'ripple',
      'ADA': 'cardano',
      'SOL': 'solana',
      'DOGE': 'dogecoin',
      'DOT': 'polkadot',
      'LINK': 'chainlink',
      'MATIC': 'matic-network',
      'AVAX': 'avalanche-2',
      'ATOM': 'cosmos',
      'UNI': 'uniswap',
    };
    
    return cryptoIds[symbol.toUpperCase()] || null;
  }

  // Get financial URL
  private getFinancialUrl(symbol: string): string {
    const cryptoId = this.getCryptoId(symbol);
    if (cryptoId) {
      return `https://www.coingecko.com/en/coins/${cryptoId}`;
    }
    return `https://finance.yahoo.com/quote/${symbol}`;
  }

  // Fallback results
  private getFallbackResults(query: string): SearchResult[] {
    return [
      {
        title: 'Search Currently Limited',
        url: '',
        content: `I'm having difficulty searching for "${query}" right now. You can try:\n\n` +
                 `1. Visiting Google directly: https://www.google.com/search?q=${encodeURIComponent(query)}\n` +
                 `2. Using DuckDuckGo: https://duckduckgo.com/?q=${encodeURIComponent(query)}\n` +
                 `3. Checking specific sites directly\n\n` +
                 `I can still help with other tasks like creating todos, managing emails, or analyzing documents!`,
        source: 'Eva Assistant',
      },
    ];
  }

  // News search
  async searchNews(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const newsQuery = `${query} news ${new Date().getFullYear()}`;
    const results = await this.search(newsQuery, { ...options, type: 'news' });
    
    // Add timestamps to news results
    return results.map(result => ({
      ...result,
      timestamp: result.timestamp || new Date().toISOString(),
    }));
  }

  // Real-time monitoring setup
  async setupMonitoring(topic: string, callback: (results: SearchResult[]) => void): Promise<string> {
    const monitorId = `monitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Set up periodic searching
    const interval = setInterval(async () => {
      try {
        const results = await this.searchNews(topic, { limit: 5 });
        if (results.length > 0) {
          callback(results);
          this.events.emit('monitor:update', { monitorId, topic, results });
        }
      } catch (error) {
        console.error('Monitoring error:', error);
      }
    }, 3600000); // Check every hour
    
    // Store interval for cleanup
    this.events.emit('monitor:created', { monitorId, topic, interval });
    
    return monitorId;
  }

  // Stop monitoring
  stopMonitoring(monitorId: string) {
    this.events.emit('monitor:stop', { monitorId });
  }
}

// Export singleton instance
export const webSearch = new WebSearchService();

// Helper function for quick searches
export async function quickSearch(query: string): Promise<SearchResult[]> {
  return webSearch.search(query, { limit: 5 });
}

// Helper function for financial searches
export async function searchFinancialData(query: string): Promise<SearchResult[]> {
  return webSearch.searchFinancial(query);
}