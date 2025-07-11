import React, { useState } from 'react';
import { 
  Globe, Search, FileText, TrendingUp, Briefcase, Users, 
  Loader2, AlertCircle, CheckCircle, Link, Map, Brain
} from 'lucide-react';
import { useFirecrawl } from '@/lib/firecrawl/hooks';

export default function FirecrawlTools() {
  const [activeTab, setActiveTab] = useState('scrape');
  const [url, setUrl] = useState('');
  const [query, setQuery] = useState('');
  const [postContent, setPostContent] = useState('');
  const [platform, setPlatform] = useState<'twitter' | 'linkedin'>('linkedin');
  
  const { 
    loading, 
    progress, 
    results, 
    error, 
    scrapeUrl, 
    crawlWebsite, 
    mapWebsite, 
    search, 
    agents 
  } = useFirecrawl();

  const tabs = [
    { id: 'scrape', label: 'Scrape URL', icon: FileText },
    { id: 'search', label: 'Search Web', icon: Search },
    { id: 'intel', label: 'Company Intel', icon: Briefcase },
    { id: 'post', label: 'Post Predictor', icon: TrendingUp },
    { id: 'competitors', label: 'Competitor Analysis', icon: Users },
  ];

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
      <h2 className="text-lg sm:text-xl font-semibold mb-4 flex items-center">
        <Globe className="w-5 h-5 mr-2 text-purple-500" />
        Firecrawl Intelligence Tools
      </h2>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab: typeof tabs[0]) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="text-sm">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="space-y-4">
        {activeTab === 'scrape' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                URL to Scrape
              </label>
              <input
                type="url"
                value={url}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              onClick={() => scrapeUrl(url, { formats: ['markdown', 'links'] })}
              disabled={loading || !url}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5 mr-2" />
                  Scrape Page
                </>
              )}
            </button>
          </div>
        )}

        {activeTab === 'search' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search Query
              </label>
              <input
                type="text"
                value={query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                placeholder="Financial advisor industry trends 2024"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              onClick={() => search(query, { limit: 10 })}
              disabled={loading || !query}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
                  Search Web
                </>
              )}
            </button>
          </div>
        )}

        {activeTab === 'intel' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Company Domain
              </label>
              <input
                type="url"
                value={url}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                placeholder="https://company.com"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              onClick={() => agents.gatherCompanyIntel(url, { 
                targetRoles: ['Financial Advisor', 'Wealth Manager'],
                industry: 'Financial Services'
              })}
              disabled={loading || !url}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Gathering Intel...
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5 mr-2" />
                  Gather Company Intel
                </>
              )}
            </button>
          </div>
        )}

        {activeTab === 'post' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Platform
              </label>
              <select
                value={platform}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPlatform(e.target.value as 'twitter' | 'linkedin')}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="linkedin">LinkedIn</option>
                <option value="twitter">Twitter/X</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Post Content
              </label>
              <textarea
                value={postContent}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPostContent(e.target.value)}
                placeholder="Write your post content here..."
                rows={4}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              onClick={() => agents.predictPostPerformance(postContent, platform)}
              disabled={loading || !postContent}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Predict Performance
                </>
              )}
            </button>
          </div>
        )}

        {/* Progress Bar */}
        {loading && progress.total > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-400 mb-1">
              <span>Progress</span>
              <span>{progress.current} / {progress.total}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-purple-500 to-pink-600 h-2 rounded-full transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 bg-red-900/20 border border-red-800 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Results Display */}
        {results.length > 0 && (
          <div className="mt-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Results</h3>
            <div className="max-h-96 overflow-y-auto space-y-3">
              {results.map((result, index) => (
                <div key={index} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  {/* Post Prediction Results */}
                  {result.viralityScore !== undefined && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-500">
                            {result.viralityScore}
                          </div>
                          <div className="text-xs text-gray-400">Virality Score</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-pink-500">
                            {result.trendingPotential}
                          </div>
                          <div className="text-xs text-gray-400">Trending Potential</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-500">
                            {result.contentQuality}
                          </div>
                          <div className="text-xs text-gray-400">Content Quality</div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Company Intel Results */}
                  {result.company && (
                    <div className="space-y-3">
                      {result.company.companyName && (
                        <h4 className="font-semibold text-white">{result.company.companyName}</h4>
                      )}
                      {result.advisors && result.advisors.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-400 mb-2">
                            Found {result.advisors.length} advisors
                          </p>
                        </div>
                      )}
                      {result.openings && result.openings.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-400">
                            {result.openings.length} job openings available
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* General Result Display */}
                  {result.url && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Link className="w-4 h-4 text-gray-400" />
                      <a 
                        href={result.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 truncate"
                      >
                        {result.title || result.url}
                      </a>
                    </div>
                  )}
                  
                  {result.markdown && (
                    <div className="mt-2 text-sm text-gray-300 line-clamp-3">
                      {result.markdown.substring(0, 200)}...
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}