import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: flow, error } = await supabase
      .from('ivr_flows')
      .select('*')
      .eq('id', params.id)
      .single()
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'IVR flow not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      id: flow.id,
      name: flow.name,
      steps: flow.steps,
      isActive: flow.is_active,
      phoneNumberSid: flow.phone_number_sid
    })
  } catch (error) {
    console.error('IVR flow GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, steps, isActive, phoneNumberSid } = body
    
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
      .eq('id', params.id)
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
    console.error('IVR flow PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await supabase
      .from('ivr_flows')
      .delete()
      .eq('id', params.id)
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to delete IVR flow' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('IVR flow DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}