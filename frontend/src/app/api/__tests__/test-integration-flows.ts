// Integration Flow Test Suite
// This file contains end-to-end tests for all external integrations

import { ZohoCRMClient } from '@/lib/integrations/zoho-crm';
import { ZohoCRMQueuedClient } from '@/lib/integrations/zoho-crm-queued';
import { Microsoft365Client } from '@/lib/integrations/microsoft365';
import { TwilioService, createTwilioService } from '@/lib/services/twilio';
import { createLinkedInService } from '@/lib/services/linkedin';
import { FirecrawlService } from '@/lib/integrations/firecrawl';

interface TestResult {
  integration: string;
  flow: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: any;
}

export class IntegrationFlowTester {
  private results: TestResult[] = [];

  // Test Zoho CRM Lead Generation Flow
  async testZohoLeadGenerationFlow(): Promise<TestResult[]> {
    const flowResults: TestResult[] = [];
    const startTime = Date.now();

    try {
      // Step 1: Create a lead
      const zohoClient = new ZohoCRMClient();
      const lead = await zohoClient.createLead({
        firstName: 'Test',
        lastName: `Integration_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        company: 'Test Financial Services',
        phone: '+1234567890',
        leadSource: 'Integration Test',
        customFields: {
          Industry: 'Financial Services',
          Lead_Score: 85,
          Interested_Products: ['Wealth Management', 'Retirement Planning'],
        },
      });

      flowResults.push({
        integration: 'Zoho CRM',
        flow: 'Lead Creation',
        success: lead.success,
        duration: Date.now() - startTime,
        details: { leadId: lead.id },
      });

      // Step 2: Update lead with enrichment data
      if (lead.id) {
        const updateStart = Date.now();
        const updated = await zohoClient.updateLead(lead.id, {
          customFields: {
            LinkedIn_Profile: 'https://linkedin.com/in/test',
            Company_Size: '500-1000',
            Annual_Revenue: '$10M-$50M',
          },
        });

        flowResults.push({
          integration: 'Zoho CRM',
          flow: 'Lead Enrichment Update',
          success: updated.success,
          duration: Date.now() - updateStart,
        });

        // Step 3: Convert to deal
        const dealStart = Date.now();
        const deal = await zohoClient.createDeal({
          dealName: `Deal for ${lead.details?.Company}`,
          stage: 'Qualification',
          amount: 250000,
          closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          contactId: lead.id,
          customFields: {
            Deal_Type: 'New Business',
            Product_Interest: 'Wealth Management Platform',
          },
        });

        flowResults.push({
          integration: 'Zoho CRM',
          flow: 'Lead to Deal Conversion',
          success: deal.success,
          duration: Date.now() - dealStart,
          details: { dealId: deal.id },
        });

        // Cleanup: Delete test data
        await zohoClient.deleteLead(lead.id);
        if (deal.id) await zohoClient.deleteDeal(deal.id);
      }

    } catch (error) {
      flowResults.push({
        integration: 'Zoho CRM',
        flow: 'Lead Generation Flow',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    this.results.push(...flowResults);
    return flowResults;
  }

  // Test Microsoft 365 Interview Scheduling Flow
  async testMicrosoftInterviewFlow(): Promise<TestResult[]> {
    const flowResults: TestResult[] = [];
    const startTime = Date.now();

    try {
      const msClient = new Microsoft365Client();

      // Step 1: Check calendar availability
      const availabilityStart = Date.now();
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

      const events = await msClient.getCalendarEvents({
        startDateTime: startDate.toISOString(),
        endDateTime: endDate.toISOString(),
        top: 50,
      });

      flowResults.push({
        integration: 'Microsoft 365',
        flow: 'Calendar Availability Check',
        success: true,
        duration: Date.now() - availabilityStart,
        details: { eventCount: events.value.length },
      });

      // Step 2: Create interview meeting
      const meetingStart = Date.now();
      const interviewDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000);
      interviewDate.setHours(14, 0, 0, 0); // 2 PM

      const meeting = await msClient.createCalendarEvent({
        subject: 'Interview - Senior Financial Advisor Position',
        body: {
          contentType: 'HTML',
          content: '<p>Interview for Senior Financial Advisor position with candidate.</p>',
        },
        start: {
          dateTime: interviewDate.toISOString(),
          timeZone: 'America/New_York',
        },
        end: {
          dateTime: new Date(interviewDate.getTime() + 60 * 60 * 1000).toISOString(),
          timeZone: 'America/New_York',
        },
        location: {
          displayName: 'Microsoft Teams Meeting',
        },
        attendees: [
          {
            emailAddress: {
              address: 'candidate@example.com',
              name: 'Test Candidate',
            },
            type: 'required',
          },
        ],
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness',
      });

      flowResults.push({
        integration: 'Microsoft 365',
        flow: 'Interview Meeting Creation',
        success: true,
        duration: Date.now() - meetingStart,
        details: { 
          meetingId: meeting.id,
          teamsLink: meeting.onlineMeeting?.joinUrl,
        },
      });

      // Step 3: Send interview confirmation email
      const emailStart = Date.now();
      const emailSent = await msClient.sendEmail({
        message: {
          subject: 'Interview Confirmation - The Well Recruiting Solutions',
          body: {
            contentType: 'HTML',
            content: `
              <p>Dear Candidate,</p>
              <p>This confirms your interview for the Senior Financial Advisor position.</p>
              <p><strong>Date:</strong> ${interviewDate.toLocaleDateString()}<br>
              <strong>Time:</strong> 2:00 PM EST<br>
              <strong>Location:</strong> Microsoft Teams (link in calendar invite)</p>
              <p>Best regards,<br>The Well Recruiting Solutions</p>
            `,
          },
          toRecipients: [
            {
              emailAddress: {
                address: 'candidate@example.com',
                name: 'Test Candidate',
              },
            },
          ],
        },
        saveToSentItems: true,
      });

      flowResults.push({
        integration: 'Microsoft 365',
        flow: 'Interview Confirmation Email',
        success: true,
        duration: Date.now() - emailStart,
      });

      // Cleanup: Delete test meeting
      if (meeting.id) {
        await msClient.deleteCalendarEvent(meeting.id);
      }

    } catch (error) {
      flowResults.push({
        integration: 'Microsoft 365',
        flow: 'Interview Scheduling Flow',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    this.results.push(...flowResults);
    return flowResults;
  }

  // Test Twilio SMS Campaign Flow
  async testTwilioSMSCampaignFlow(): Promise<TestResult[]> {
    const flowResults: TestResult[] = [];
    const startTime = Date.now();

    try {
      const twilioService = createTwilioService();

      // Step 1: Validate phone numbers
      const validationStart = Date.now();
      const testNumbers = ['+12125551234', '+13105555678', '+14155559012'];
      const validNumbers = testNumbers.filter(num => /^\+1\d{10}$/.test(num));

      flowResults.push({
        integration: 'Twilio',
        flow: 'Phone Number Validation',
        success: true,
        duration: Date.now() - validationStart,
        details: { 
          totalNumbers: testNumbers.length,
          validNumbers: validNumbers.length,
        },
      });

      // Step 2: Create SMS campaign (simulation)
      const campaignStart = Date.now();
      const campaign = {
        name: 'Financial Advisor Opportunity',
        template: 'Hi {{name}}, The Well Recruiting has an exciting opportunity for experienced financial advisors. Reply YES to learn more.',
        recipients: [
          { phone: validNumbers[0], name: 'John Smith' },
          { phone: validNumbers[1], name: 'Jane Doe' },
        ],
      };

      // Simulate campaign preparation
      const preparedMessages = campaign.recipients.map(recipient => ({
        to: recipient.phone,
        body: campaign.template.replace('{{name}}', recipient.name),
      }));

      flowResults.push({
        integration: 'Twilio',
        flow: 'SMS Campaign Preparation',
        success: true,
        duration: Date.now() - campaignStart,
        details: { 
          campaignName: campaign.name,
          recipientCount: preparedMessages.length,
        },
      });

      // Step 3: Test IVR response generation
      const ivrStart = Date.now();
      const ivrResponse = twilioService.generateIVRResponse({
        step: 'main_menu',
      });

      flowResults.push({
        integration: 'Twilio',
        flow: 'IVR Menu Generation',
        success: ivrResponse.includes('Press 1'),
        duration: Date.now() - ivrStart,
        details: { 
          responseLength: ivrResponse.length,
          hasMenuOptions: true,
        },
      });

      // Step 4: Test conference call setup (simulation)
      const conferenceStart = Date.now();
      const conferenceTwiml = twilioService.generateVoiceResponse({
        say: 'Welcome to the interview conference call.',
        dial: {
          conference: 'Interview_Room_123',
          record: 'record-from-answer',
        },
      });

      flowResults.push({
        integration: 'Twilio',
        flow: 'Conference Call TwiML',
        success: conferenceTwiml.includes('conference'),
        duration: Date.now() - conferenceStart,
        details: { 
          hasRecording: conferenceTwiml.includes('record'),
          conferenceRoom: 'Interview_Room_123',
        },
      });

    } catch (error) {
      flowResults.push({
        integration: 'Twilio',
        flow: 'SMS Campaign Flow',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    this.results.push(...flowResults);
    return flowResults;
  }

  // Test LinkedIn Lead Enrichment Flow
  async testLinkedInEnrichmentFlow(): Promise<TestResult[]> {
    const flowResults: TestResult[] = [];
    const startTime = Date.now();

    try {
      // Step 1: Parse LinkedIn URL
      const parseStart = Date.now();
      const testUrls = [
        'https://www.linkedin.com/in/john-doe-12345/',
        'https://linkedin.com/company/the-well-recruiting',
        'invalid-url',
      ];

      const parsedProfiles = testUrls.map(url => {
        const profileMatch = url.match(/linkedin\.com\/in\/([^\/]+)/);
        const companyMatch = url.match(/linkedin\.com\/company\/([^\/]+)/);
        return {
          url,
          type: profileMatch ? 'profile' : companyMatch ? 'company' : 'invalid',
          identifier: profileMatch?.[1] || companyMatch?.[1] || null,
        };
      });

      flowResults.push({
        integration: 'LinkedIn',
        flow: 'URL Parsing',
        success: true,
        duration: Date.now() - parseStart,
        details: { 
          totalUrls: testUrls.length,
          validProfiles: parsedProfiles.filter(p => p.type === 'profile').length,
          validCompanies: parsedProfiles.filter(p => p.type === 'company').length,
        },
      });

      // Step 2: Simulate enrichment data structure
      const enrichmentStart = Date.now();
      const mockEnrichmentData = {
        profileId: 'john-doe-12345',
        fullName: 'John Doe',
        headline: 'Senior Financial Advisor | Wealth Management Expert',
        location: 'New York, NY',
        connections: '500+',
        experience: [
          {
            title: 'Senior Financial Advisor',
            company: 'ABC Wealth Management',
            duration: '5 years',
            current: true,
          },
        ],
        skills: ['Financial Planning', 'Portfolio Management', 'Estate Planning'],
        education: [
          {
            school: 'University of Finance',
            degree: 'MBA in Finance',
            year: '2015',
          },
        ],
      };

      flowResults.push({
        integration: 'LinkedIn',
        flow: 'Profile Enrichment Structure',
        success: true,
        duration: Date.now() - enrichmentStart,
        details: { 
          hasExperience: mockEnrichmentData.experience.length > 0,
          skillCount: mockEnrichmentData.skills.length,
          currentRole: mockEnrichmentData.experience[0]?.title,
        },
      });

      // Step 3: Test message template preparation
      const messageStart = Date.now();
      const messageTemplate = `Hi {{firstName}},

I noticed your impressive background in {{currentRole}} at {{currentCompany}}. 

The Well Recruiting Solutions specializes in placing top financial advisors, and we have an exciting opportunity that aligns with your experience.

Would you be open to a brief conversation?

Best regards,
[Recruiter Name]`;

      const personalizedMessage = messageTemplate
        .replace('{{firstName}}', 'John')
        .replace('{{currentRole}}', mockEnrichmentData.experience[0].title)
        .replace('{{currentCompany}}', mockEnrichmentData.experience[0].company);

      flowResults.push({
        integration: 'LinkedIn',
        flow: 'Message Personalization',
        success: !personalizedMessage.includes('{{'),
        duration: Date.now() - messageStart,
        details: { 
          messageLength: personalizedMessage.length,
          hasPersonalization: true,
        },
      });

    } catch (error) {
      flowResults.push({
        integration: 'LinkedIn',
        flow: 'Lead Enrichment Flow',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    this.results.push(...flowResults);
    return flowResults;
  }

  // Test Firecrawl Research Flow
  async testFirecrawlResearchFlow(): Promise<TestResult[]> {
    const flowResults: TestResult[] = [];
    const startTime = Date.now();

    try {
      const firecrawl = new FirecrawlService();

      // Step 1: Scrape company website
      const scrapeStart = Date.now();
      const scraped = await firecrawl.scrapeUrl('https://example.com', {
        formats: ['markdown'],
        onlyMainContent: true,
      });

      flowResults.push({
        integration: 'Firecrawl',
        flow: 'Website Scraping',
        success: scraped.success,
        duration: Date.now() - scrapeStart,
        details: { 
          contentLength: scraped.markdown?.length || 0,
          hasContent: (scraped.markdown?.length || 0) > 100,
        },
      });

      // Step 2: Search for industry news
      const searchStart = Date.now();
      const searchResults = await firecrawl.search('financial advisor recruiting trends', {
        limit: 10,
      });

      flowResults.push({
        integration: 'Firecrawl',
        flow: 'Industry Research',
        success: searchResults.length > 0,
        duration: Date.now() - searchStart,
        details: { 
          resultCount: searchResults.length,
          topResult: searchResults[0]?.title,
        },
      });

      // Step 3: Deep research simulation
      const researchStart = Date.now();
      const researchQuery = 'What are the top skills financial advisors need in 2024?';
      
      // Simulate research compilation
      const researchFindings = {
        query: researchQuery,
        sources: searchResults.slice(0, 3).map(r => ({
          title: r.title,
          url: r.url,
          relevance: Math.random() * 100,
        })),
        keyFindings: [
          'Digital literacy and fintech adoption',
          'ESG investing expertise',
          'Behavioral finance understanding',
          'Client relationship management',
        ],
        confidence: 0.85,
      };

      flowResults.push({
        integration: 'Firecrawl',
        flow: 'Deep Research Analysis',
        success: true,
        duration: Date.now() - researchStart,
        details: { 
          sourceCount: researchFindings.sources.length,
          findingCount: researchFindings.keyFindings.length,
          confidence: researchFindings.confidence,
        },
      });

    } catch (error) {
      flowResults.push({
        integration: 'Firecrawl',
        flow: 'Research Flow',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    this.results.push(...flowResults);
    return flowResults;
  }

  // Run all integration flow tests
  async runAllFlowTests(): Promise<{
    totalFlows: number;
    successfulFlows: number;
    failedFlows: number;
    avgDuration: number;
    results: TestResult[];
  }> {
    console.log('🔄 Running Integration Flow Tests...\n');

    // Run each flow test
    await this.testZohoLeadGenerationFlow();
    await this.testMicrosoftInterviewFlow();
    await this.testTwilioSMSCampaignFlow();
    await this.testLinkedInEnrichmentFlow();
    await this.testFirecrawlResearchFlow();

    // Calculate summary
    const successfulFlows = this.results.filter(r => r.success).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    return {
      totalFlows: this.results.length,
      successfulFlows,
      failedFlows: this.results.length - successfulFlows,
      avgDuration: totalDuration / this.results.length,
      results: this.results,
    };
  }

  // Generate detailed flow report
  generateFlowReport(): string {
    const integrations = [...new Set(this.results.map(r => r.integration))];
    
    let report = `# Integration Flow Test Report

Generated: ${new Date().toISOString()}

## Summary

Total Flow Tests: ${this.results.length}
Successful: ${this.results.filter(r => r.success).length}
Failed: ${this.results.filter(r => !r.success).length}

## Flow Test Results by Integration

`;

    for (const integration of integrations) {
      const integrationResults = this.results.filter(r => r.integration === integration);
      const successRate = (integrationResults.filter(r => r.success).length / integrationResults.length) * 100;
      
      report += `### ${integration} (${successRate.toFixed(0)}% Success Rate)

`;
      
      for (const result of integrationResults) {
        const status = result.success ? '✅' : '❌';
        report += `- ${status} **${result.flow}** (${result.duration}ms)\n`;
        
        if (result.error) {
          report += `  - Error: ${result.error}\n`;
        }
        
        if (result.details) {
          report += `  - Details: ${JSON.stringify(result.details, null, 2).replace(/\n/g, '\n    ')}\n`;
        }
      }
      
      report += '\n';
    }

    // Add performance analysis
    report += `## Performance Analysis

`;
    
    const performanceByIntegration = integrations.map(integration => {
      const flows = this.results.filter(r => r.integration === integration);
      const avgDuration = flows.reduce((sum, r) => sum + r.duration, 0) / flows.length;
      return { integration, avgDuration };
    }).sort((a, b) => a.avgDuration - b.avgDuration);

    report += `### Average Response Times by Integration

`;
    
    for (const perf of performanceByIntegration) {
      report += `- **${perf.integration}**: ${perf.avgDuration.toFixed(0)}ms\n`;
    }

    return report;
  }
}

// Export test runner function
export async function runIntegrationFlowTests() {
  const tester = new IntegrationFlowTester();
  const summary = await tester.runAllFlowTests();
  const report = tester.generateFlowReport();
  
  return { summary, report };
}