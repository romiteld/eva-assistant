import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Validation schemas
const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().optional(),
  priority: z.number().min(0).max(10).default(0),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
  due_date: z.string().datetime().optional(),
  assigned_agent: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  estimated_hours: z.number().positive().optional(),
  parent_task_id: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.any()).default({}),
});

const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  id: z.string().uuid(),
  completion_percentage: z.number().min(0).max(100).optional(),
  actual_hours: z.number().positive().optional(),
  completed_at: z.string().datetime().optional(),
  cancelled_at: z.string().datetime().optional(),
  started_at: z.string().datetime().optional(),
});

const QuerySchema = z.object({
  page: z.string().transform(val => parseInt(val) || 1),
  limit: z.string().transform(val => Math.min(parseInt(val) || 20, 100)),
  status: z.string().optional(),
  category: z.string().optional(),
  priority_min: z.string().transform(val => parseInt(val)).optional(),
  priority_max: z.string().transform(val => parseInt(val)).optional(),
  due_before: z.string().datetime().optional(),
  due_after: z.string().datetime().optional(),
  search: z.string().optional(),
  tags: z.string().optional(), // comma-separated tags
  assigned_agent: z.string().optional(),
  parent_task_id: z.string().uuid().optional(),
  sort_by: z.enum(['created_at', 'updated_at', 'due_date', 'priority', 'title']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

// GET /api/tasks - List tasks with filtering, sorting, and pagination
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const {
      page,
      limit,
      status,
      category,
      priority_min,
      priority_max,
      due_before,
      due_after,
      search,
      tags,
      assigned_agent,
      parent_task_id,
      sort_by,
      sort_order
    } = QuerySchema.parse(queryParams);

    // Build query
    let query = supabase
      .from('task_details')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    
    if (category) {
      query = query.eq('category', category);
    }
    
    if (priority_min !== undefined) {
      query = query.gte('priority', priority_min);
    }
    
    if (priority_max !== undefined) {
      query = query.lte('priority', priority_max);
    }
    
    if (due_before) {
      query = query.lte('due_date', due_before);
    }
    
    if (due_after) {
      query = query.gte('due_date', due_after);
    }
    
    if (assigned_agent) {
      query = query.eq('assigned_agent', assigned_agent);
    }
    
    if (parent_task_id) {
      query = query.eq('parent_task_id', parent_task_id);
    } else {
      // By default, only show top-level tasks unless specifically querying subtasks
      query = query.is('parent_task_id', null);
    }
    
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query = query.overlaps('tags', tagArray);
    }

    // Apply sorting
    const sortColumn = sort_by === 'title' ? 'title' : sort_by;
    query = query.order(sortColumn, { ascending: sort_order === 'asc' });

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: tasks, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('deleted_at', null);

    return NextResponse.json({
      tasks,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        pages: Math.ceil((totalCount || 0) / limit)
      }
    });

  } catch (error) {
    console.error('GET /api/tasks error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const taskData = CreateTaskSchema.parse(body);

    // Add user_id and timestamps
    const newTask = {
      ...taskData,
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Insert task
    const { data: task, error } = await supabase
      .from('tasks')
      .insert(newTask)
      .select('*')
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }

    return NextResponse.json({ task }, { status: 201 });

  } catch (error) {
    console.error('POST /api/tasks error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/tasks - Update an existing task
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const { id, ...updates } = UpdateTaskSchema.parse(body);

    // Auto-set completed_at when status changes to completed
    if (updates.status === 'completed' && !updates.completed_at) {
      updates.completed_at = new Date().toISOString();
      updates.completion_percentage = 100;
    } else if (updates.status === 'cancelled' && !updates.cancelled_at) {
      updates.cancelled_at = new Date().toISOString();
    } else if (updates.status === 'in_progress' && !updates.started_at) {
      updates.started_at = new Date().toISOString();
    }

    // Update task
    const { data: task, error } = await supabase
      .from('tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ task });

  } catch (error) {
    console.error('PUT /api/tasks error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/tasks - Soft delete a task
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get task ID from query params
    const url = new URL(request.url);
    const taskId = url.searchParams.get('id');

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    // Soft delete the task
    const { data: task, error } = await supabase
      .from('tasks')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Task deleted successfully' });

  } catch (error) {
    console.error('DELETE /api/tasks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}