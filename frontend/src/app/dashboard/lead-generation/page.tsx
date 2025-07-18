'use client';

import React, { useState, useEffect } from 'react';
import { EnhancedLeadGenerationAgent } from '@/lib/agents/enhanced-lead-generation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  Users, 
  TrendingUp, 
  Mail, 
  Globe,
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/app/providers';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function LeadGenerationPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [apiKeyStatus, setApiKeyStatus] = useState<'loading' | 'valid' | 'invalid' | 'missing'>('loading');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [totalResults, setTotalResults] = useState(0);

  // Check API keys on mount
  useEffect(() => {
    const checkApiKeys = () => {
      const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      const firecrawlKey = process.env.NEXT_PUBLIC_FIRECRAWL_API_KEY;
      
      if (!geminiKey || !firecrawlKey) {
        setApiKeyStatus('missing');
        toast.error('API keys are not configured. Please add them to your environment variables.');
      } else if (geminiKey === 'your-gemini-api-key' || firecrawlKey === 'your-firecrawl-api-key') {
        setApiKeyStatus('invalid');
        toast.warning('Please replace the placeholder API keys with your actual keys.');
      } else {
        setApiKeyStatus('valid');
      }
    };

    checkApiKeys();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user?.id) return;

    setIsSearching(true);
    setProgress(0);
    setLeads([]);

    try {
      // Double-check API keys before creating agent
      const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      const firecrawlKey = process.env.NEXT_PUBLIC_FIRECRAWL_API_KEY;
      
      if (!geminiKey || !firecrawlKey || geminiKey === 'your-gemini-api-key' || firecrawlKey === 'your-firecrawl-api-key') {
        toast.error('Please configure valid API keys in settings.');
        router.push('/dashboard/settings?tab=api-keys');
        return;
      }

      const agent = new EnhancedLeadGenerationAgent(
        geminiKey,
        firecrawlKey,
        { userId: user.id }
      );

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 1000);

      const results = await agent.searchLeads(searchQuery, {
        maxResults: 10,
        includeLinkedIn: true,
        includeCompanyInfo: true
      });

      clearInterval(progressInterval);
      setProgress(100);
      setLeads(results);
      setTotalResults(results.length);
      setCurrentPage(1); // Reset to first page
      toast.success(`Found ${results.length} potential leads`);
    } catch (error) {
      console.error('Lead search error:', error);
      // Show more detailed error message
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          toast.error('Invalid API key. Please check your Firecrawl API configuration.');
        } else if (error.message.includes('Network')) {
          toast.error('Network error. Please check your internet connection.');
        } else {
          toast.error(`Lead search failed: ${error.message}`);
        }
      } else {
        toast.error('Failed to search for leads');
      }
    } finally {
      setIsSearching(false);
      setProgress(0);
    }
  };

  // Calculate pagination
  const totalPages = Math.ceil(totalResults / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLeads = leads.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of results
    const resultsCard = document.getElementById('lead-results');
    if (resultsCard) {
      resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Enhanced Lead Generation</h1>
            <p className="text-gray-400 mt-2">AI-powered lead discovery and qualification</p>
          </div>
          <Badge variant="secondary" className="bg-green-500/20 text-green-400">
            <CheckCircle className="w-4 h-4 mr-1" />
            Active
          </Badge>
        </div>

        {apiKeyStatus === 'missing' || apiKeyStatus === 'invalid' ? (
          <Alert className="bg-yellow-500/10 border-yellow-500/20">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-200">
              <div className="flex items-center justify-between">
                <span>
                  {apiKeyStatus === 'missing' 
                    ? 'Lead Generation requires Gemini and Firecrawl API keys to be configured.'
                    : 'Please replace the placeholder API keys with your actual keys.'}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push('/dashboard/settings?tab=api-keys')}
                  className="ml-4"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Configure API Keys
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        <Card className="bg-white/5 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle>Search for Leads</CardTitle>
            <CardDescription>Enter criteria to find potential financial advisor candidates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="search">Search Query</Label>
                  <Input
                    id="search"
                    placeholder="e.g., Financial advisors in New York"
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSearch()}
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <Button 
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim() || apiKeyStatus !== 'valid'}
                  className="sm:mt-auto w-full sm:w-auto"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Search
                    </>
                  )}
                </Button>
              </div>

              {isSearching && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Searching for leads...</span>
                    <span className="text-gray-400">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {leads.length > 0 && (
          <Card id="lead-results" className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Found Leads ({totalResults})</CardTitle>
                <div className="text-sm text-gray-400">
                  Showing {startIndex + 1}-{Math.min(endIndex, totalResults)} of {totalResults} results
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentLeads.map((lead, index) => (
                  <Card key={startIndex + index} className="bg-white/5 border-white/10">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="space-y-2 flex-1">
                          <h3 className="text-lg font-semibold text-white">{lead.name}</h3>
                          <p className="text-gray-400 text-sm sm:text-base">{lead.title} at {lead.company?.name || lead.company}</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary" className="text-xs">{lead.location}</Badge>
                            <Badge variant="secondary" className="text-xs">{lead.experience}</Badge>
                            {lead.score && (
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${lead.score > 7 ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}
                              >
                                Score: {lead.score}/10
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          {lead.linkedInUrl && (
                            <Button size="sm" variant="ghost" asChild className="flex-1 sm:flex-initial">
                              <a href={lead.linkedInUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </Button>
                          )}
                          <Button size="sm" className="flex-1 sm:flex-initial">
                            <Mail className="w-4 h-4 mr-1" />
                            Contact
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="bg-white/5 border-white/10 w-full sm:w-auto"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>
                  
                  <div className="flex gap-1 overflow-x-auto">
                    {/* Show page numbers */}
                    {[...Array(totalPages)].map((_, i) => {
                      const pageNumber = i + 1;
                      // Show first page, last page, current page, and pages around current
                      if (
                        pageNumber === 1 ||
                        pageNumber === totalPages ||
                        (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                      ) {
                        return (
                          <Button
                            key={pageNumber}
                            variant={currentPage === pageNumber ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageNumber)}
                            className={`min-w-[40px] ${currentPage === pageNumber ? "" : "bg-white/5 border-white/10"}`}
                          >
                            {pageNumber}
                          </Button>
                        );
                      } else if (
                        pageNumber === currentPage - 2 ||
                        pageNumber === currentPage + 2
                      ) {
                        return (
                          <span key={pageNumber} className="px-2 text-gray-400">
                            ...
                          </span>
                        );
                      }
                      return null;
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="bg-white/5 border-white/10 w-full sm:w-auto"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Web Scraper
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400">Searches LinkedIn, company websites, and professional directories</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                AI Scoring
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400">Automatically scores and ranks leads based on fit criteria</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                CRM Sync
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400">Seamlessly syncs qualified leads to Zoho CRM</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}