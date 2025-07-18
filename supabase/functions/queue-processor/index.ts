import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { corsHeaders } from '../_shared/cors.ts'

// Queue item interface
interface QueueItem {
  id: string
  queue_name: string
  payload: any
  priority: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  retry_count: number
  max_retries: number
  scheduled_at: string
  processed_at?: string
  error_message?: string
  result?: any
  created_at: string
  user_id: string
}

// Queue processor registry
interface QueueProcessor {
  name: string
  handler: (item: QueueItem) => Promise<any>
  concurrency: number
  retryDelay: number // milliseconds
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Queue processors
const processors: Record<string, QueueProcessor> = {
  'email-send': {
    name: 'email-send',
    handler: async (item) => {
      // Process email sending
      console.log('Processing email:', item.payload)
      // Implement actual email sending logic here
      return { sent: true, messageId: crypto.randomUUID() }
    },
    concurrency: 5,
    retryDelay: 60000, // 1 minute
  },
  'lead-enrichment': {
    name: 'lead-enrichment',
    handler: async (item) => {
      // Process lead enrichment
      console.log('Enriching lead:', item.payload)
      // Implement actual lead enrichment logic here
      return { enriched: true, data: {} }
    },
    concurrency: 3,
    retryDelay: 30000, // 30 seconds
  },
  'agent-execution': {
    name: 'agent-execution',
    handler: async (item) => {
      // Process agent execution
      const { agentId, payload } = item.payload
      console.log('Executing agent:', agentId)
      // Delegate to agent executor
      return { executed: true, agentId }
    },
    concurrency: 10,
    retryDelay: 5000, // 5 seconds
  },
  'webhook-delivery': {
    name: 'webhook-delivery',
    handler: async (item) => {
      // Process webhook delivery
      const { url, method, headers, body } = item.payload
      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body),
      })
      
      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`)
      }
      
      return { 
        delivered: true, 
        status: response.status,
        response: await response.text()
      }
    },
    concurrency: 20,
    retryDelay: 10000, // 10 seconds
  },
}

// Process queue items
async function processQueue(queueName: string) {
  const processor = processors[queueName]
  if (!processor) {
    throw new Error(`Unknown queue: ${queueName}`)
  }

  // Get pending items
  const { data: items, error } = await supabase
    .from('queue_items')
    .select('*')
    .eq('queue_name', queueName)
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(processor.concurrency)

  if (error) throw error
  if (!items || items.length === 0) return { processed: 0 }

  // Process items in parallel
  const results = await Promise.allSettled(
    items.map(async (item) => {
      try {
        // Mark as processing
        await supabase
          .from('queue_items')
          .update({ 
            status: 'processing',
            processed_at: new Date().toISOString()
          })
          .eq('id', item.id)

        // Process the item
        const result = await processor.handler(item)

        // Mark as completed
        await supabase
          .from('queue_items')
          .update({ 
            status: 'completed',
            result,
            processed_at: new Date().toISOString()
          })
          .eq('id', item.id)

        return { success: true, itemId: item.id }
      } catch (error) {
        console.error(`Processing failed for item ${item.id}:`, error)
        
        // Update retry count
        const newRetryCount = item.retry_count + 1
        const shouldRetry = newRetryCount < item.max_retries
        
        await supabase
          .from('queue_items')
          .update({ 
            status: shouldRetry ? 'pending' : 'failed',
            retry_count: newRetryCount,
            scheduled_at: shouldRetry 
              ? new Date(Date.now() + processor.retryDelay).toISOString()
              : item.scheduled_at,
            error_message: error.message,
            processed_at: new Date().toISOString()
          })
          .eq('id', item.id)

        return { success: false, itemId: item.id, error: error.message }
      }
    })
  )

  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
  const failed = results.filter(r => r.status === 'rejected' || !r.value?.success).length

  return { processed: items.length, successful, failed }
}

// Add item to queue
async function addToQueue(queueName: string, payload: any, options?: {
  priority?: number
  delay?: number
  maxRetries?: number
  userId?: string
}) {
  const scheduledAt = options?.delay 
    ? new Date(Date.now() + options.delay).toISOString()
    : new Date().toISOString()

  const { data, error } = await supabase
    .from('queue_items')
    .insert({
      queue_name: queueName,
      payload,
      priority: options?.priority || 5,
      max_retries: options?.maxRetries || 3,
      scheduled_at: scheduledAt,
      user_id: options?.userId || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Get queue statistics
async function getQueueStats(queueName?: string) {
  let query = supabase
    .from('queue_items')
    .select('queue_name, status, count(*)', { count: 'exact' })

  if (queueName) {
    query = query.eq('queue_name', queueName)
  }

  const { data, error } = await query

  if (error) throw error

  // Group by queue and status
  const stats: Record<string, Record<string, number>> = {}
  
  // Fetch actual counts for each status
  for (const queue of Object.keys(processors)) {
    if (queueName && queue !== queueName) continue
    
    stats[queue] = {}
    
    for (const status of ['pending', 'processing', 'completed', 'failed']) {
      const { count } = await supabase
        .from('queue_items')
        .select('*', { count: 'exact', head: true })
        .eq('queue_name', queue)
        .eq('status', status)
      
      stats[queue][status] = count || 0
    }
  }

  return stats
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()

    if (req.method === 'POST') {
      const body = await req.json()

      switch (path) {
        case 'process':
          // Process a specific queue
          const { queueName } = body
          if (!queueName) throw new Error('Queue name required')
          
          const result = await processQueue(queueName)
          return new Response(
            JSON.stringify({ success: true, ...result }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )

        case 'add':
          // Add item to queue
          const { queue, payload, ...options } = body
          if (!queue || !payload) throw new Error('Queue and payload required')
          
          const item = await addToQueue(queue, payload, options)
          return new Response(
            JSON.stringify({ success: true, item }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )

        case 'process-all':
          // Process all queues
          const results: Record<string, any> = {}
          
          for (const queueName of Object.keys(processors)) {
            results[queueName] = await processQueue(queueName)
          }
          
          return new Response(
            JSON.stringify({ success: true, results }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )

        default:
          throw new Error(`Unknown endpoint: ${path}`)
      }
    } else if (req.method === 'GET' && path === 'stats') {
      // Get queue statistics
      const queueName = url.searchParams.get('queue') || undefined
      const stats = await getQueueStats(queueName)
      
      return new Response(
        JSON.stringify({ success: true, stats }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error(`Method ${req.method} not allowed`)

  } catch (error) {
    console.error('Queue processor error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})