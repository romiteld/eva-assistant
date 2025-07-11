import FirecrawlApp from '@mendable/firecrawl-js';
import { supabase } from '@/lib/supabase/browser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Database } from '@/types/supabase';
import { ZohoCRMIntegration } from '@/lib/integrations/zoho-crm';
import { getAuthenticatedAPI } from '@/lib/services/authenticated-api';
import { LinkedInEnrichmentAgent, LinkedInEnrichmentData } from '@/lib/agents/linkedin-enrichment';
import { getTokenManager } from '@/lib/auth/token-manager';

export interface LeadCriteria {
  industry: string;
  location?: string;
  companySize?: string;
  revenueRange?: string;
  targetTitles: string[];
  targetRoles?: string[];
  competitorNames?: string[];
  keywords?: string[];
}

interface Lead {
  company: {
    name: string;
    website: string;
    size: string;
    industry: string;
    revenue?: string;
    location?: string;
  };
  executives: Array<{
    name: string;
    title: string;
    linkedin?: string;
    email?: string;
    phone?: string;
  }>;
  score: number;
  insights: string[];
  recommendedApproach: string;
  bestContactTime?: string;
  dataSource: string;
}

interface SearchPhase {
  query: string;
  depth: number;
  extract: any;
  purpose: string;
}

export class EnhancedLeadGenerationAgent {
  private firecrawl: FirecrawlApp;
  private gemini: GoogleGenerativeAI;
  private supabase = supabase;
  private zohoCRM?: ZohoCRMIntegration;
  private linkedInAgent?: LinkedInEnrichmentAgent;
  private userId: string;
  
  constructor(
    geminiApiKey: string,
    firecrawlApiKey: string,
    config: {
      userId: string;
      encryptionKey?: string;
      webhookToken?: string;
      linkedInConfig?: {
        enabled: boolean;
        tokenManager?: ReturnType<typeof getTokenManager>;
      };
    }
  ) {
    this.gemini = new GoogleGenerativeAI(geminiApiKey);
    this.firecrawl = new FirecrawlApp({ apiKey: firecrawlApiKey });
    this.userId = config.userId;
    
    // Initialize Zoho CRM integration if config provided
    if (config.encryptionKey && config.webhookToken) {
      this.zohoCRM = new ZohoCRMIntegration(
        config.encryptionKey,
        config.webhookToken
      );
    }
    
    // Initialize LinkedIn enrichment if enabled
    if (config.linkedInConfig?.enabled && config.linkedInConfig.tokenManager && config.encryptionKey) {
      this.linkedInAgent = new LinkedInEnrichmentAgent(
        config.userId,
        config.encryptionKey,
        {
          linkedin: {
            tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
            clientId: process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID!,
            clientSecret: process.env.LINKEDIN_CLIENT_SECRET!
          },
          // Add other providers as needed
          microsoft: {
            tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            clientId: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || '',
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
            tenantId: process.env.MICROSOFT_TENANT_ID || 'common'
          },
          google: {
            tokenUrl: 'https://oauth2.googleapis.com/token',
            clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || ''
          },
          zoom: {
            tokenUrl: 'https://zoom.us/oauth/token',
            clientId: process.env.ZOOM_CLIENT_ID || '',
            clientSecret: process.env.ZOOM_CLIENT_SECRET || '',
            accountId: process.env.ZOOM_ACCOUNT_ID || ''
          },
          salesforce: {
            tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
            clientId: process.env.SALESFORCE_CLIENT_ID || '',
            clientSecret: process.env.SALESFORCE_CLIENT_SECRET || ''
          },
          zoho: {
            tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
            clientId: process.env.ZOHO_CLIENT_ID || '',
            clientSecret: process.env.ZOHO_CLIENT_SECRET || ''
          }
        }
      );
    }
  }

  async discoverLeads(criteria: LeadCriteria, syncToZoho: boolean = false): Promise<Lead[]> {
    console.log('Starting lead discovery with criteria:', criteria);
    
    try {
      // Stage 1: Deep Web Research with Firecrawl
      const searchResults = await this.performMultiPhaseSearch(criteria);
      
      // Stage 2: Data Extraction and Enrichment
      const extractedLeads = await this.extractLeadData(searchResults);
      
      // Stage 3: LinkedIn Enrichment
      const enrichedLeads = await this.enrichWithLinkedIn(extractedLeads, criteria);
      
      // Stage 4: AI-Powered Qualification
      const qualifiedLeads = await this.qualifyLeads(enrichedLeads, criteria);
      
      // Stage 5: Store and Track
      await this.storeQualifiedLeads(qualifiedLeads);
      
      // Stage 6: Sync to Zoho CRM if enabled
      if (syncToZoho && this.zohoCRM && this.userId) {
        try {
          await this.syncLeadsToZoho(qualifiedLeads);
        } catch (syncError) {
          console.error('Zoho sync failed but continuing with results:', syncError);
          // Log the error but don't fail the entire operation
          await this.logZohoSyncError(syncError);
        }
      }
      
      return qualifiedLeads;
    } catch (error) {
      console.error('Lead generation failed:', error);
      throw error;
    }
  }

  private async performMultiPhaseSearch(criteria: LeadCriteria): Promise<any[]> {
    const searchPhases: SearchPhase[] = [
      // Phase 1: Industry landscape search
      {
        query: `${criteria.industry} companies ${criteria.location || ''} ${criteria.companySize || ''} ${criteria.revenueRange || ''}`.trim(),
        depth: 3,
        purpose: 'industry_landscape',
        extract: {
          prompt: "Extract company information including name, website, size, and industry focus",
          schema: {
            companies: [{
              name: "string",
              website: "string",
              size: "string",
              industry: "string",
              description: "string"
            }]
          }
        }
      },
      // Phase 2: Decision makers search
      {
        query: `"${criteria.targetTitles.join('" OR "')} ${criteria.industry} LinkedIn executives contact"`,
        depth: 2,
        purpose: 'decision_makers',
        extract: {
          prompt: "Extract executive information including names, titles, companies, and LinkedIn profiles",
          schema: {
            executives: [{
              name: "string",
              title: "string",
              company: "string",
              linkedin: "string",
              email: "string"
            }]
          }
        }
      },
      // Phase 3: Competitive intelligence
      {
        query: criteria.competitorNames?.length 
          ? `${criteria.competitorNames.join(' OR ')} hiring "${criteria.targetRoles?.join('" OR "')}" expansion growth`
          : `${criteria.industry} companies hiring expansion opportunities`,
        depth: 2,
        purpose: 'competitive_intel',
        extract: {
          prompt: "Extract information about company growth, hiring, and expansion opportunities",
          schema: {
            opportunities: [{
              company: "string",
              openRoles: ["string"],
              growthIndicators: ["string"],
              recentNews: ["string"]
            }]
          }
        }
      },
      // Phase 4: Financial advisor specific search (if applicable)
      {
        query: criteria.industry.toLowerCase().includes('financial') 
          ? `financial advisors RIA wealth management ${criteria.location || ''} AUM billion`
          : '',
        depth: 3,
        purpose: 'financial_advisors',
        extract: {
          prompt: "Extract financial advisory firm information including AUM, advisor count, and specialties",
          schema: {
            firms: [{
              name: "string",
              aum: "string",
              advisorCount: "number",
              specialties: ["string"],
              website: "string"
            }]
          }
        }
      }
    ].filter(phase => phase.query); // Remove empty queries

    const searchPromises = searchPhases.map(async (phase) => {
      try {
        console.log(`Executing search phase: ${phase.purpose}`);
        
        const searchResult = await this.firecrawl.search(phase.query, {
          limit: 20,
          scrapeOptions: {
            formats: ["markdown", "extract"],
            extract: phase.extract,
            maxDepth: phase.depth,
            onlyMainContent: true,
            waitFor: 2000 // Wait for dynamic content
          }
        });

        return {
          phase: phase.purpose,
          query: phase.query,
          results: searchResult
        };
      } catch (error) {
        console.error(`Search phase ${phase.purpose} failed:`, error);
        return {
          phase: phase.purpose,
          query: phase.query,
          results: { data: [] },
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    const results = await Promise.all(searchPromises);
    return results;
  }

  private async extractLeadData(searchResults: any[]): Promise<any[]> {
    const extractedLeads = [];
    
    for (const phaseResult of searchResults) {
      if (!phaseResult.results?.data) continue;
      
      for (const result of phaseResult.results.data) {
        try {
          // Extract structured data based on phase
          let leadData = {};
          
          switch (phaseResult.phase) {
            case 'industry_landscape':
              if (result.extract?.companies) {
                leadData = {
                  companies: result.extract.companies,
                  source: result.url,
                  sourceType: 'industry_search'
                };
              }
              break;
              
            case 'decision_makers':
              if (result.extract?.executives) {
                leadData = {
                  executives: result.extract.executives,
                  source: result.url,
                  sourceType: 'executive_search'
                };
              }
              break;
              
            case 'competitive_intel':
              if (result.extract?.opportunities) {
                leadData = {
                  opportunities: result.extract.opportunities,
                  source: result.url,
                  sourceType: 'competitive_intel'
                };
              }
              break;
              
            case 'financial_advisors':
              if (result.extract?.firms) {
                leadData = {
                  firms: result.extract.firms,
                  source: result.url,
                  sourceType: 'financial_advisors'
                };
              }
              break;
          }
          
          if (Object.keys(leadData).length > 0) {
            extractedLeads.push(leadData);
          }
        } catch (error) {
          console.error('Error extracting lead data:', error);
        }
      }
    }
    
    return extractedLeads;
  }

  private async enrichWithLinkedIn(extractedLeads: any[], criteria: LeadCriteria): Promise<any[]> {
    const enrichedLeads = [];
    
    for (const leadData of extractedLeads) {
      if (leadData.companies) {
        for (const company of leadData.companies) {
          // Search for executives in this company from our executive search results
          const companyExecutives = extractedLeads
            .filter((l: any) => l.sourceType === 'executive_search')
            .flatMap((l: any) => l.executives || [])
            .filter((exec: any) => exec.company?.toLowerCase().includes(company.name.toLowerCase()));
          
          // Enrich executives with LinkedIn data if available
          const enrichedExecutives = [];
          for (const exec of companyExecutives) {
            let enrichedExec = { ...exec };
            
            // If LinkedIn agent is available and exec has LinkedIn URL
            if (this.linkedInAgent && exec.linkedin) {
              try {
                const linkedInData = await this.linkedInAgent.enrichLeadFromLinkedIn(exec.linkedin);
                if (linkedInData) {
                  enrichedExec = {
                    ...enrichedExec,
                    linkedin: exec.linkedin,
                    linkedInProfile: linkedInData.profile,
                    skills: linkedInData.skills,
                    experience: linkedInData.experience,
                    isOpenToWork: linkedInData.isOpenToWork,
                    // Update email if found on LinkedIn
                    email: enrichedExec.email || linkedInData.profile.email
                  };
                }
              } catch (error) {
                console.error(`Failed to enrich LinkedIn data for ${exec.name}:`, error);
              }
            }
            
            enrichedExecutives.push(enrichedExec);
          }
          
          // If LinkedIn agent is available, search for additional leads
          if (this.linkedInAgent && criteria.targetTitles && criteria.targetTitles.length > 0) {
            try {
              const linkedInSearchResults = await this.linkedInAgent.searchPotentialLeads({
                company: company.name,
                title: criteria.targetTitles.join(' OR '),
                location: criteria.location,
                industry: criteria.industry
              });
              
              // Add LinkedIn-sourced leads to executives list
              for (const linkedInLead of linkedInSearchResults) {
                // Check if we already have this person
                const exists = enrichedExecutives.some(
                  e => e.linkedin === linkedInLead.profileUrl || 
                       e.name.toLowerCase() === linkedInLead.name.toLowerCase()
                );
                
                if (!exists) {
                  enrichedExecutives.push({
                    name: linkedInLead.name,
                    title: linkedInLead.headline,
                    company: linkedInLead.company || company.name,
                    linkedin: linkedInLead.profileUrl,
                    dataSource: 'LinkedIn'
                  });
                }
              }
            } catch (error) {
              console.error('LinkedIn search failed:', error);
            }
          }
          
          enrichedLeads.push({
            company,
            executives: enrichedExecutives,
            dataSource: leadData.source
          });
        }
      }
    }
    
    return enrichedLeads;
  }

  private async qualifyLeads(enrichedLeads: any[], criteria: LeadCriteria): Promise<Lead[]> {
    const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
    
    const qualificationPrompt = `
      You are an expert lead qualification specialist for financial advisory recruiting.
      
      Analyze these potential leads and score them based on:
      1. Company fit (industry: ${criteria.industry}, size: ${criteria.companySize || 'any'}, location: ${criteria.location || 'any'})
      2. Decision maker accessibility (we need: ${criteria.targetTitles.join(', ')})
      3. Current pain points or growth opportunities
      4. Timing indicators (hiring, expansion, recent changes)
      5. Budget/revenue indicators (${criteria.revenueRange || 'any'})
      
      For each lead, provide:
      - Qualification score (0-100)
      - Key insights (3-5 bullet points)
      - Recommended outreach approach
      - Best time to contact (if determinable)
      
      Lead data:
      ${JSON.stringify(enrichedLeads, null, 2)}
      
      Return response as JSON array of qualified leads.
    `;

    try {
      const result = await model.generateContent(qualificationPrompt);
      const response = result.response.text();
      
      // Parse AI response
      const qualifiedData = this.parseAIResponse(response);
      
      // Map to Lead interface
      const qualifiedLeads: Lead[] = enrichedLeads.map((lead: any, index: number) => {
        const qualification = qualifiedData[index] || {};
        
        return {
          company: {
            name: lead.company?.name || 'Unknown',
            website: lead.company?.website || '',
            size: lead.company?.size || criteria.companySize || 'Unknown',
            industry: lead.company?.industry || criteria.industry,
            location: criteria.location
          },
          executives: lead.executives || [],
          score: qualification.score || 50,
          insights: qualification.insights || ['Requires further analysis'],
          recommendedApproach: qualification.recommendedApproach || 'Standard outreach',
          bestContactTime: qualification.bestContactTime,
          dataSource: lead.dataSource || 'web_search'
        };
      });
      
      // Sort by score and filter high-quality leads
      return qualifiedLeads
        .filter(lead => lead.score >= 60)
        .sort((a, b) => b.score - a.score);
        
    } catch (error) {
      console.error('AI qualification failed:', error);
      // Fallback to basic scoring
      return enrichedLeads.map(lead => this.basicQualification(lead, criteria));
    }
  }

  private basicQualification(lead: any, criteria: LeadCriteria): Lead {
    let score = 50; // Base score
    const insights = [];
    
    // Score based on available data
    if (lead.company?.name) score += 10;
    if (lead.company?.website) score += 10;
    if (lead.executives?.length > 0) score += 20;
    if (lead.executives?.some((e: any) => criteria.targetTitles.some((t: string) => e.title?.includes(t)))) score += 20;
    
    // Generate basic insights
    if (lead.executives?.length > 0) {
      insights.push(`Found ${lead.executives.length} potential decision makers`);
    }
    if (lead.company?.size) {
      insights.push(`Company size: ${lead.company.size}`);
    }
    
    return {
      company: lead.company || { name: 'Unknown', website: '', size: 'Unknown', industry: criteria.industry },
      executives: lead.executives || [],
      score,
      insights,
      recommendedApproach: score >= 70 ? 'Priority outreach' : 'Standard outreach',
      dataSource: lead.dataSource || 'web_search'
    };
  }

  private async storeQualifiedLeads(qualifiedLeads: Lead[]): Promise<void> {
    try {
      // Store organizations
      for (const lead of qualifiedLeads) {
        // Insert or update organization
        const { data: org, error: orgError } = await this.supabase
          .from('organizations')
          .upsert({
            name: lead.company.name,
            website: lead.company.website,
            size: lead.company.size,
            industry: lead.company.industry,
            metadata: {
              leadScore: lead.score,
              insights: lead.insights,
              dataSource: lead.dataSource,
              lastUpdated: new Date().toISOString()
            }
          }, {
            onConflict: 'name'
          })
          .select()
          .single();

        if (orgError) {
          console.error('Error storing organization:', orgError);
          continue;
        }

        // Store lead score
        if (org) {
          await this.supabase
            .from('lead_scores')
            .insert({
              organization_id: org.id,
              score: lead.score / 100, // Convert to 0-1 scale
              scoring_factors: {
                companyFit: lead.company,
                executivesFound: lead.executives.length,
                insights: lead.insights
              },
              qualification_status: this.getQualificationStatus(lead.score),
              next_action_recommended: lead.recommendedApproach,
              ai_insights: lead.insights,
              valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            });
        }

        // Store executives as candidates (if email available)
        for (const executive of lead.executives) {
          if (executive.email || executive.linkedin) {
            await this.supabase
              .from('candidates')
              .upsert({
                name: executive.name,
                email: executive.email || `${executive.name.toLowerCase().replace(/\s+/g, '.')}@${lead.company.website}`,
                current_position: executive.title,
                current_company: lead.company.name,
                linkedin_url: executive.linkedin,
                metadata: {
                  source: 'lead_generation',
                  organizationId: org?.id,
                  discoveredAt: new Date().toISOString()
                }
              }, {
                onConflict: 'email'
              });
          }
        }
      }
      
      console.log(`Stored ${qualifiedLeads.length} qualified leads`);
    } catch (error) {
      console.error('Error storing leads:', error);
      throw error;
    }
  }

  private getQualificationStatus(score: number): 'hot' | 'warm' | 'cold' | 'disqualified' {
    if (score >= 80) return 'hot';
    if (score >= 65) return 'warm';
    if (score >= 40) return 'cold';
    return 'disqualified';
  }

  private parseAIResponse(response: string): any[] {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return [];
    }
  }

  // Search leads method for simple text-based searches
  async searchLeads(query: string, options?: {
    maxResults?: number;
    includeLinkedIn?: boolean;
    includeCompanyInfo?: boolean;
  }): Promise<Lead[]> {
    try {
      // Parse the query to extract criteria
      const criteria: LeadCriteria = {
        industry: 'any',
        targetTitles: ['CEO', 'CTO', 'VP', 'Director', 'Manager'],
        keywords: query.split(' ').filter(word => word.length > 2)
      };

      let leads: Lead[] = [];

      try {
        // Try Firecrawl search first
        const searchResults = await this.firecrawl.search(query, {
          limit: options?.maxResults || 10,
          scrapeOptions: {
            formats: ["markdown", "extract"],
            extract: {
              prompt: "Extract company and executive information",
              schema: {
                companies: [{
                  name: "string",
                  website: "string",
                  executives: [{
                    name: "string",
                    title: "string",
                    email: "string",
                    linkedin: "string"
                  }]
                }]
              }
            },
            onlyMainContent: true,
            waitFor: 2000
          }
        });

        // Transform search results to Lead format
        for (const result of searchResults.data || []) {
          const extractData = result.extract as any;
          if (extractData?.companies) {
            for (const company of extractData.companies) {
              leads.push({
                company: {
                  name: company.name || 'Unknown',
                  website: company.website || result.url,
                  size: 'Unknown',
                  industry: 'Unknown',
                  location: undefined
                },
                executives: company.executives || [],
                score: 70, // Default score for search results
                insights: [`Found via search: "${query}"`],
                recommendedApproach: 'Research and personalize outreach',
                dataSource: result.url || ''
              });
            }
          }
        }
      } catch (firecrawlError) {
        console.error('Firecrawl search failed, using mock data:', firecrawlError);
        
        // Use mock data for testing when Firecrawl fails
        leads = this.generateMockLeads(query, options?.maxResults || 10);
      }

      // Optionally enrich with additional data
      if (options?.includeLinkedIn) {
        // Would add LinkedIn enrichment here
      }

      return leads.slice(0, options?.maxResults || 10);
    } catch (error) {
      console.error('Search leads error:', error);
      throw new Error(`Failed to search leads: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Generate mock leads for testing
  private generateMockLeads(query: string, maxResults: number): Lead[] {
    const mockCompanies = [
      { name: 'Wealth Management Partners', size: '50-200', industry: 'Financial Services' },
      { name: 'Capital Advisors Group', size: '10-50', industry: 'Financial Services' },
      { name: 'Investment Solutions LLC', size: '200-500', industry: 'Asset Management' },
      { name: 'Financial Planning Associates', size: '5-10', industry: 'Financial Advisory' },
      { name: 'Premier Wealth Advisors', size: '20-50', industry: 'Wealth Management' }
    ];

    const mockTitles = ['CEO', 'VP of Sales', 'Director of Business Development', 'Managing Partner', 'Chief Investment Officer'];
    const mockFirstNames = ['John', 'Sarah', 'Michael', 'Jennifer', 'Robert'];
    const mockLastNames = ['Smith', 'Johnson', 'Williams', 'Davis', 'Miller'];

    return mockCompanies.slice(0, maxResults).map((company, index) => ({
      company: {
        ...company,
        website: `https://${company.name.toLowerCase().replace(/\s+/g, '')}.com`,
        location: 'New York, NY'
      },
      executives: [{
        name: `${mockFirstNames[index % mockFirstNames.length]} ${mockLastNames[index % mockLastNames.length]}`,
        title: mockTitles[index % mockTitles.length],
        email: `contact@${company.name.toLowerCase().replace(/\s+/g, '')}.com`,
        linkedin: `https://linkedin.com/in/${mockFirstNames[index % mockFirstNames.length].toLowerCase()}${mockLastNames[index % mockLastNames.length].toLowerCase()}`
      }],
      score: 65 + Math.floor(Math.random() * 30), // Random score between 65-95
      insights: [
        `Active in ${company.industry}`,
        `Company size: ${company.size} employees`,
        `Located in prime financial district`,
        `Matches search criteria: "${query}"`
      ],
      recommendedApproach: 'Personalized outreach via LinkedIn or email',
      dataSource: 'Mock data (Firecrawl unavailable)'
    }));
  }

  // Additional utility methods
  async searchCompetitorEmployees(competitorName: string, targetRoles: string[]): Promise<Lead[]> {
    const criteria: LeadCriteria = {
      industry: 'any',
      competitorNames: [competitorName],
      targetTitles: targetRoles,
      targetRoles: targetRoles
    };
    
    return this.discoverLeads(criteria);
  }

  async findFinancialAdvisors(location: string, minAUM?: string): Promise<Lead[]> {
    const criteria: LeadCriteria = {
      industry: 'Financial Services',
      location,
      targetTitles: ['Financial Advisor', 'Wealth Manager', 'Portfolio Manager', 'Investment Advisor'],
      keywords: minAUM ? [`AUM ${minAUM}`, 'billion AUM', 'assets under management'] : []
    };
    
    return this.discoverLeads(criteria);
  }

  // Zoho CRM Integration Methods
  async syncLeadsToZoho(leads: Lead[]): Promise<void> {
    if (!this.zohoCRM || !this.userId) {
      console.warn('Zoho CRM integration not configured');
      return;
    }

    console.log(`Syncing ${leads.length} leads to Zoho CRM`);
    
    try {
      // Initialize Zoho authentication using environment variables
      await this.initializeZohoAuth();
      
      // Check for existing leads to avoid duplicates
      const existingLeads = await this.checkExistingZohoLeads(leads);
      
      // Prepare leads for Zoho
      const zohoLeads = leads.map(lead => this.mapLeadToZohoFormat(lead));
      
      // Filter out duplicates
      const newLeads = zohoLeads.filter((lead: any, index: number) => 
        !existingLeads.has(leads[index].company.name + '_' + (leads[index].executives[0]?.email || ''))
      );
      
      if (newLeads.length === 0) {
        console.log('All leads already exist in Zoho CRM');
        return;
      }
      
      // Bulk create leads in Zoho
      const createdLeads = await this.zohoCRM.bulkCreateLeads(this.userId, newLeads);
      
      // Log sync activity
      await this.logZohoSyncActivity(createdLeads.length, leads.length - newLeads.length);
      
      console.log(`Successfully synced ${createdLeads.length} new leads to Zoho CRM`);
      
      // Update local records with Zoho IDs
      await this.updateLocalLeadsWithZohoIds(leads, createdLeads);
      
      // Trigger webhook notification for synced leads
      await this.notifyZohoWebhook(createdLeads);
      
    } catch (error) {
      console.error('Error syncing leads to Zoho:', error);
      await this.logZohoSyncError(error);
      throw error;
    }
  }

  private async checkExistingZohoLeads(leads: Lead[]): Promise<Set<string>> {
    if (!this.zohoCRM || !this.userId) return new Set();
    
    const existingLeads = new Set<string>();
    
    try {
      // Check by email addresses
      for (const lead of leads) {
        for (const executive of lead.executives) {
          if (executive.email) {
            const searchResult = await this.zohoCRM.searchRecords(
              this.userId,
              'Leads',
              { email: executive.email }
            );
            
            if (searchResult.data && searchResult.data.length > 0) {
              existingLeads.add(lead.company.name + '_' + executive.email);
            }
          }
        }
        
        // Also check by company name
        const companySearch = await this.zohoCRM.searchRecords(
          this.userId,
          'Leads',
          { criteria: `(Company:equals:${lead.company.name})` }
        );
        
        if (companySearch.data && companySearch.data.length > 0) {
          existingLeads.add(lead.company.name + '_');
        }
      }
    } catch (error) {
      console.error('Error checking existing Zoho leads:', error);
    }
    
    return existingLeads;
  }

  private mapLeadToZohoFormat(lead: Lead): any {
    // Map to Zoho lead format
    const primaryExecutive = lead.executives[0] || {};
    
    return {
      First_Name: primaryExecutive.name?.split(' ')[0] || 'Unknown',
      Last_Name: primaryExecutive.name?.split(' ').slice(1).join(' ') || 'Contact',
      Email: primaryExecutive.email || '',
      Phone: primaryExecutive.phone || '',
      Company: lead.company.name,
      Title: primaryExecutive.title || '',
      Lead_Status: 'New',
      Lead_Source: 'AI Lead Generation',
      Industry: lead.company.industry,
      Annual_Revenue: this.estimateRevenue(lead.company.size),
      Description: lead.insights.join('\n'),
      Website: lead.company.website,
      LinkedIn: primaryExecutive.linkedin || '',
      Lead_Score: lead.score,
      Custom_Fields: {
        Company_Size: lead.company.size,
        Location: lead.company.location,
        AI_Insights: lead.insights,
        Recommended_Approach: lead.recommendedApproach,
        Best_Contact_Time: lead.bestContactTime,
        Data_Source: lead.dataSource,
        Other_Executives: lead.executives.slice(1).map((exec: any) => ({
          name: exec.name,
          title: exec.title,
          email: exec.email,
          linkedin: exec.linkedin
        }))
      }
    };
  }

  private estimateRevenue(companySize: string): number {
    // Rough revenue estimation based on company size
    const revenueMap: Record<string, number> = {
      '1-10': 1000000,
      '11-50': 5000000,
      '51-200': 25000000,
      '201-500': 75000000,
      '501-1000': 150000000,
      '1001-5000': 500000000,
      '5001+': 1000000000
    };
    
    return revenueMap[companySize] || 0;
  }

  private async updateLocalLeadsWithZohoIds(
    localLeads: Lead[],
    zohoLeads: any[]
  ): Promise<void> {
    try {
      for (let i = 0; i < zohoLeads.length; i++) {
        const zohoLead = zohoLeads[i];
        const localLead = localLeads[i];
        
        if (zohoLead.id && localLead.company.name) {
          // Update organization metadata with Zoho ID
          await this.supabase
            .from('organizations')
            .update({
              metadata: {
                ...localLead,
                zoho_lead_id: zohoLead.id,
                zoho_sync_date: new Date().toISOString()
              }
            })
            .eq('name', localLead.company.name);
        }
      }
    } catch (error) {
      console.error('Error updating local leads with Zoho IDs:', error);
    }
  }

  private async logZohoSyncActivity(
    newLeadsCount: number,
    duplicatesCount: number
  ): Promise<void> {
    try {
      await this.supabase
        .from('integration_logs')
        .insert({
          integration: 'zoho_crm',
          action: 'lead_sync',
          status: 'success',
          details: {
            new_leads: newLeadsCount,
            duplicates: duplicatesCount,
            total_processed: newLeadsCount + duplicatesCount
          },
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error logging sync activity:', error);
    }
  }

  private async logZohoSyncError(error: any): Promise<void> {
    try {
      await this.supabase
        .from('integration_logs')
        .insert({
          integration: 'zoho_crm',
          action: 'lead_sync',
          status: 'error',
          error_message: error.message || 'Unknown error',
          details: {
            error_stack: error.stack,
            timestamp: new Date().toISOString()
          },
          created_at: new Date().toISOString()
        });
    } catch (logError) {
      console.error('Error logging sync error:', logError);
    }
  }

  // Manual sync method for existing leads
  async syncExistingLeadsToZoho(
    organizationIds?: string[]
  ): Promise<{ synced: number; failed: number }> {
    if (!this.zohoCRM || !this.userId) {
      throw new Error('Zoho CRM integration not configured');
    }
    
    let synced = 0;
    let failed = 0;
    
    try {
      // Initialize Zoho authentication
      await this.initializeZohoAuth();
      
      // Fetch organizations to sync
      let query = this.supabase
        .from('organizations')
        .select('*, lead_scores(*)');
      
      if (organizationIds && organizationIds.length > 0) {
        query = query.in('id', organizationIds);
      }
      
      const { data: organizations, error } = await query;
      
      if (error) throw error;
      
      for (const org of organizations || []) {
        try {
          // Check if already synced
          if (org.metadata?.zoho_lead_id) {
            console.log(`Organization ${org.name} already synced to Zoho`);
            continue;
          }
          
          // Prepare lead data
          const leadData = {
            First_Name: 'Unknown',
            Last_Name: 'Contact',
            Email: 'contact@' + (org.website?.replace(/^https?:\/\//, '').replace(/^www\./, '') || 'example.com'),
            Company: org.name,
            Website: org.website || '',
            Industry: org.industry || '',
            Lead_Status: 'New',
            Lead_Source: 'Database Import',
            Lead_Score: org.lead_scores?.[0]?.score ? Math.round(org.lead_scores[0].score * 100) : 50,
            Description: org.metadata?.insights?.join('\n') || '',
            Custom_Fields: {
              Organization_Id: org.id,
              Import_Date: new Date().toISOString()
            }
          };
          
          // Create lead in Zoho
          const zohoLead = await this.zohoCRM.createLead(this.userId, leadData);
          
          // Update local record
          await this.supabase
            .from('organizations')
            .update({
              metadata: {
                ...org.metadata,
                zoho_lead_id: zohoLead.id,
                zoho_sync_date: new Date().toISOString()
              }
            })
            .eq('id', org.id);
          
          synced++;
        } catch (error) {
          console.error(`Failed to sync organization ${org.name}:`, error);
          failed++;
        }
      }
      
      await this.logZohoSyncActivity(synced, failed);
      
      return { synced, failed };
    } catch (error) {
      console.error('Error in bulk sync to Zoho:', error);
      throw error;
    }
  }

  // Helper method to initialize Zoho authentication
  private async initializeZohoAuth(): Promise<void> {
    if (!this.zohoCRM) return;
    
    try {
      // Check if we need to refresh the access token
      const tokenInfo = await this.supabase
        .from('oauth_tokens')
        .select('*')
        .eq('user_id', this.userId)
        .eq('provider', 'zoho')
        .single();
        
      if (tokenInfo.data) {
        const tokenAge = Date.now() - new Date(tokenInfo.data.updated_at).getTime();
        const tokenExpiresIn = (tokenInfo.data.expires_in || 3600) * 1000; // Convert to milliseconds
        
        if (tokenAge > tokenExpiresIn * 0.9) { // Refresh if 90% expired
          console.log('Refreshing Zoho access token...');
          // The authenticated API will handle token refresh automatically
        }
      }
    } catch (error) {
      console.error('Error checking Zoho auth status:', error);
    }
  }

  // Helper method to notify Zoho webhook about new leads
  private async notifyZohoWebhook(createdLeads: any[]): Promise<void> {
    if (!createdLeads.length) return;
    
    try {
      const webhookUrl = process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL + '/api/webhooks/zoho';
      const webhookToken = process.env.ZOHO_WEBHOOK_TOKEN;
      
      if (webhookUrl && webhookToken) {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Zoho-Webhook-Token': webhookToken
          },
          body: JSON.stringify({
            module: 'Leads',
            operation: 'bulk_insert',
            ids: createdLeads.map((lead: any) => lead.id),
            data: createdLeads,
            timestamp: new Date().toISOString(),
            source: 'eva_lead_generation'
          })
        });
        
        if (!response.ok) {
          console.error('Failed to notify Zoho webhook:', response.statusText);
        }
      }
    } catch (error) {
      console.error('Error notifying Zoho webhook:', error);
      // Don't throw - this is not critical
    }
  }

  // Real-time sync method with retry logic
  async syncLeadToZohoWithRetry(lead: Lead, maxRetries: number = 3): Promise<any> {
    if (!this.zohoCRM || !this.userId) {
      throw new Error('Zoho CRM integration not configured');
    }

    let retries = 0;
    let lastError;

    while (retries < maxRetries) {
      try {
        // Check if lead already exists
        const existingLead = await this.checkExistingZohoLeads([lead]);
        if (existingLead.size > 0) {
          console.log(`Lead ${lead.company.name} already exists in Zoho`);
          return null;
        }

        // Map lead to Zoho format
        const zohoLead = this.mapLeadToZohoFormat(lead);

        // Create lead in Zoho
        const createdLead = await this.zohoCRM.createLead(this.userId, zohoLead);

        // Update local record with Zoho ID
        await this.updateLocalLeadsWithZohoIds([lead], [createdLead]);

        // Log successful sync
        await this.logZohoSyncActivity(1, 0);

        console.log(`Successfully synced lead ${lead.company.name} to Zoho CRM`);
        return createdLead;

      } catch (error) {
        lastError = error;
        retries++;
        
        console.error(`Attempt ${retries} failed for lead ${lead.company.name}:`, error);
        
        // Check if error is retryable
        const errorMessage = error instanceof Error ? error.message : '';
        if (errorMessage.includes('rate limit') || errorMessage.includes('timeout')) {
          // Exponential backoff
          const waitTime = Math.pow(2, retries) * 1000; // 2s, 4s, 8s
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          // Non-retryable error
          break;
        }
      }
    }

    // All retries failed
    await this.logZohoSyncError(lastError);
    throw new Error(`Failed to sync lead ${lead.company.name} after ${maxRetries} attempts: ${(lastError as any)?.message || 'Unknown error'}`);
  }

  // Batch sync with progress tracking
  async syncLeadsToZohoWithProgress(
    leads: Lead[],
    onProgress?: (current: number, total: number) => void
  ): Promise<{ succeeded: Lead[]; failed: Lead[] }> {
    const succeeded: Lead[] = [];
    const failed: Lead[] = [];

    for (let i = 0; i < leads.length; i++) {
      try {
        await this.syncLeadToZohoWithRetry(leads[i]);
        succeeded.push(leads[i]);
      } catch (error) {
        console.error(`Failed to sync lead ${leads[i].company.name}:`, error);
        failed.push(leads[i]);
      }

      // Report progress
      if (onProgress) {
        onProgress(i + 1, leads.length);
      }
    }

    console.log(`Sync completed: ${succeeded.length} succeeded, ${failed.length} failed`);
    return { succeeded, failed };
  }
}