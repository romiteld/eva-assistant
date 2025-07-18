import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { corsHeaders } from '../_shared/cors.ts'
import { 
  createAgentExecutor, 
  broadcastAgentUpdate, 
  type AgentExecutionContext 
} from '../_shared/agent-executor.ts'

// Agent status types
type AgentStatus = 'idle' | 'active' | 'completed' | 'error' | 'paused'

interface Agent {
  id: string
  name: string
  type: string
  status: AgentStatus
  progress: number
  currentTask?: string
  lastActivity?: string
  error?: string
  metadata?: Record<string, any>
  description?: string
  capabilities?: string[]
}

interface OrchestratorRequest {
  action: 'start' | 'stop' | 'pause' | 'resume' | 'status' | 'list' | 'execute'
  agentId?: string
  agents?: string[]
  payload?: any
  userId: string
}

interface OrchestratorResponse {
  success: boolean
  agents?: Agent[]
  result?: any
  error?: string
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Agent registry with all available agents
const AGENT_REGISTRY = {
  'lead-generation': {
    name: 'Enhanced Lead Generation Agent',
    type: 'research',
    handler: 'enhanced-lead-generation',
    description: 'AI-powered lead discovery with web scraping, qualification, scoring, enrichment, and Zoho CRM sync',
    capabilities: ['Web Scraping', 'Lead Qualification', 'Data Enrichment', 'CRM Integration']
  },
  'content-studio': {
    name: 'AI Content Studio Ultra',
    type: 'creative',
    handler: 'ai-content-studio',
    description: 'Multi-agent content creation with market analysis, predictive analytics, and omni-channel distribution',
    capabilities: ['Content Generation', 'Market Analysis', 'Trend Prediction', 'Multi-platform Optimization']
  },
  'deep-thinking': {
    name: 'Deep Thinking Orchestrator',
    type: 'orchestrator',
    handler: 'deep-thinking-orchestrator',
    description: '5-agent collaborative system for complex problem solving with multi-perspective analysis',
    capabilities: ['Problem Analysis', 'Strategic Planning', 'Solution Execution', 'Result Validation']
  },
  'recruiter-intel': {
    name: 'Recruiter Intel Agent',
    type: 'analytics',
    handler: 'recruiter-intel',
    description: 'Advanced analytics and intelligence gathering for recruitment optimization',
    capabilities: ['Market Analytics', 'Performance Metrics', 'Competitive Intelligence', 'Trend Analysis']
  },
  'resume-parser': {
    name: 'Resume Parser Pipeline',
    type: 'processing',
    handler: 'resume-parser',
    description: 'Intelligent resume parsing with extraction, analysis, matching, and candidate ranking',
    capabilities: ['Resume Parsing', 'Skill Extraction', 'Candidate Matching', 'Automated Ranking']
  },
  'outreach-campaign': {
    name: 'Outreach Campaign Manager',
    type: 'communication',
    handler: 'outreach-campaign',
    description: 'Automated outreach campaigns with personalization, timing optimization, and response tracking',
    capabilities: ['Campaign Management', 'Message Personalization', 'Timing Optimization', 'Response Tracking']
  },
  'interview-center': {
    name: 'AI Interview Center',
    type: 'scheduling',
    handler: 'interview-center',
    description: 'Smart interview scheduling with calendar integration, question generation, and follow-up automation',
    capabilities: ['Interview Scheduling', 'Question Generation', 'Calendar Integration', 'Automated Follow-up']
  },
  'data-agent': {
    name: 'Data Processing Agent',
    type: 'processing',
    handler: 'data-agent',
    description: 'Advanced data processing, analysis, and transformation for recruitment workflows',
    capabilities: ['Data Processing', 'ETL Operations', 'Data Validation', 'Report Generation']
  },
  'workflow-agent': {
    name: 'Workflow Automation Agent',
    type: 'automation',
    handler: 'workflow-agent',
    description: 'Process automation and workflow orchestration across recruitment pipelines',
    capabilities: ['Process Automation', 'Workflow Orchestration', 'Task Management', 'Integration Coordination']
  },
  'linkedin-enrichment': {
    name: 'LinkedIn Enrichment Agent',
    type: 'enrichment',
    handler: 'linkedin-enrichment',
    description: 'LinkedIn profile enrichment and social data gathering for enhanced candidate insights',
    capabilities: ['Profile Enrichment', 'Social Data Mining', 'Network Analysis', 'Professional Insights']
  }
}

// Database-backed agent state management
async function getAgentState(agentId: string, userId: string): Promise<Agent | null> {
  try {
    const { data, error } = await supabase.rpc('get_agent_state', {
      p_agent_id: agentId,
      p_user_id: userId
    })
    
    if (error) throw error
    return data ? {
      id: data.agent_id || agentId,
      name: data.name || agentId,
      type: data.type || 'unknown',
      status: data.status || 'idle',
      progress: data.progress || 0,
      currentTask: data.current_task,
      lastActivity: data.last_activity,
      error: data.error_message,
      metadata: data.metadata,
      description: data.description,
      capabilities: data.capabilities
    } : null
  } catch (error) {
    console.error('Failed to get agent state:', error)
    return null
  }
}

async function getAllAgentStates(userId: string): Promise<Agent[]> {
  try {
    const agents: Agent[] = []
    
    for (const [agentId, config] of Object.entries(AGENT_REGISTRY)) {
      const state = await getAgentState(agentId, userId)
      agents.push(state || {
        id: agentId,
        name: config.name,
        type: config.type,
        status: 'idle' as AgentStatus,
        progress: 0,
        description: config.description,
        capabilities: config.capabilities
      })
    }
    
    return agents
  } catch (error) {
    console.error('Failed to get all agent states:', error)
    return []
  }
}

async function logAgentActivity(
  agentId: string, 
  userId: string, 
  level: string, 
  message: string, 
  details?: any,
  executionId?: string
) {
  try {
    await supabase.rpc('log_agent_activity', {
      p_agent_id: agentId,
      p_user_id: userId,
      p_log_level: level,
      p_message: message,
      p_details: details ? JSON.stringify(details) : null,
      p_execution_id: executionId
    })
  } catch (error) {
    console.error('Failed to log agent activity:', error)
  }
}

async function recordPerformanceMetrics(
  agentId: string,
  userId: string,
  executionId: string,
  metrics: {
    startTime: Date
    endTime?: Date
    success: boolean
    apiCallsCount?: number
    tasksCompleted?: number
    accuracyScore?: number
    confidenceScore?: number
  }
) {
  try {
    const duration = metrics.endTime ? 
      metrics.endTime.getTime() - metrics.startTime.getTime() : null

    await supabase
      .from('agent_performance_metrics')
      .insert({
        agent_id: agentId,
        user_id: userId,
        execution_id: executionId,
        start_time: metrics.startTime.toISOString(),
        end_time: metrics.endTime?.toISOString(),
        duration_ms: duration,
        success: metrics.success,
        api_calls_count: metrics.apiCallsCount || 0,
        tasks_completed: metrics.tasksCompleted || 0,
        accuracy_score: metrics.accuracyScore,
        confidence_score: metrics.confidenceScore
      })
  } catch (error) {
    console.error('Failed to record performance metrics:', error)
  }
}

async function executeAgent(agentId: string, payload: any, userId: string): Promise<any> {
  const agentConfig = AGENT_REGISTRY[agentId]
  if (!agentConfig) {
    throw new Error(`Unknown agent: ${agentId}`)
  }

  const startTime = new Date()
  let executionId: string

  // Update agent status
  await updateAgentStatus(agentId, userId, 'active', 0, 'Initializing...')
  await logAgentActivity(agentId, userId, 'info', 'Agent execution started', { payload })

  try {
    // Store execution record
    const { data: execution, error: execError } = await supabase
      .from('agent_executions')
      .insert({
        agent_id: agentId,
        user_id: userId,
        status: 'running',
        started_at: startTime.toISOString(),
        payload
      })
      .select()
      .single()

    if (execError) throw execError
    executionId = execution.id

    // Create agent executor
    const executor = createAgentExecutor(agentId)
    
    // Execute agent with real-time progress updates
    const result = await executor.execute({
      userId,
      payload,
      onProgress: async (progress: number, status: string) => {
        await updateAgentStatus(agentId, userId, 'active', progress, status)
        await logAgentActivity(agentId, userId, 'debug', `Progress: ${progress}% - ${status}`, { progress }, executionId)
        
        // Broadcast real-time updates
        await broadcastAgentUpdate(userId, agentId, {
          progress,
          status,
          currentTask: status
        })
      },
      onError: async (error: Error) => {
        await updateAgentStatus(agentId, userId, 'error', 0, undefined, error.message)
        await logAgentActivity(agentId, userId, 'error', 'Agent execution failed', { error: error.message }, executionId)
      },
      onComplete: async (result: any) => {
        await updateAgentStatus(agentId, userId, 'completed', 100, 'Task completed successfully')
        await logAgentActivity(agentId, userId, 'info', 'Agent execution completed successfully', { result }, executionId)
      }
    })

    const endTime = new Date()

    // Update execution record
    await supabase
      .from('agent_executions')
      .update({
        status: 'completed',
        completed_at: endTime.toISOString(),
        result
      })
      .eq('id', execution.id)

    // Record performance metrics
    await recordPerformanceMetrics(agentId, userId, executionId, {
      startTime,
      endTime,
      success: true,
      tasksCompleted: 1,
      accuracyScore: result.accuracy || 0.95,
      confidenceScore: result.confidence || 0.90
    })

    await updateAgentStatus(agentId, userId, 'completed', 100, 'Task completed successfully')
    
    // Broadcast completion
    await broadcastAgentUpdate(userId, agentId, {
      progress: 100,
      status: 'completed',
      result
    })

    return result

  } catch (error) {
    const endTime = new Date()
    
    await updateAgentStatus(agentId, userId, 'error', 0, undefined, error.message)
    await logAgentActivity(agentId, userId, 'error', 'Agent execution failed', { error: error.message }, executionId!)
    
    // Record failure metrics
    if (executionId!) {
      await recordPerformanceMetrics(agentId, userId, executionId!, {
        startTime,
        endTime,
        success: false
      })
    }
    
    // Broadcast error
    await broadcastAgentUpdate(userId, agentId, {
      progress: 0,
      status: 'error',
      error: error.message
    })
    
    throw error
  }
}

async function updateAgentStatus(
  agentId: string,
  userId: string,
  status?: AgentStatus, 
  progress?: number, 
  currentTask?: string,
  errorMessage?: string,
  metadata?: Record<string, any>
) {
  try {
    await supabase.rpc('update_agent_state', {
      p_agent_id: agentId,
      p_user_id: userId,
      p_status: status,
      p_progress: progress,
      p_current_task: currentTask,
      p_error_message: errorMessage,
      p_metadata: metadata ? JSON.stringify(metadata) : null
    })
  } catch (error) {
    console.error('Failed to update agent status:', error)
  }
}

// Agent execution handlers have been moved to _shared/agent-executor.ts
// This provides better separation of concerns and easier testing

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, agentId, agents, payload, userId } = await req.json() as OrchestratorRequest

    if (!userId) {
      throw new Error('User ID is required')
    }

    let response: OrchestratorResponse

    switch (action) {
      case 'list':
        // Return all available agents with their current status from database
        const allAgents = await getAllAgentStates(userId)
        response = { success: true, agents: allAgents }
        break

      case 'status':
        // Get status of specific agent(s) from database
        if (agentId) {
          const agent = await getAgentState(agentId, userId)
          response = { success: true, agents: agent ? [agent] : [] }
        } else if (agents) {
          const requestedAgents = await Promise.all(
            agents.map(id => getAgentState(id, userId))
          )
          response = { success: true, agents: requestedAgents.filter(Boolean) as Agent[] }
        } else {
          response = { success: false, error: 'Agent ID or agents array required' }
        }
        break

      case 'execute':
        // Execute a specific agent
        if (!agentId) {
          throw new Error('Agent ID required for execution')
        }
        await logAgentActivity(agentId, userId, 'info', 'Agent execution requested via orchestrator', { payload })
        const result = await executeAgent(agentId, payload, userId)
        response = { success: true, result }
        break

      case 'start':
        // Start multiple agents
        if (!agents || !Array.isArray(agents)) {
          throw new Error('Agents array required')
        }
        await logAgentActivity('orchestrator', userId, 'info', 'Bulk agent start requested', { agents })
        const startPromises = agents.map(id => executeAgent(id, payload, userId))
        await Promise.all(startPromises)
        response = { success: true }
        break

      case 'pause':
        // Pause agent(s)
        if (agentId) {
          const currentAgent = await getAgentState(agentId, userId)
          await updateAgentStatus(agentId, userId, 'paused', currentAgent?.progress || 0, 'Paused by user')
          await logAgentActivity(agentId, userId, 'info', 'Agent paused by user')
        } else if (agents) {
          await Promise.all(agents.map(async (id) => {
            const currentAgent = await getAgentState(id, userId)
            await updateAgentStatus(id, userId, 'paused', currentAgent?.progress || 0, 'Paused by user')
            await logAgentActivity(id, userId, 'info', 'Agent paused by user (bulk operation)')
          }))
        }
        response = { success: true }
        break

      case 'resume':
        // Resume paused agent(s)
        if (agentId) {
          const agent = await getAgentState(agentId, userId)
          if (agent?.status === 'paused') {
            await updateAgentStatus(agentId, userId, 'active', agent.progress, 'Resumed by user')
            await logAgentActivity(agentId, userId, 'info', 'Agent resumed by user')
          }
        } else if (agents) {
          await Promise.all(agents.map(async (id) => {
            const agent = await getAgentState(id, userId)
            if (agent?.status === 'paused') {
              await updateAgentStatus(id, userId, 'active', agent.progress, 'Resumed by user')
              await logAgentActivity(id, userId, 'info', 'Agent resumed by user (bulk operation)')
            }
          }))
        }
        response = { success: true }
        break

      case 'stop':
        // Stop agent(s)
        if (agentId) {
          await updateAgentStatus(agentId, userId, 'idle', 0, 'Stopped by user')
          await logAgentActivity(agentId, userId, 'info', 'Agent stopped by user')
        } else if (agents) {
          await Promise.all(agents.map(async (id) => {
            await updateAgentStatus(id, userId, 'idle', 0, 'Stopped by user')
            await logAgentActivity(id, userId, 'info', 'Agent stopped by user (bulk operation)')
          }))
        }
        response = { success: true }
        break

      default:
        response = { success: false, error: `Unknown action: ${action}` }
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Agent Orchestrator Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})