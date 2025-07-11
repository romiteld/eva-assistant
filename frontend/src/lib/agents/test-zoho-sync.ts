import { EnhancedLeadGenerationAgent } from './enhanced-lead-generation';
import { LeadCriteria } from './enhanced-lead-generation';

// Example usage of the Zoho sync functionality
export async function testZohoSync() {
  // Initialize the agent with Zoho configuration
  const agent = new EnhancedLeadGenerationAgent(
    process.env.NEXT_PUBLIC_GEMINI_API_KEY!,
    process.env.FIRECRAWL_API_KEY!,
    {
      userId: 'user-id-from-auth', // This should come from your auth context
      encryptionKey: process.env.ENCRYPTION_KEY || 'default-encryption-key',
      webhookToken: process.env.ZOHO_WEBHOOK_TOKEN || 'your-zoho-webhook-token'
    }
  );

  // Example 1: Discover leads with automatic Zoho sync
  const criteria: LeadCriteria = {
    industry: 'Financial Services',
    location: 'New York',
    companySize: '51-200',
    revenueRange: '$10M-$50M',
    targetTitles: ['CEO', 'CFO', 'VP of Finance'],
    targetRoles: ['Financial Advisor', 'Wealth Manager'],
    keywords: ['wealth management', 'investment advisory']
  };

  try {
    console.log('Starting lead discovery with Zoho sync enabled...');
    
    // Discover leads and automatically sync to Zoho
    const leads = await agent.discoverLeads(criteria, true); // true enables Zoho sync
    
    console.log(`Discovered ${leads.length} qualified leads and synced to Zoho`);
    
    // Example 2: Manual sync with progress tracking
    console.log('\nManual sync with progress tracking:');
    
    const syncResult = await agent.syncLeadsToZohoWithProgress(
      leads,
      (current, total) => {
        console.log(`Progress: ${current}/${total} leads synced`);
      }
    );
    
    console.log(`Sync complete: ${syncResult.succeeded.length} succeeded, ${syncResult.failed.length} failed`);
    
    // Example 3: Sync existing leads from database
    console.log('\nSyncing existing leads from database:');
    
    const existingSync = await agent.syncExistingLeadsToZoho();
    console.log(`Synced ${existingSync.synced} existing leads, ${existingSync.failed} failed`);
    
    // Example 4: Single lead sync with retry
    if (leads.length > 0) {
      console.log('\nTesting single lead sync with retry:');
      
      try {
        const singleLead = await agent.syncLeadToZohoWithRetry(leads[0], 3);
        console.log('Single lead synced successfully:', singleLead);
      } catch (error) {
        console.error('Failed to sync single lead after retries:', error);
      }
    }
    
  } catch (error) {
    console.error('Lead generation/sync failed:', error);
  }
}

// Example: Search for competitors' employees
export async function searchCompetitorEmployees() {
  const agent = new EnhancedLeadGenerationAgent(
    process.env.NEXT_PUBLIC_GEMINI_API_KEY!,
    process.env.FIRECRAWL_API_KEY!,
    {
      encryptionKey: process.env.ENCRYPTION_KEY || 'default-encryption-key',  
      webhookToken: process.env.ZOHO_WEBHOOK_TOKEN || 'your-zoho-webhook-token',
      userId: 'user-id-from-auth'
    }
  );

  try {
    const leads = await agent.searchCompetitorEmployees(
      'Morgan Stanley',
      ['Financial Advisor', 'Wealth Manager', 'Portfolio Manager']
    );
    
    console.log(`Found ${leads.length} potential recruits from competitor`);
    
    // Sync to Zoho with custom handling
    for (const lead of leads) {
      try {
        await agent.syncLeadToZohoWithRetry(lead, 5); // More retries for important leads
      } catch (error) {
        console.error(`Failed to sync lead ${lead.company.name}:`, error);
      }
    }
  } catch (error) {
    console.error('Competitor search failed:', error);
  }
}

// Example: Find financial advisors with specific AUM
export async function findHighValueAdvisors() {
  const agent = new EnhancedLeadGenerationAgent(
    process.env.NEXT_PUBLIC_GEMINI_API_KEY!,
    process.env.FIRECRAWL_API_KEY!,
    {
      encryptionKey: process.env.ENCRYPTION_KEY || 'default-encryption-key',  
      webhookToken: process.env.ZOHO_WEBHOOK_TOKEN || 'your-zoho-webhook-token',
      userId: 'user-id-from-auth'
    }
  );

  try {
    const advisors = await agent.findFinancialAdvisors('California', '$1B');
    
    console.log(`Found ${advisors.length} high-value financial advisors`);
    
    // Sync only high-score leads
    const highScoreLeads = advisors.filter(lead => lead.score >= 80);
    
    if (highScoreLeads.length > 0) {
      console.log(`Syncing ${highScoreLeads.length} high-score leads to Zoho...`);
      await agent.syncLeadsToZoho(highScoreLeads);
    }
  } catch (error) {
    console.error('Advisor search failed:', error);
  }
}

// Usage in a React component or API route
export function useZohoSyncExample() {
  // In a real application, you would get the userId from your auth context
  const userId = 'authenticated-user-id';
  
  const runLeadGeneration = async () => {
    const agent = new EnhancedLeadGenerationAgent(
      process.env.NEXT_PUBLIC_GEMINI_API_KEY!,
      process.env.FIRECRAWL_API_KEY!,
      {
        encryptionKey: process.env.ENCRYPTION_KEY!,
        webhookToken: process.env.ZOHO_WEBHOOK_TOKEN!,
        userId
      }
    );

    const criteria: LeadCriteria = {
      industry: 'Technology',
      location: 'San Francisco Bay Area',
      companySize: '11-50',
      targetTitles: ['CTO', 'VP of Engineering', 'Head of Product'],
      keywords: ['AI', 'machine learning', 'fintech']
    };

    try {
      // Run lead generation with Zoho sync
      const leads = await agent.discoverLeads(criteria, true);
      
      return {
        success: true,
        leadsFound: leads.length,
        topLeads: leads.slice(0, 5) // Return top 5 leads
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };
  
  return { runLeadGeneration };
}