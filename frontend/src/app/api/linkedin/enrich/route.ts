import { NextRequest, NextResponse } from 'next/server';
import { withAuthAndRateLimit } from '@/middleware/api-security';
import { AuthenticatedRequest } from '@/middleware/auth';
import { createClient } from '@/lib/supabase/server';
import { createLinkedInService } from '@/lib/services/linkedin';

interface LeadEnrichmentRequest {
  leads: Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    company?: string;
    title?: string;
    publicIdentifier?: string;
  }>;
}

async function handlePost(request: AuthenticatedRequest) {
  try {
    const userId = request.user?.id;
    const body: LeadEnrichmentRequest = await request.json();
    const { leads } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ error: 'No leads provided for enrichment' }, { status: 400 });
    }

    // Get LinkedIn integration
    const supabase = createClient();
    const { data: integration, error: integrationError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'linkedin')
      .single();

    if (integrationError || !integration) {
      return NextResponse.json({ 
        error: 'LinkedIn integration not found' 
      }, { status: 404 });
    }

    // Check if token is expired
    const now = Date.now();
    if (integration.expires_at && integration.expires_at < now) {
      return NextResponse.json({ 
        error: 'LinkedIn token expired' 
      }, { status: 401 });
    }

    // Create LinkedIn service
    const linkedInService = createLinkedInService(
      userId,
      process.env.OAUTH_ENCRYPTION_KEY!,
      {
        linkedin: {
          tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
          clientId: process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID!,
          clientSecret: process.env.LINKEDIN_CLIENT_SECRET!
        }
      }
    );

    const enrichedLeads = [];
    const errors = [];

    // Process each lead
    for (const lead of leads) {
      try {
        let enrichedData = null;

        // Try different search strategies
        if (lead.publicIdentifier) {
          // Search by public identifier (vanity name)
          enrichedData = await linkedInService.getProfileByPublicIdentifier(lead.publicIdentifier);
        } else if (lead.firstName && lead.lastName) {
          // Search by name and company
          const searchResults = await linkedInService.searchPeople({
            firstName: lead.firstName,
            lastName: lead.lastName,
            company: lead.company,
            count: 5
          });

          if (searchResults.elements && searchResults.elements.length > 0) {
            enrichedData = searchResults.elements[0];
          }
        } else if (lead.email) {
          // Search by email (if available through company search)
          const searchResults = await linkedInService.searchPeople({
            keywords: lead.email,
            count: 5
          });

          if (searchResults.elements && searchResults.elements.length > 0) {
            enrichedData = searchResults.elements[0];
          }
        }

        if (enrichedData) {
          enrichedLeads.push({
            ...lead,
            linkedInData: enrichedData,
            enriched: true,
            enrichedAt: new Date().toISOString()
          });

          // Log successful enrichment
          await supabase
            .from('activity_logs')
            .insert({
              user_id: userId,
              action: 'linkedin_lead_enriched',
              metadata: {
                leadId: lead.id,
                leadName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
                leadEmail: lead.email,
                linkedInId: enrichedData.id,
                enrichmentMethod: lead.publicIdentifier ? 'publicIdentifier' : 'search',
                timestamp: new Date().toISOString(),
              },
            });
        } else {
          enrichedLeads.push({
            ...lead,
            enriched: false,
            error: 'No matching LinkedIn profile found'
          });
        }
      } catch (error) {
        console.error(`Error enriching lead ${lead.id}:`, error);
        enrichedLeads.push({
          ...lead,
          enriched: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        errors.push({
          leadId: lead.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Calculate enrichment statistics
    const totalLeads = leads.length;
    const enrichedCount = enrichedLeads.filter(lead => lead.enriched).length;
    const failedCount = totalLeads - enrichedCount;

    // Store enrichment results in database
    await supabase
      .from('lead_enrichment_results')
      .insert({
        user_id: userId,
        provider: 'linkedin',
        total_leads: totalLeads,
        enriched_count: enrichedCount,
        failed_count: failedCount,
        results: enrichedLeads,
        errors: errors,
        created_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      enrichedLeads,
      statistics: {
        totalLeads,
        enrichedCount,
        failedCount,
        enrichmentRate: `${((enrichedCount / totalLeads) * 100).toFixed(1)}%`
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('LinkedIn lead enrichment error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to enrich leads' },
      { status: 500 }
    );
  }
}

export const POST = withAuthAndRateLimit(handlePost, 'api');