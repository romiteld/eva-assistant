import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { RecruiterFormSchema, RecruiterSearchSchema } from '@/types/recruiter';
import { z } from 'zod';

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
    const filters = RecruiterSearchSchema.parse({
      query: searchParams.get('query') || undefined,
      company_type: searchParams.get('company_type') || undefined,
      performance_tier: searchParams.get('performance_tier') || undefined,
      specializations: searchParams.get('specializations')?.split(',').filter(Boolean),
      industry_focus: searchParams.get('industry_focus')?.split(',').filter(Boolean),
      is_active: searchParams.get('is_active') ? searchParams.get('is_active') === 'true' : undefined,
      min_experience_years: searchParams.get('min_experience_years') ? parseInt(searchParams.get('min_experience_years')!) : undefined,
      max_experience_years: searchParams.get('max_experience_years') ? parseInt(searchParams.get('max_experience_years')!) : undefined,
    });

    // Build query
    let query = supabase
      .from('recruiters')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.query) {
      query = query.or(`full_name.ilike.%${filters.query}%,email.ilike.%${filters.query}%,company_name.ilike.%${filters.query}%`);
    }
    
    if (filters.company_type) {
      query = query.eq('company_type', filters.company_type);
    }
    
    if (filters.performance_tier) {
      query = query.eq('performance_tier', filters.performance_tier);
    }
    
    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }
    
    if (filters.min_experience_years !== undefined) {
      query = query.gte('experience_years', filters.min_experience_years);
    }
    
    if (filters.max_experience_years !== undefined) {
      query = query.lte('experience_years', filters.max_experience_years);
    }
    
    if (filters.specializations && filters.specializations.length > 0) {
      query = query.contains('specializations', filters.specializations);
    }
    
    if (filters.industry_focus && filters.industry_focus.length > 0) {
      query = query.contains('industry_focus', filters.industry_focus);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching recruiters:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET /api/recruiters:', error);
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

    // Parse and validate request body
    const body = await request.json();
    const validatedData = RecruiterFormSchema.parse(body);

    // Check if user is creating their own profile or is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (validatedData.user_id && validatedData.user_id !== user.id && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized to create recruiter for another user' }, { status: 403 });
    }

    // Set user_id if not provided
    if (!validatedData.user_id) {
      validatedData.user_id = user.id;
    }

    // Insert recruiter
    const { data, error } = await supabase
      .from('recruiters')
      .insert(validatedData)
      .select()
      .single();

    if (error) {
      console.error('Error creating recruiter:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/recruiters:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}