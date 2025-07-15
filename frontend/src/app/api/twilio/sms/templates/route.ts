import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    
    let query = supabase
      .from('sms_templates')
      .select('*')
      .eq('is_active', true)
      .order('usage_count', { ascending: false })
    
    if (category) {
      query = query.eq('category', category)
    }
    
    const { data: templates, error } = await query
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch SMS templates' },
        { status: 500 }
      )
    }
    
    return NextResponse.json(templates || [])
  } catch (error) {
    console.error('SMS templates GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      name, 
      category, 
      content, 
      variables = [],
      tags = [] 
    } = body
    
    if (!name || !category || !content) {
      return NextResponse.json(
        { error: 'Name, category, and content are required' },
        { status: 400 }
      )
    }
    
    // Extract variables from content (e.g., {{name}}, {{position}})
    const extractedVars = content.match(/\{\{(\w+)\}\}/g) || []
    const uniqueVars = [...new Set(extractedVars.map((v: string) => v.replace(/[{}]/g, '')))]
    
    const template = {
      id: uuidv4(),
      name,
      category,
      content,
      variables: variables.length > 0 ? variables : uniqueVars,
      tags,
      usage_count: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { data, error } = await supabase
      .from('sms_templates')
      .insert([template])
      .select()
      .single()
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create SMS template' },
        { status: 500 }
      )
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('SMS template creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, content, variables, tags, is_active } = body
    
    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }
    
    const updates: any = {
      updated_at: new Date().toISOString()
    }
    
    if (name) updates.name = name
    if (content) updates.content = content
    if (variables) updates.variables = variables
    if (tags) updates.tags = tags
    if (typeof is_active === 'boolean') updates.is_active = is_active
    
    const { data, error } = await supabase
      .from('sms_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to update SMS template' },
        { status: 500 }
      )
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('SMS template update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }
    
    // Soft delete by marking as inactive
    const { error } = await supabase
      .from('sms_templates')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to delete SMS template' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('SMS template deletion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}