'use client';

import { useState } from 'react';
import { useFirecrawl } from '@/hooks/useFirecrawl';
import { Loader2, Search, Globe, FileText, AlertCircle, CheckCircle } from 'lucide-react';

export default function FirecrawlTest() {
  const { scrapeUrl, crawlWebsite, mapWebsite, search, extract, isLoading, error, activeJobs } = useFirecrawl();
  const [url, setUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [selectedAction, setSelectedAction] = useState<'scrape' | 'crawl' | 'map' | 'search' | 'extract'>('scrape');

  const handleAction = async () => {
    setResults(null);
    
    try {
      switch (selectedAction) {
        case 'scrape':
          const scraped = await scrapeUrl(url);
          setResults(scraped);
          break;
        case 'crawl':
          const jobId = await crawlWebsite(url, { limit: 10 });
          setResults({ jobId, message: 'Crawl started. Check active jobs for progress.' });
          break;
        case 'map':
          const urls = await mapWebsite(url);
          setResults({ urls, count: urls.length });
          break;
        case 'search':
          const searchResults = await search(searchQuery || url);
          setResults(searchResults);
          break;
        case 'extract':
          const extracted = await extract([url], {
            schema: {
              name: 'string',
              title: 'string',
              description: 'string'
            }
          });
          setResults(extracted);
          break;
      }
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Firecrawl Testing</h2>
        
        {/* Action Selection */}
        <div className="flex gap-2 mb-4">
          {(['scrape', 'crawl', 'map', 'search', 'extract'] as const).map((action) => (
            <button
              key={action}
              onClick={() => setSelectedAction(action)}
              className={`px-4 py-2 rounded-lg capitalize ${
                selectedAction === action
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {action}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="space-y-4">
          {selectedAction === 'search' ? (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter search query..."
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            />
          ) : (
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter URL to process..."
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            />
          )}

          <button
            onClick={handleAction}
            disabled={isLoading || (!url && selectedAction !== 'search') || (selectedAction === 'search' && !searchQuery)}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {selectedAction === 'search' ? <Search className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                {selectedAction.charAt(0).toUpperCase() + selectedAction.slice(1)}
              </>
            )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-800 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Active Jobs */}
        {activeJobs.length > 0 && (
          <div className="mt-4">
            <h3 className="text-lg font-medium text-white mb-2">Active Jobs</h3>
            <div className="space-y-2">
              {activeJobs.map((job) => (
                <div key={job.id} className="p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-300">{job.type} - {job.url}</p>
                      <p className="text-xs text-gray-500">Status: {job.status}</p>
                      {job.progress !== undefined && (
                        <div className="mt-1 w-full bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    {job.status === 'completed' && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results Display */}
        {results && (
          <div className="mt-4">
            <h3 className="text-lg font-medium text-white mb-2">Results</h3>
            <div className="p-4 bg-gray-800 rounded-lg">
              <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}