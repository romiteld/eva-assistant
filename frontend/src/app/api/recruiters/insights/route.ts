import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get auth user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const recruiter_id = searchParams.get('recruiter_id');
    const period = searchParams.get('period') || '90'; // days

    // Get recruiter data
    const { data: recruiter } = await supabase
      .from('recruiters')
      .select('*')
      .eq('id', recruiter_id)
      .single();

    if (!recruiter) {
      return NextResponse.json({ error: 'Recruiter not found' }, { status: 404 });
    }

    // Get recent metrics
    const periodDate = new Date();
    periodDate.setDate(periodDate.getDate() - parseInt(period));

    const { data: metrics } = await supabase
      .from('recruiter_metrics')
      .select('*')
      .eq('recruiter_id', recruiter_id)
      .gte('period_start', periodDate.toISOString())
      .order('period_start', { ascending: false });

    // Get recent activities
    const { data: activities } = await supabase
      .from('recruiter_activities')
      .select('*')
      .eq('recruiter_id', recruiter_id)
      .gte('activity_date', periodDate.toISOString())
      .order('activity_date', { ascending: false })
      .limit(100);

    // Get recent placements
    const { data: placements } = await supabase
      .from('recruiter_candidates')
      .select(`
        *,
        candidate:candidates (
          id,
          name,
          skills,
          experience_years
        ),
        job:job_postings (
          id,
          title,
          company,
          salary_range
        )
      `)
      .eq('recruiter_id', recruiter_id)
      .eq('relationship_type', 'placed')
      .gte('placement_date', periodDate.toISOString());

    // Get pipeline data
    const { data: pipeline } = await supabase
      .from('recruiter_candidates')
      .select('relationship_type, status')
      .eq('recruiter_id', recruiter_id)
      .eq('status', 'active');

    // Prepare data for AI analysis
    const analysisData = {
      recruiter: {
        name: recruiter.full_name,
        company: recruiter.company_name,
        specializations: recruiter.specializations,
        experience_years: recruiter.experience_years,
        performance_tier: recruiter.performance_tier
      },
      metrics: metrics || [],
      recent_placements: placements || [],
      pipeline_summary: {
        sourced: pipeline?.filter(p => p.relationship_type === 'sourced').length || 0,
        submitted: pipeline?.filter(p => p.relationship_type === 'submitted').length || 0,
        interviewing: pipeline?.filter(p => p.relationship_type === 'interviewing').length || 0,
        offered: pipeline?.filter(p => p.relationship_type === 'offered').length || 0,
      },
      activity_summary: {
        total_activities: activities?.length || 0,
        calls: activities?.filter(a => a.activity_type === 'call').length || 0,
        emails: activities?.filter(a => a.activity_type === 'email').length || 0,
        meetings: activities?.filter(a => a.activity_type === 'meeting').length || 0,
      }
    };

    // Generate AI insights
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `
    As a recruitment analytics expert, analyze the following recruiter's performance data and provide actionable insights:

    ${JSON.stringify(analysisData, null, 2)}

    Please provide:
    1. Performance Summary - Overall assessment of the recruiter's performance
    2. Strengths - What this recruiter is doing well
    3. Areas for Improvement - Specific areas where performance could be enhanced
    4. Action Items - Concrete steps to improve performance
    5. Market Opportunities - Based on their specializations and current market trends
    6. Efficiency Metrics - Analysis of their conversion rates and time-to-fill
    7. Recommendations - Strategic recommendations for the next quarter

    Format your response in a structured JSON format with these sections.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse AI response
    let insights;
    try {
      // Extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
      } else {
        insights = {
          performance_summary: text,
          recommendations: ['Unable to parse structured insights']
        };
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      insights = {
        performance_summary: text,
        recommendations: ['Unable to parse structured insights']
      };
    }

    // Calculate additional insights
    const additionalInsights = {
      avg_time_to_placement: calculateAvgTimeToPlacement(placements || []),
      placement_success_rate: calculatePlacementSuccessRate(pipeline || [], placements || []),
      revenue_trend: calculateRevenueTrend(metrics || []),
      activity_effectiveness: calculateActivityEffectiveness(activities || [], placements || []),
    };

    return NextResponse.json({
      data: {
        recruiter_id,
        period_analyzed: period,
        ai_insights: insights,
        metrics_summary: additionalInsights,
        raw_data: {
          metrics_count: metrics?.length || 0,
          placements_count: placements?.length || 0,
          active_pipeline_count: pipeline?.length || 0,
          activities_count: activities?.length || 0,
        }
      }
    });
  } catch (error) {
    console.error('Error in GET /api/recruiters/insights:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions
function calculateAvgTimeToPlacement(placements: any[]): number | null {
  if (!placements || placements.length === 0) return null;
  
  const validPlacements = placements.filter(p => p.first_contact_date && p.placement_date);
  if (validPlacements.length === 0) return null;
  
  const totalDays = validPlacements.reduce((sum, p) => {
    const firstContact = new Date(p.first_contact_date);
    const placement = new Date(p.placement_date);
    const days = Math.floor((placement.getTime() - firstContact.getTime()) / (1000 * 60 * 60 * 24));
    return sum + days;
  }, 0);
  
  return Math.round(totalDays / validPlacements.length);
}

function calculatePlacementSuccessRate(pipeline: any[], placements: any[]): number {
  const totalSubmitted = (pipeline?.length || 0) + (placements?.length || 0);
  if (totalSubmitted === 0) return 0;
  
  return Math.round((placements?.length || 0) / totalSubmitted * 100);
}

function calculateRevenueTrend(metrics: any[]): string {
  if (!metrics || metrics.length < 2) return 'insufficient_data';
  
  const sortedMetrics = [...metrics].sort((a, b) => 
    new Date(a.period_start).getTime() - new Date(b.period_start).getTime()
  );
  
  const recentRevenue = sortedMetrics.slice(-3).reduce((sum, m) => sum + (m.total_revenue || 0), 0);
  const previousRevenue = sortedMetrics.slice(-6, -3).reduce((sum, m) => sum + (m.total_revenue || 0), 0);
  
  if (previousRevenue === 0) return 'new_recruiter';
  
  const change = ((recentRevenue - previousRevenue) / previousRevenue) * 100;
  
  if (change > 10) return 'increasing';
  if (change < -10) return 'decreasing';
  return 'stable';
}

function calculateActivityEffectiveness(activities: any[], placements: any[]): number {
  if (!activities || activities.length === 0) return 0;
  
  const placementActivities = activities.filter(a => 
    a.activity_type === 'submission' || 
    a.activity_type === 'interview_scheduled' || 
    a.activity_type === 'placement'
  );
  
  return Math.round((placementActivities.length / activities.length) * 100);
}