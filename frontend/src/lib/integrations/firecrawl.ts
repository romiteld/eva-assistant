// Firecrawl Web Scraping Integration
import FirecrawlApp from '@mendable/firecrawl-js'

export class FirecrawlClient {
  private app: FirecrawlApp
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
    this.app = new FirecrawlApp({ apiKey })
  }

  // Scrape a single URL
  async scrapeUrl(url: string, options?: {
    formats?: Array<'markdown' | 'html' | 'links' | 'screenshot'>
    onlyMainContent?: boolean
    includeTags?: string[]
    excludeTags?: string[]
    waitFor?: number
  }) {
    try {
      const result = await this.app.scrapeUrl(url, {
        formats: options?.formats || ['markdown', 'html'],
        onlyMainContent: options?.onlyMainContent ?? true,
        includeTags: options?.includeTags,
        excludeTags: options?.excludeTags,
        waitFor: options?.waitFor
      })

      return {
        success: true,
        data: result
      }
    } catch (error) {
      console.error('Error scraping URL:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Crawl an entire website
  async crawlWebsite(url: string, options?: {
    limit?: number
    scrapeOptions?: {
      formats?: Array<'markdown' | 'html' | 'links' | 'screenshot'>
      onlyMainContent?: boolean
    }
    allowedDomains?: string[]
    excludePaths?: string[]
    maxDepth?: number
  }) {
    try {
      const crawlJob = await this.app.crawlUrl(url, {
        limit: options?.limit || 10,
        scrapeOptions: options?.scrapeOptions,
        includePaths: options?.allowedDomains,
        excludePaths: options?.excludePaths,
        maxDepth: options?.maxDepth
      })

      // Wait for crawl to complete
      let status = crawlJob
      while ('status' in status && status.status === 'scraping') {
        await new Promise(resolve => setTimeout(resolve, 2000))
        if ('id' in status && status.id) {
          status = await this.app.checkCrawlStatus(status.id as string)
        } else {
          break
        }
      }

      // Type guard to ensure we have the expected properties
      if ('data' in status && 'total' in status) {
        return {
          success: true,
          data: status.data,
          total: status.total,
          completed: (status as any).completed || status.total
        }
      } else {
        return {
          success: false,
          error: 'Failed to get crawl status'
        }
      }
    } catch (error) {
      console.error('Error crawling website:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Map a website structure
  async mapWebsite(url: string, options?: {
    search?: string
    limit?: number
  }) {
    try {
      const result = await this.app.mapUrl(url, {
        search: options?.search,
        limit: options?.limit || 100
      })

      return {
        success: true,
        links: result
      }
    } catch (error) {
      console.error('Error mapping website:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Extract structured data using LLM
  async extractStructuredData(urls: string | string[], schema: any, prompt?: string) {
    try {
      const result = await this.app.extract(Array.isArray(urls) ? urls : [urls], {
        schema,
        prompt: prompt || 'Extract the following information from the webpage'
      })

      return {
        success: true,
        data: result
      }
    } catch (error) {
      console.error('Error extracting structured data:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Search within scraped content
  async searchContent(url: string, query: string, options?: {
    limit?: number
    scrapeOptions?: {
      formats?: Array<'markdown' | 'html'>
      onlyMainContent?: boolean
    }
  }) {
    try {
      const result = await this.app.search(query, {
        limit: options?.limit || 5,
        scrapeOptions: options?.scrapeOptions
      })

      return {
        success: true,
        results: Array.isArray(result) ? result : result.data || []
      }
    } catch (error) {
      console.error('Error searching content:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Recruiting-specific functions
  async scrapeLinkedInProfile(profileUrl: string) {
    const result = await this.scrapeUrl(profileUrl, {
      formats: ['markdown', 'html'],
      onlyMainContent: true
    })

    if (result.success && result.data) {
      // Extract structured profile data
      const profileData = await this.extractStructuredData(profileUrl, {
        name: 'string',
        currentPosition: 'string',
        currentCompany: 'string',
        location: 'string',
        summary: 'string',
        experience: [{
          title: 'string',
          company: 'string',
          duration: 'string',
          description: 'string'
        }],
        education: [{
          school: 'string',
          degree: 'string',
          field: 'string',
          dates: 'string'
        }],
        skills: ['string']
      }, 'Extract professional profile information')

      return profileData
    }

    return result
  }

  async scrapeCompanyInfo(companyUrl: string) {
    const result = await this.scrapeUrl(companyUrl, {
      formats: ['markdown', 'html'],
      onlyMainContent: true
    })

    if (result.success && result.data) {
      // Extract structured company data
      const companyData = await this.extractStructuredData(companyUrl, {
        companyName: 'string',
        industry: 'string',
        size: 'string',
        location: 'string',
        description: 'string',
        website: 'string',
        specialties: ['string'],
        recentNews: [{
          title: 'string',
          date: 'string',
          summary: 'string'
        }]
      }, 'Extract company information and recent updates')

      return companyData
    }

    return result
  }

  async findFinancialAdvisors(searchQuery: string, options?: {
    location?: string
    firm?: string
    specialty?: string
  }) {
    // Build search query
    let query = searchQuery
    if (options?.location) query += ` location:"${options.location}"`
    if (options?.firm) query += ` company:"${options.firm}"`
    if (options?.specialty) query += ` ${options.specialty}`

    // Search multiple sources
    const sources = [
      'site:linkedin.com/in/',
      'site:advisoryhq.com',
      'site:barrons.com/advisor',
      'site:fa-mag.com'
    ]

    const results = []
    for (const source of sources) {
      const searchResults = await this.searchContent(
        'https://www.google.com',
        `${query} ${source}`,
        { limit: 10 }
      )

      if (searchResults.success && Array.isArray(searchResults.results)) {
        results.push(...searchResults.results)
      }
    }

    // Extract structured advisor data from results
    const advisorProfiles = []
    for (const result of results) {
      if (result.url.includes('linkedin.com/in/')) {
        const profile = await this.scrapeLinkedInProfile(result.url)
        if (profile.success) {
          advisorProfiles.push(profile.data)
        }
      }
    }

    return {
      success: true,
      totalResults: results.length,
      advisors: advisorProfiles
    }
  }

  async monitorCompetitorActivity(competitorUrls: string[]) {
    const activities = []

    for (const url of competitorUrls) {
      // Scrape competitor website
      const result = await this.scrapeUrl(url, {
        formats: ['markdown', 'html'],
        onlyMainContent: true
      })

      if (result.success && result.data) {
        // Extract recent updates
        const updates = await this.extractStructuredData(url, {
          companyName: 'string',
          recentJobPostings: [{
            title: 'string',
            location: 'string',
            datePosted: 'string',
            description: 'string'
          }],
          newsAndUpdates: [{
            title: 'string',
            date: 'string',
            content: 'string'
          }],
          newHires: [{
            name: 'string',
            position: 'string',
            announcement: 'string'
          }]
        }, 'Extract recent company activities, job postings, and announcements')

        activities.push({
          url,
          ...updates.data
        })
      }
    }

    return {
      success: true,
      competitors: activities
    }
  }

  async researchIndustryTrends(topics: string[]) {
    const trends = []

    for (const topic of topics) {
      // Search for recent articles and reports
      const searchResults = await this.searchContent(
        'https://www.google.com',
        `"${topic}" "financial advisor" "recruiting" site:fa-mag.com OR site:wealthmanagement.com OR site:financial-planning.com after:${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`,
        { limit: 20 }
      )

      if (searchResults.success && searchResults.results) {
        for (const result of searchResults.results) {
          const article = await this.scrapeUrl(result.url, {
            formats: ['markdown'],
            onlyMainContent: true
          })

          if (article.success && article.data) {
            const analysis = await this.extractStructuredData(result.url, {
              title: 'string',
              date: 'string',
              keyPoints: ['string'],
              statistics: [{
                metric: 'string',
                value: 'string',
                context: 'string'
              }],
              implications: 'string',
              quotes: [{
                text: 'string',
                source: 'string'
              }]
            }, 'Extract key insights, statistics, and implications for financial advisor recruiting')

            trends.push({
              topic,
              source: result.url,
              ...analysis.data
            })
          }
        }
      }
    }

    return {
      success: true,
      trends: trends
    }
  }

  // Create a comprehensive research report
  async createCandidateResearchReport(candidateName: string, linkedinUrl?: string) {
    const report: any = {
      candidate: candidateName,
      timestamp: new Date().toISOString(),
      sources: []
    }

    // Search for candidate information
    const searchResults = await this.searchContent(
      'https://www.google.com',
      `"${candidateName}" financial advisor`,
      { limit: 20 }
    )

    if (searchResults.success && searchResults.results) {
      // Process each result
      for (const result of searchResults.results) {
        const scraped = await this.scrapeUrl(result.url, {
          formats: ['markdown'],
          onlyMainContent: true
        })

        if (scraped.success && scraped.data && 'markdown' in scraped.data) {
          report.sources.push({
            url: result.url,
            title: result.title,
            content: scraped.data.markdown
          })
        }
      }
    }

    // If LinkedIn URL provided, get detailed profile
    if (linkedinUrl) {
      const profile = await this.scrapeLinkedInProfile(linkedinUrl)
      if (profile.success) {
        report.linkedinProfile = profile.data
      }
    }

    // Extract structured insights
    if (report.sources.length > 0) {
      const insights = await this.extractStructuredData(
        report.sources.map((s: any) => s.url),
        {
          professionalSummary: 'string',
          careerHighlights: ['string'],
          expertise: ['string'],
          achievements: ['string'],
          educationSummary: 'string',
          potentialConcerns: ['string'],
          culturalFit: 'string',
          compensationExpectations: 'string'
        },
        `Analyze all sources and create a comprehensive profile for ${candidateName} as a financial advisor candidate`
      )

      report.analysis = insights.data
    }

    return report
  }
}