import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { RecruiterFormSchema } from '@/types/recruiter';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get auth user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('recruiters')
      .select(`
        *,
        recruiter_metrics (
          *
        ),
        recruiter_candidates (
          *,
          candidate:candidates (
            id,
            name,
            email
          ),
          job:job_postings (
            id,
            title,
            company
          )
        ),
        recruiter_activities (
          *
        )
      `)
      .eq('id', params.id)
      .single();

    if (error) {
      console.error('Error fetching recruiter:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Recruiter not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET /api/recruiters/[id]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get auth user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user owns this recruiter profile or is admin
    const { data: recruiter } = await supabase
      .from('recruiters')
      .select('user_id')
      .eq('id', params.id)
      .single();

    if (!recruiter) {
      return NextResponse.json({ error: 'Recruiter not found' }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (recruiter.user_id !== user.id && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized to update this recruiter' }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = RecruiterFormSchema.partial().parse(body);

    // Update recruiter
    const { data, error } = await supabase
      .from('recruiters')
      .update(validatedData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating recruiter:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in PATCH /api/recruiters/[id]:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      return NextResponse.json({ error: 'Only admins can delete recruiters' }, { status: 403 });
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('recruiters')
      .update({ is_active: false })
      .eq('id', params.id);

    if (error) {
      console.error('Error deleting recruiter:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Recruiter deactivated successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/recruiters/[id]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}