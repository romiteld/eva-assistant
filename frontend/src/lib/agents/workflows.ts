// Pre-built workflows for Financial Advisory Recruiting
import { Workflow, AgentTask } from './a2a-orchestrator';

// Comprehensive Candidate Research Workflow
export const candidateResearchWorkflow: Workflow = {
  id: 'candidate-research',
  name: 'Comprehensive Candidate Research',
  description: 'Gather complete intelligence on a potential financial advisor candidate',
  agents: ['firecrawl-agent', 'gemini-agent', 'rag-agent'],
  tasks: [
    {
      id: 'search-candidate',
      type: 'search',
      params: {
        agentId: 'firecrawl-agent',
        query: '{{candidateName}} {{candidateCompany}} financial advisor',
        options: { limit: 20 }
      }
    },
    {
      id: 'extract-profile',
      type: 'extract',
      params: {
        agentId: 'firecrawl-agent',
        urls: '{{searchResults}}',
        schema: {
          profile: {
            name: 'string',
            currentTitle: 'string',
            company: 'string',
            experience: 'string',
            certifications: ['string'],
            specialties: ['string'],
            education: ['string'],
            achievements: ['string']
          }
        }
      },
      dependencies: ['search-candidate']
    },
    {
      id: 'analyze-candidate',
      type: 'analyze',
      params: {
        agentId: 'gemini-agent',
        prompt: 'Analyze this financial advisor candidate profile and provide insights on their strengths, potential fit, and areas of expertise',
        schema: {
          analysis: {
            strengths: ['string'],
            expertise: ['string'],
            careerTrajectory: 'string',
            potentialFit: 'number',
            recommendations: ['string']
          }
        }
      },
      dependencies: ['extract-profile']
    },
    {
      id: 'store-intel',
      type: 'index',
      params: {
        agentId: 'rag-agent',
        documentType: 'candidate-research',
        content: '{{analysisResults}}'
      },
      dependencies: ['analyze-candidate']
    }
  ]
};

// Company Intelligence Workflow
export const companyIntelWorkflow: Workflow = {
  id: 'company-intel',
  name: 'Financial Services Company Intelligence',
  description: 'Deep dive into a financial services company for recruiting opportunities',
  agents: ['firecrawl-agent', 'gemini-agent'],
  tasks: [
    {
      id: 'map-company',
      type: 'map',
      params: {
        agentId: 'firecrawl-agent',
        url: '{{companyDomain}}',
        options: { limit: 100 }
      }
    },
    {
      id: 'scrape-advisors',
      type: 'scrape',
      params: {
        agentId: 'firecrawl-agent',
        urls: '{{advisorPages}}',
        options: {
          formats: ['markdown', 'links'],
          onlyMainContent: true
        }
      },
      dependencies: ['map-company']
    },
    {
      id: 'extract-team',
      type: 'extract',
      params: {
        agentId: 'firecrawl-agent',
        urls: '{{teamPages}}',
        schema: {
          advisors: [{
            name: 'string',
            title: 'string',
            yearsExperience: 'number',
            aum: 'string',
            specialties: ['string'],
            contact: {
              email: 'string',
              phone: 'string',
              linkedin: 'string'
            }
          }]
        }
      },
      dependencies: ['map-company']
    },
    {
      id: 'analyze-company',
      type: 'analyze',
      params: {
        agentId: 'gemini-agent',
        prompt: 'Analyze this financial services company and identify recruiting opportunities, company culture, and growth trajectory',
        schema: {
          analysis: {
            companyOverview: 'string',
            culture: ['string'],
            growthIndicators: ['string'],
            recruitingOpportunities: ['string'],
            competitivePosition: 'string',
            recommendations: ['string']
          }
        }
      },
      dependencies: ['extract-team', 'scrape-advisors']
    }
  ]
};

// Social Media Outreach Optimization Workflow
export const outreachOptimizationWorkflow: Workflow = {
  id: 'outreach-optimization',
  name: 'Financial Advisor Outreach Optimization',
  description: 'Optimize recruiting outreach messages for maximum engagement',
  agents: ['firecrawl-agent', 'gemini-agent', 'rag-agent'],
  tasks: [
    {
      id: 'search-trends',
      type: 'search',
      params: {
        agentId: 'firecrawl-agent',
        query: 'financial advisor recruiting trends LinkedIn messages',
        options: { limit: 15 }
      }
    },
    {
      id: 'analyze-trends',
      type: 'extract',
      params: {
        agentId: 'firecrawl-agent',
        urls: '{{trendResults}}',
        schema: {
          trends: [{
            topic: 'string',
            engagement: 'number',
            bestPractices: ['string'],
            keywords: ['string']
          }]
        }
      },
      dependencies: ['search-trends']
    },
    {
      id: 'query-templates',
      type: 'query',
      params: {
        agentId: 'rag-agent',
        query: 'successful financial advisor recruiting message templates',
        options: {
          matchCount: 10
        }
      }
    },
    {
      id: 'generate-message',
      type: 'generate',
      params: {
        agentId: 'gemini-agent',
        prompt: 'Create an optimized LinkedIn recruiting message for a financial advisor based on trends and best practices',
        context: {
          targetProfile: '{{candidateProfile}}',
          trends: '{{analyzedTrends}}',
          templates: '{{templateResults}}'
        }
      },
      dependencies: ['analyze-trends', 'query-templates']
    },
    {
      id: 'predict-performance',
      type: 'analyze',
      params: {
        agentId: 'gemini-agent',
        prompt: 'Predict the engagement rate and response likelihood for this recruiting message',
        schema: {
          prediction: {
            engagementScore: 'number',
            responseRate: 'number',
            improvements: ['string'],
            alternativeVersions: ['string']
          }
        }
      },
      dependencies: ['generate-message']
    }
  ]
};

// Competitive Analysis Workflow
export const competitiveAnalysisWorkflow: Workflow = {
  id: 'competitive-analysis',
  name: 'Financial Services Competitive Analysis',
  description: 'Analyze competing firms for talent acquisition insights',
  agents: ['firecrawl-agent', 'gemini-agent'],
  tasks: [
    {
      id: 'map-competitors',
      type: 'map',
      params: {
        agentId: 'firecrawl-agent',
        urls: '{{competitorDomains}}',
        options: { limit: 50 }
      }
    },
    {
      id: 'extract-compensation',
      type: 'search',
      params: {
        agentId: 'firecrawl-agent',
        query: '{{competitorName}} financial advisor compensation benefits',
        options: { limit: 10 }
      }
    },
    {
      id: 'scrape-culture',
      type: 'scrape',
      params: {
        agentId: 'firecrawl-agent',
        urls: '{{culturePages}}',
        options: {
          formats: ['markdown'],
          onlyMainContent: true
        }
      },
      dependencies: ['map-competitors']
    },
    {
      id: 'analyze-competitive-position',
      type: 'analyze',
      params: {
        agentId: 'gemini-agent',
        prompt: 'Analyze competitive positioning for talent acquisition in financial services',
        schema: {
          analysis: {
            marketPosition: {
              strengths: ['string'],
              weaknesses: ['string'],
              opportunities: ['string'],
              threats: ['string']
            },
            compensationInsights: {
              averageRange: 'string',
              benefits: ['string'],
              uniqueOfferings: ['string']
            },
            talentStrategy: {
              recommendations: ['string'],
              targetProfiles: ['string'],
              messagingStrategy: ['string']
            }
          }
        }
      },
      dependencies: ['extract-compensation', 'scrape-culture']
    }
  ]
};

// Export all workflows
export const prebuiltWorkflows = {
  candidateResearchWorkflow,
  companyIntelWorkflow,
  outreachOptimizationWorkflow,
  competitiveAnalysisWorkflow
};