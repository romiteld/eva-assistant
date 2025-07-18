import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    const { method } = req
    const url = new URL(req.url)
    const path = url.pathname.replace('/error-logger', '')

    switch (method) {
      case 'POST':
        return await handleLogError(req, supabaseClient)
      case 'GET':
        return await handleGetErrors(req, supabaseClient)
      default:
        return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }
  } catch (error) {
    console.error('Error in error-logger function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleLogError(req: Request, supabaseClient: any) {
  try {
    const { error, category, severity, context, stack, userId, sessionId, userAgent, url } = await req.json()

    // Validate required fields
    if (!error) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert error log
    const { data, error: dbError } = await supabaseClient
      .from('error_logs')
      .insert({
        message: typeof error === 'string' ? error : error.message,
        category: category || 'unknown',
        severity: severity || 'medium',
        context: context || {},
        stack: typeof error === 'object' ? error.stack : null,
        user_id: userId,
        session_id: sessionId,
        user_agent: userAgent,
        url: url,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to log error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Store performance metric
    await supabaseClient
      .from('performance_metrics')
      .insert({
        metric_name: 'error_count',
        metric_value: 1,
        metric_unit: 'count',
        metric_type: 'error',
        tags: {
          category: category || 'unknown',
          severity: severity || 'medium',
          userAgent: userAgent ? userAgent.substring(0, 100) : null
        },
        user_id: userId,
        session_id: sessionId,
        created_at: new Date().toISOString()
      })

    return new Response(
      JSON.stringify({ success: true, errorId: data.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error logging error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process error log' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleGetErrors(req: Request, supabaseClient: any) {
  try {
    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const category = url.searchParams.get('category')
    const severity = url.searchParams.get('severity')
    const userId = url.searchParams.get('userId')
    const timeWindow = url.searchParams.get('timeWindow') // in hours

    let query = supabaseClient
      .from('error_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (category) {
      query = query.eq('category', category)
    }
    if (severity) {
      query = query.eq('severity', severity)
    }
    if (userId) {
      query = query.eq('user_id', userId)
    }
    if (timeWindow) {
      const hoursAgo = new Date(Date.now() - parseInt(timeWindow) * 60 * 60 * 1000)
      query = query.gte('created_at', hoursAgo.toISOString())
    }

    const { data, error: dbError } = await query

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch errors' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get aggregated statistics
    const statsQuery = supabaseClient
      .from('error_logs')
      .select('category, severity, created_at')

    if (timeWindow) {
      const hoursAgo = new Date(Date.now() - parseInt(timeWindow) * 60 * 60 * 1000)
      statsQuery.gte('created_at', hoursAgo.toISOString())
    }

    const { data: statsData } = await statsQuery

    // Calculate statistics
    const stats = {
      total: statsData?.length || 0,
      bySeverity: {
        low: statsData?.filter(e => e.severity === 'low').length || 0,
        medium: statsData?.filter(e => e.severity === 'medium').length || 0,
        high: statsData?.filter(e => e.severity === 'high').length || 0,
        critical: statsData?.filter(e => e.severity === 'critical').length || 0
      },
      byCategory: {
        auth: statsData?.filter(e => e.category === 'auth').length || 0,
        api: statsData?.filter(e => e.category === 'api').length || 0,
        database: statsData?.filter(e => e.category === 'database').length || 0,
        ui: statsData?.filter(e => e.category === 'ui').length || 0,
        network: statsData?.filter(e => e.category === 'network').length || 0,
        validation: statsData?.filter(e => e.category === 'validation').length || 0,
        unknown: statsData?.filter(e => e.category === 'unknown').length || 0
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: data || [],
        stats,
        pagination: {
          limit,
          offset,
          total: stats.total
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error fetching errors:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch errors' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}