import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { data: flows, error } = await supabase
      .from('ivr_flows')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch IVR flows' },
        { status: 500 }
      )
    }
    
    return NextResponse.json(flows || [])
  } catch (error) {
    console.error('IVR flows GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, steps, isActive = false } = body
    
    if (!name || !steps || !Array.isArray(steps)) {
      return NextResponse.json(
        { error: 'Missing required fields: name, steps' },
        { status: 400 }
      )
    }
    
    const flowId = uuidv4()
    const ivrFlow = {
      id: flowId,
      name,
      steps,
      is_active: isActive,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { data, error } = await supabase
      .from('ivr_flows')
      .insert([ivrFlow])
      .select()
      .single()
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create IVR flow' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      id: data.id,
      name: data.name,
      steps: data.steps,
      isActive: data.is_active,
      phoneNumberSid: data.phone_number_sid
    })
  } catch (error) {
    console.error('IVR flows POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, steps, isActive, phoneNumberSid } = body
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      )
    }
    
    const updates: any = {
      updated_at: new Date().toISOString()
    }
    
    if (name) updates.name = name
    if (steps) updates.steps = steps
    if (typeof isActive === 'boolean') updates.is_active = isActive
    if (phoneNumberSid) updates.phone_number_sid = phoneNumberSid
    
    const { data, error } = await supabase
      .from('ivr_flows')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to update IVR flow' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      id: data.id,
      name: data.name,
      steps: data.steps,
      isActive: data.is_active,
      phoneNumberSid: data.phone_number_sid
    })
  } catch (error) {
    console.error('IVR flows PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}