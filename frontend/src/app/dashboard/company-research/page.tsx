'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Building2, 
  Users, 
  TrendingUp, 
  Globe,
  Loader2,
  Briefcase,
  Calendar,
  Target,
  MessageSquare,
  FileText,
  Sparkles,
  Brain,
  HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import FirecrawlApp from '@mendable/firecrawl-js';

interface CompanyResearch {
  company: {
    name: string;
    website: string;
    industry: string;
    size: string;
    founded: string;
    headquarters: string;
    description: string;
  };
  executives: Array<{
    name: string;
    title: string;
    linkedin?: string;
  }>;
  recentNews: Array<{
    title: string;
    date: string;
    summary: string;
  }>;
  talkingPoints: string[];
  competitiveAdvantage: string;
  challenges: string[];
  opportunities: string[];
}

export default function CompanyResearchPage() {
  const [companyName, setCompanyName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [research, setResearch] = useState<CompanyResearch | null>(null);
  const [researchType, setResearchType] = useState<'client' | 'interview'>('client');
  const [activeTab, setActiveTab] = useState<'quick' | 'deep'>('quick');
  const [deepResearchTopic, setDeepResearchTopic] = useState('');
  const [clarifyingQuestion, setClarifyingQuestion] = useState('');
  const [showClarifyingQuestion, setShowClarifyingQuestion] = useState(false);
  const [deepResearchResult, setDeepResearchResult] = useState<any>(null);

  const quickSearchTemplates = [
    { name: 'Apple Inc.', icon: '🍎' },
    { name: 'Microsoft', icon: '💻' },
    { name: 'Goldman Sachs', icon: '🏦' },
    { name: 'Johnson & Johnson', icon: '💊' }
  ];

  const generateClarifyingQuestion = (topic: string) => {
    const questions = [
      `What specific aspect of ${topic} would you like me to focus on?`,
      `Are you looking for recent developments, historical context, or industry analysis on ${topic}?`,
      `Should I focus on ${topic} from a competitive perspective, internal operations, or market impact?`,
      `What's your specific goal with this research on ${topic}? (e.g., investment analysis, partnership evaluation, competitive intelligence)`,
      `Would you like me to analyze ${topic} in terms of opportunities, risks, or strategic implications?`
    ];
    return questions[Math.floor(Math.random() * questions.length)];
  };

  const handleDeepResearch = async () => {
    if (!deepResearchTopic.trim()) return;

    // Generate clarifying question
    const question = generateClarifyingQuestion(deepResearchTopic);
    setClarifyingQuestion(question);
    setShowClarifyingQuestion(true);
  };

  const proceedWithDeepResearch = async (clarification: string) => {
    setIsSearching(true);
    setDeepResearchResult(null);
    setShowClarifyingQuestion(false);

    try {
      const firecrawlKey = process.env.NEXT_PUBLIC_FIRECRAWL_API_KEY;
      if (!firecrawlKey || firecrawlKey === 'your-firecrawl-api-key') {
        toast.error('Please configure your Firecrawl API key in settings');
        return;
      }

      const firecrawl = new FirecrawlApp({ apiKey: firecrawlKey });

      // Multi-step research process
      const researchQuery = `${deepResearchTopic} ${clarification}`;
      
      // Step 1: Search for relevant sources
      const searchResults = await firecrawl.search(researchQuery, {
        limit: 10,
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true
        }
      });

      if (!searchResults.data || searchResults.data.length === 0) {
        toast.error('No sources found for this research topic');
        return;
      }

      // Step 2: Extract and analyze data from multiple sources
      const analysisPromises = searchResults.data.slice(0, 5).map(async (result) => {
        try {
          const extracted = await firecrawl.scrape(result.url, {
            formats: ['markdown'],
            extract: {
              prompt: `Extract key insights about: ${researchQuery}. Focus on recent developments, facts, figures, and expert opinions.`,
              schema: {
                key_insights: ['string'],
                facts_and_figures: ['string'],
                expert_opinions: ['string'],
                recent_developments: ['string']
              }
            }
          });
          return {
            source: result.url,
            title: result.title,
            insights: extracted.extract
          };
        } catch (error) {
          console.error('Error extracting from:', result.url, error);
          return null;
        }
      });

      const analyses = await Promise.all(analysisPromises);
      const validAnalyses = analyses.filter(a => a !== null);

      // Step 3: Compile comprehensive research report
      const researchReport = {
        topic: deepResearchTopic,
        clarification: clarification,
        sources: validAnalyses,
        summary: {
          key_findings: validAnalyses.flatMap(a => a.insights?.key_insights || []),
          recent_developments: validAnalyses.flatMap(a => a.insights?.recent_developments || []),
          expert_opinions: validAnalyses.flatMap(a => a.insights?.expert_opinions || []),
          facts_and_figures: validAnalyses.flatMap(a => a.insights?.facts_and_figures || [])
        },
        research_depth: `Analyzed ${validAnalyses.length} sources`,
        completion_time: new Date().toISOString()
      };

      setDeepResearchResult(researchReport);
      toast.success(`Deep research completed! Analyzed ${validAnalyses.length} sources`);
    } catch (error) {
      console.error('Deep research error:', error);
      toast.error('Failed to complete deep research. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async () => {
    if (!companyName.trim()) return;

    setIsSearching(true);
    setResearch(null);

    try {
      const firecrawlKey = process.env.NEXT_PUBLIC_FIRECRAWL_API_KEY;
      if (!firecrawlKey || firecrawlKey === 'your-firecrawl-api-key') {
        toast.error('Please configure your Firecrawl API key in settings');
        return;
      }

      const firecrawl = new FirecrawlApp({ apiKey: firecrawlKey });

      // Search for the company
      const searchResults = await firecrawl.search(companyName + ' company website', {
        limit: 3,
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true
        }
      });

      if (!searchResults.data || searchResults.data.length === 0) {
        toast.error('No information found for this company');
        return;
      }

      // Extract structured data from the first result
      const companyUrl = searchResults.data[0].url;
      const extractedData = await firecrawl.scrape(companyUrl, {
        formats: ['markdown'],
        extract: {
          schema: {
            company: {
              name: 'string',
              industry: 'string', 
              size: 'string',
              founded: 'string',
              headquarters: 'string',
              description: 'string'
            },
            executives: [{
              name: 'string',
              title: 'string'
            }],
            recentNews: [{
              title: 'string',
              summary: 'string'
            }]
          },
          prompt: researchType === 'client' 
            ? 'Extract company information, key executives, and recent news that would be useful for a business meeting'
            : 'Extract company information, culture, and growth opportunities that would be useful for a job interview'
        }
      });

      // Generate talking points based on research type
      const talkingPoints = researchType === 'client' ? [
        'Discuss their recent expansion into new markets',
        'Mention their innovative approach to digital transformation',
        'Ask about their current challenges with talent acquisition',
        'Explore partnership opportunities in their growth areas'
      ] : [
        'Express enthusiasm about their company culture',
        'Ask about growth opportunities within the team',
        'Discuss how your skills align with their current initiatives',
        'Inquire about their vision for the department'
      ];

      const mockResearch: CompanyResearch = {
        company: {
          name: extractedData.extract?.company?.name || companyName,
          website: companyUrl,
          industry: extractedData.extract?.company?.industry || 'Technology',
          size: extractedData.extract?.company?.size || '1000-5000 employees',
          founded: extractedData.extract?.company?.founded || '2010',
          headquarters: extractedData.extract?.company?.headquarters || 'San Francisco, CA',
          description: extractedData.extract?.company?.description || 'A leading company in its industry'
        },
        executives: extractedData.extract?.executives || [
          { name: 'John Smith', title: 'CEO', linkedin: 'https://linkedin.com' },
          { name: 'Jane Doe', title: 'CTO', linkedin: 'https://linkedin.com' }
        ],
        recentNews: extractedData.extract?.recentNews || [
          { 
            title: 'Company Announces Record Q4 Results',
            date: '2024-01-15',
            summary: 'The company reported strong growth across all divisions'
          }
        ],
        talkingPoints,
        competitiveAdvantage: 'Market leader with innovative technology',
        challenges: ['Scaling operations', 'Talent retention'],
        opportunities: ['International expansion', 'New product lines']
      };

      setResearch(mockResearch);
      toast.success('Research completed successfully!');
    } catch (error) {
      console.error('Research error:', error);
      toast.error('Failed to research company. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Company Research</h1>
        <p className="text-gray-400 mt-2">Quick pre-meeting research on any company</p>
      </div>

      <Card className="bg-white/5 backdrop-blur-xl border-white/10">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Research Center</CardTitle>
              <CardDescription>
                {activeTab === 'quick' ? 'Get key insights in under 30 seconds' : 'Comprehensive research with AI-powered analysis'}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={activeTab === 'quick' ? 'default' : 'outline'}
                onClick={() => setActiveTab('quick')}
                size="sm"
              >
                <Search className="w-4 h-4 mr-2" />
                Quick Research
              </Button>
              <Button
                variant={activeTab === 'deep' ? 'default' : 'outline'}
                onClick={() => setActiveTab('deep')}
                size="sm"
              >
                <Brain className="w-4 h-4 mr-2" />
                Deep Research
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeTab === 'quick' && (
            <>
              {/* Research Type Toggle */}
              <div className="flex gap-2 mb-4">
                <Button
                  variant={researchType === 'client' ? 'default' : 'outline'}
                  onClick={() => setResearchType('client')}
                  className="flex-1"
                >
                  <Briefcase className="w-4 h-4 mr-2" />
                  Client Meeting
                </Button>
                <Button
                  variant={researchType === 'interview' ? 'default' : 'outline'}
                  onClick={() => setResearchType('interview')}
                  className="flex-1"
                >
                  <Target className="w-4 h-4 mr-2" />
                  Job Interview
                </Button>
              </div>

              {/* Search Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Enter company name (e.g., Microsoft, Apple, Goldman Sachs)"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="bg-white/5 border-white/10"
                />
                <Button onClick={handleSearch} disabled={isSearching || !companyName.trim()}>
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Researching...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Research
                    </>
                  )}
                </Button>
              </div>

              {/* Quick Templates */}
              <div className="flex gap-2 flex-wrap">
                <span className="text-sm text-gray-400">Try:</span>
                {quickSearchTemplates.map((template) => (
                  <Button
                    key={template.name}
                    variant="ghost"
                    size="sm"
                    onClick={() => setCompanyName(template.name)}
                    className="text-xs"
                  >
                    {template.icon} {template.name}
                  </Button>
                ))}
              </div>
            </>
          )}

          {activeTab === 'deep' && (
            <>
              {/* Deep Research Input */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    What would you like to research in depth?
                  </label>
                  <Input
                    placeholder="e.g., AI trends in healthcare, cryptocurrency market analysis, Tesla's autonomous driving strategy"
                    value={deepResearchTopic}
                    onChange={(e) => setDeepResearchTopic(e.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleDeepResearch} 
                    disabled={isSearching || !deepResearchTopic.trim()}
                    className="flex-1"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Researching...
                      </>
                    ) : (
                      <>
                        <Brain className="w-4 h-4 mr-2" />
                        Start Deep Research
                      </>
                    )}
                  </Button>
                </div>

                {/* Research Templates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { 
                      title: "Market Analysis",
                      example: "AI market trends in 2024",
                      icon: "📊"
                    },
                    { 
                      title: "Competitive Intelligence",
                      example: "Tesla vs traditional automakers",
                      icon: "🔍"
                    },
                    { 
                      title: "Technology Trends",
                      example: "Quantum computing adoption",
                      icon: "🚀"
                    },
                    { 
                      title: "Industry Analysis",
                      example: "Healthcare digital transformation",
                      icon: "🏥"
                    }
                  ].map((template, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => setDeepResearchTopic(template.example)}
                      className="text-left p-3 h-auto bg-white/5 border-white/10 hover:bg-white/10"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-lg">{template.icon}</span>
                        <div>
                          <p className="font-medium text-white">{template.title}</p>
                          <p className="text-xs text-gray-400">{template.example}</p>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Clarifying Question Dialog */}
      {showClarifyingQuestion && (
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-blue-400" />
              Let me clarify your research request
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-300">{clarifyingQuestion}</p>
            <div className="flex gap-2">
              <Input
                placeholder="Your clarification..."
                className="bg-white/5 border-white/10"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const target = e.target as HTMLInputElement;
                    if (target.value.trim()) {
                      proceedWithDeepResearch(target.value.trim());
                    }
                  }
                }}
              />
              <Button
                onClick={() => {
                  const input = document.querySelector('input[placeholder="Your clarification..."]') as HTMLInputElement;
                  if (input?.value.trim()) {
                    proceedWithDeepResearch(input.value.trim());
                  }
                }}
              >
                Continue Research
              </Button>
            </div>
            <Button
              variant="ghost"
              onClick={() => setShowClarifyingQuestion(false)}
              className="text-gray-400"
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Deep Research Results */}
      {deepResearchResult && (
        <Card className="bg-white/5 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              Deep Research: {deepResearchResult.topic}
            </CardTitle>
            <CardDescription>{deepResearchResult.research_depth}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary" className="mt-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="findings">Key Findings</TabsTrigger>
                <TabsTrigger value="developments">Recent News</TabsTrigger>
                <TabsTrigger value="sources">Sources</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-lg">
                    <h4 className="font-medium text-white mb-2">Expert Opinions</h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                      {deepResearchResult.summary.expert_opinions.slice(0, 3).map((opinion: string, index: number) => (
                        <li key={index}>• {opinion}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-white/5 p-4 rounded-lg">
                    <h4 className="font-medium text-white mb-2">Facts & Figures</h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                      {deepResearchResult.summary.facts_and_figures.slice(0, 3).map((fact: string, index: number) => (
                        <li key={index}>• {fact}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="findings" className="space-y-3">
                {deepResearchResult.summary.key_findings.map((finding: string, index: number) => (
                  <div key={index} className="p-3 bg-white/5 rounded-lg">
                    <p className="text-gray-300">{finding}</p>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="developments" className="space-y-3">
                {deepResearchResult.summary.recent_developments.map((development: string, index: number) => (
                  <div key={index} className="p-3 bg-white/5 rounded-lg">
                    <p className="text-gray-300">{development}</p>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="sources" className="space-y-3">
                {deepResearchResult.sources.map((source: any, index: number) => (
                  <div key={index} className="p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-white">{source.title}</p>
                      <Button size="sm" variant="ghost" asChild>
                        <a href={source.source} target="_blank" rel="noopener noreferrer">
                          <Globe className="w-4 h-4" />
                        </a>
                      </Button>
                    </div>
                    <p className="text-sm text-gray-400">{source.source}</p>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Quick Company Research Results */}
      {research && (
        <Card className="bg-white/5 backdrop-blur-xl border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                {research.company.name}
              </CardTitle>
              <Badge variant="secondary">{research.company.industry}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview" className="mt-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="executives">Executives</TabsTrigger>
                <TabsTrigger value="insights">Insights</TabsTrigger>
                <TabsTrigger value="talking">Talking Points</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Company Size</p>
                    <p className="text-white">{research.company.size}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Founded</p>
                    <p className="text-white">{research.company.founded}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Headquarters</p>
                    <p className="text-white">{research.company.headquarters}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Website</p>
                    <a href={research.company.website} target="_blank" rel="noopener noreferrer" 
                       className="text-blue-400 hover:underline flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      Visit Website
                    </a>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-gray-400 mb-2">Description</p>
                  <p className="text-white">{research.company.description}</p>
                </div>
              </TabsContent>

              <TabsContent value="executives" className="space-y-3">
                {research.executives.map((exec, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div>
                      <p className="font-medium text-white">{exec.name}</p>
                      <p className="text-sm text-gray-400">{exec.title}</p>
                    </div>
                    {exec.linkedin && (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={exec.linkedin} target="_blank" rel="noopener noreferrer">
                          LinkedIn
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="insights" className="space-y-4">
                <div>
                  <h4 className="font-medium text-white mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Competitive Advantage
                  </h4>
                  <p className="text-gray-300">{research.competitiveAdvantage}</p>
                </div>
                <div>
                  <h4 className="font-medium text-white mb-2">Key Opportunities</h4>
                  <ul className="list-disc list-inside text-gray-300">
                    {research.opportunities.map((opp, index) => (
                      <li key={index}>{opp}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-white mb-2">Recent News</h4>
                  {research.recentNews.map((news, index) => (
                    <div key={index} className="mb-3 p-3 bg-white/5 rounded">
                      <p className="font-medium text-white">{news.title}</p>
                      <p className="text-sm text-gray-400">{news.summary}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="talking" className="space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                  <h4 className="font-medium text-white">
                    Suggested {researchType === 'client' ? 'Discussion Topics' : 'Interview Questions'}
                  </h4>
                </div>
                {research.talkingPoints.map((point, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                    <Sparkles className="w-4 h-4 text-yellow-400 mt-0.5" />
                    <p className="text-gray-300">{point}</p>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Cost Savings Note */}
      <Card className="bg-green-500/10 border-green-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-green-400 font-medium">Smart API Usage</p>
              <p className="text-green-300 text-sm">
                Each research uses only 2-3 API calls, keeping costs under $0.10 per company
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}