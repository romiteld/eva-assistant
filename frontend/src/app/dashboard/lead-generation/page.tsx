'use client';

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { EnhancedLeadGenerationAgent } from '@/lib/agents/enhanced-lead-generation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Users, 
  TrendingUp, 
  Mail, 
  Globe,
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '@/app/providers';
import { toast } from 'sonner';

export default function LeadGenerationPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user?.id) return;

    setIsSearching(true);
    setProgress(0);
    setLeads([]);

    try {
      const agent = new EnhancedLeadGenerationAgent(
        process.env.NEXT_PUBLIC_GEMINI_API_KEY!,
        process.env.NEXT_PUBLIC_FIRECRAWL_API_KEY!,
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

  return (
    <DashboardLayout>
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

        <Card className="bg-white/5 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle>Search for Leads</CardTitle>
            <CardDescription>Enter criteria to find potential financial advisor candidates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="search">Search Query</Label>
                  <Input
                    id="search"
                    placeholder="e.g., Financial advisors in New York with 10+ years experience"
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSearch()}
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <Button 
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="mt-auto"
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
          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardHeader>
              <CardTitle>Found Leads ({leads.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {leads.map((lead, index) => (
                    <Card key={index} className="bg-white/5 border-white/10">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-white">{lead.name}</h3>
                            <p className="text-gray-400">{lead.title} at {lead.company}</p>
                            <div className="flex gap-2">
                              <Badge variant="secondary">{lead.location}</Badge>
                              <Badge variant="secondary">{lead.experience}</Badge>
                              {lead.score && (
                                <Badge 
                                  variant="secondary" 
                                  className={lead.score > 7 ? 'bg-green-500/20' : 'bg-yellow-500/20'}
                                >
                                  Score: {lead.score}/10
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {lead.linkedInUrl && (
                              <Button size="sm" variant="ghost" asChild>
                                <a href={lead.linkedInUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </Button>
                            )}
                            <Button size="sm">
                              <Mail className="w-4 h-4 mr-1" />
                              Contact
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
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
    </DashboardLayout>
  );
}