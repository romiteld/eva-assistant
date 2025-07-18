import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Validation schemas
const CreateCommentSchema = z.object({
  content: z.string().min(1, 'Content is required').max(2000, 'Content too long'),
  is_internal: z.boolean().default(false),
});

const UpdateCommentSchema = z.object({
  content: z.string().min(1, 'Content is required').max(2000, 'Content too long'),
  is_internal: z.boolean().optional(),
});

interface RouteParams {
  params: {
    taskId: string;
  };
}

// GET /api/tasks/[taskId]/comments - Get all comments for a task
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = params;

    // Verify task ownership
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id')
      .eq('id', taskId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Get comments with user information
    const { data: comments, error } = await supabase
      .from('task_comments')
      .select(`
        *,
        users:user_id (
          email,
          full_name
        )
      `)
      .eq('task_id', taskId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }

    return NextResponse.json({ comments });

  } catch (error) {
    console.error('GET /api/tasks/[taskId]/comments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/tasks/[taskId]/comments - Create a new comment
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = params;

    // Verify task ownership
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id')
      .eq('id', taskId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const commentData = CreateCommentSchema.parse(body);

    // Create comment
    const { data: comment, error } = await supabase
      .from('task_comments')
      .insert({
        ...commentData,
        task_id: taskId,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(`
        *,
        users:user_id (
          email,
          full_name
        )
      `)
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
    }

    return NextResponse.json({ comment }, { status: 201 });

  } catch (error) {
    console.error('POST /api/tasks/[taskId]/comments error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/tasks/[taskId]/comments - Update a comment
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = params;
    
    // Get comment ID from query params
    const url = new URL(request.url);
    const commentId = url.searchParams.get('commentId');

    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });
    }

    // Parse and validate request body
    const body = await request.json();
    const updates = UpdateCommentSchema.parse(body);

    // Update comment (user can only update their own comments)
    const { data: comment, error } = await supabase
      .from('task_comments')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', commentId)
      .eq('task_id', taskId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .select(`
        *,
        users:user_id (
          email,
          full_name
        )
      `)
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
    }

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    return NextResponse.json({ comment });

  } catch (error) {
    console.error('PUT /api/tasks/[taskId]/comments error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/tasks/[taskId]/comments - Soft delete a comment
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = params;
    
    // Get comment ID from query params
    const url = new URL(request.url);
    const commentId = url.searchParams.get('commentId');

    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });
    }

    // Soft delete comment (user can only delete their own comments)
    const { data: comment, error } = await supabase
      .from('task_comments')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', commentId)
      .eq('task_id', taskId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .select('*')
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
    }

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Comment deleted successfully' });

  } catch (error) {
    console.error('DELETE /api/tasks/[taskId]/comments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}