import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { RecruiterMetricsFilterSchema } from '@/types/recruiter';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get auth user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse search params
    const searchParams = request.nextUrl.searchParams;
    const filters = RecruiterMetricsFilterSchema.parse({
      recruiter_id: searchParams.get('recruiter_id') || undefined,
      period_type: searchParams.get('period_type') || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
      min_revenue: searchParams.get('min_revenue') ? parseFloat(searchParams.get('min_revenue')!) : undefined,
      min_placements: searchParams.get('min_placements') ? parseInt(searchParams.get('min_placements')!) : undefined,
    });

    // Build query
    let query = supabase
      .from('recruiter_metrics')
      .select(`
        *,
        recruiter:recruiters (
          id,
          full_name,
          email,
          company_name
        )
      `)
      .order('period_start', { ascending: false });

    // Apply filters
    if (filters.recruiter_id) {
      query = query.eq('recruiter_id', filters.recruiter_id);
    }
    
    if (filters.period_type) {
      query = query.eq('period_type', filters.period_type);
    }
    
    if (filters.start_date) {
      query = query.gte('period_start', filters.start_date);
    }
    
    if (filters.end_date) {
      query = query.lte('period_end', filters.end_date);
    }
    
    if (filters.min_revenue !== undefined) {
      query = query.gte('total_revenue', filters.min_revenue);
    }
    
    if (filters.min_placements !== undefined) {
      query = query.gte('placements_count', filters.min_placements);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching recruiter metrics:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate aggregated metrics if no specific recruiter is selected
    if (!filters.recruiter_id && data && data.length > 0) {
      const aggregatedMetrics = {
        total_revenue: data.reduce((sum, m) => sum + (m.total_revenue || 0), 0),
        total_placements: data.reduce((sum, m) => sum + (m.placements_count || 0), 0),
        avg_placement_fee: data.reduce((sum, m) => sum + (m.average_placement_fee || 0), 0) / data.length,
        avg_time_to_fill: data.reduce((sum, m) => sum + (m.time_to_fill_avg || 0), 0) / data.length,
        avg_candidate_quality: data.reduce((sum, m) => sum + (m.candidate_quality_score || 0), 0) / data.length,
        avg_client_satisfaction: data.reduce((sum, m) => sum + (m.client_satisfaction_score || 0), 0) / data.length,
      };

      return NextResponse.json({ data, aggregatedMetrics });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET /api/recruiters/metrics:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get auth user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can create metrics' }, { status: 403 });
    }

    const body = await request.json();
    const { recruiter_id, period_start, period_end, period_type } = body;

    // Calculate metrics from actual data
    const startDate = new Date(period_start);
    const endDate = new Date(period_end);

    // Get placement data
    const { data: placements } = await supabase
      .from('recruiter_candidates')
      .select('*')
      .eq('recruiter_id', recruiter_id)
      .eq('relationship_type', 'placed')
      .gte('placement_date', startDate.toISOString())
      .lte('placement_date', endDate.toISOString());

    // Get submission data
    const { data: submissions } = await supabase
      .from('recruiter_candidates')
      .select('*')
      .eq('recruiter_id', recruiter_id)
      .in('relationship_type', ['submitted', 'interviewing', 'offered', 'placed'])
      .gte('submission_date', startDate.toISOString())
      .lte('submission_date', endDate.toISOString());

    // Get interview data
    const { data: interviews } = await supabase
      .from('recruiter_candidates')
      .select('*')
      .eq('recruiter_id', recruiter_id)
      .in('relationship_type', ['interviewing', 'offered', 'placed'])
      .gte('submission_date', startDate.toISOString())
      .lte('submission_date', endDate.toISOString());

    // Get offer data
    const { data: offers } = await supabase
      .from('recruiter_candidates')
      .select('*')
      .eq('recruiter_id', recruiter_id)
      .in('relationship_type', ['offered', 'placed'])
      .gte('offer_date', startDate.toISOString())
      .lte('offer_date', endDate.toISOString());

    // Calculate metrics
    const metrics = {
      recruiter_id,
      period_start,
      period_end,
      period_type,
      placements_count: placements?.length || 0,
      candidates_submitted: submissions?.length || 0,
      interviews_scheduled: interviews?.length || 0,
      offers_extended: offers?.length || 0,
      offers_accepted: placements?.length || 0,
      total_revenue: placements?.reduce((sum, p) => sum + (p.placement_fee || 0), 0) || 0,
      average_placement_fee: placements?.length ? placements.reduce((sum, p) => sum + (p.placement_fee || 0), 0) / placements.length : null,
      highest_placement_fee: placements?.length ? Math.max(...placements.map(p => p.placement_fee || 0)) : null,
      submission_to_interview_ratio: submissions?.length ? (interviews?.length || 0) / submissions.length : null,
      interview_to_offer_ratio: interviews?.length ? (offers?.length || 0) / interviews.length : null,
      offer_acceptance_ratio: offers?.length ? (placements?.length || 0) / offers.length : null,
      candidate_quality_score: placements?.length ? placements.reduce((sum, p) => sum + (p.candidate_rating || 0), 0) / placements.length : null,
    };

    // Insert metrics
    const { data, error } = await supabase
      .from('recruiter_metrics')
      .insert(metrics)
      .select()
      .single();

    if (error) {
      console.error('Error creating metrics:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/recruiters/metrics:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}