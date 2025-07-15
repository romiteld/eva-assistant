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
    name: 'Lead Generation Agent',
    type: 'research',
    handler: 'enhanced-lead-generation'
  },
  'content-studio': {
    name: 'AI Content Studio',
    type: 'creative',
    handler: 'ai-content-studio'
  },
  'resume-parser': {
    name: 'Resume Parser Pipeline',
    type: 'analysis',
    handler: 'resume-parser-pipeline'
  },
  'interview-center': {
    name: 'AI Interview Center',
    type: 'scheduling',
    handler: 'ai-interview-center'
  },
  'deep-thinking': {
    name: 'Deep Thinking Orchestrator',
    type: 'orchestrator',
    handler: 'deep-thinking-orchestrator'
  }
}

// In-memory agent state (in production, use Redis or database)
const agentStates = new Map<string, Agent>()

async function executeAgent(agentId: string, payload: any, userId: string): Promise<any> {
  const agentConfig = AGENT_REGISTRY[agentId]
  if (!agentConfig) {
    throw new Error(`Unknown agent: ${agentId}`)
  }

  // Update agent status
  updateAgentStatus(agentId, 'active', 0, 'Initializing...')

  try {
    // Store execution record
    const { data: execution, error: execError } = await supabase
      .from('agent_executions')
      .insert({
        agent_id: agentId,
        user_id: userId,
        status: 'running',
        started_at: new Date().toISOString(),
        payload
      })
      .select()
      .single()

    if (execError) throw execError

    // Create agent executor
    const executor = createAgentExecutor(agentId)
    
    // Execute agent with real-time progress updates
    const result = await executor.execute({
      userId,
      payload,
      onProgress: async (progress: number, status: string) => {
        updateAgentStatus(agentId, 'active', progress, status)
        
        // Broadcast real-time updates
        await broadcastAgentUpdate(userId, agentId, {
          progress,
          status,
          currentTask: status
        })
      },
      onError: (error: Error) => {
        updateAgentStatus(agentId, 'error', 0, error.message)
      },
      onComplete: (result: any) => {
        updateAgentStatus(agentId, 'completed', 100, 'Task completed successfully')
      }
    })

    // Update execution record
    await supabase
      .from('agent_executions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result
      })
      .eq('id', execution.id)

    updateAgentStatus(agentId, 'completed', 100, 'Task completed successfully')
    
    // Broadcast completion
    await broadcastAgentUpdate(userId, agentId, {
      progress: 100,
      status: 'completed',
      result
    })

    return result

  } catch (error) {
    updateAgentStatus(agentId, 'error', 0, error.message)
    
    // Broadcast error
    await broadcastAgentUpdate(userId, agentId, {
      progress: 0,
      status: 'error',
      error: error.message
    })
    
    throw error
  }
}

function updateAgentStatus(
  agentId: string, 
  status: AgentStatus, 
  progress: number, 
  currentTask?: string
) {
  const agent = agentStates.get(agentId) || {
    id: agentId,
    name: AGENT_REGISTRY[agentId]?.name || agentId,
    type: AGENT_REGISTRY[agentId]?.type || 'unknown',
    status: 'idle',
    progress: 0
  }

  agent.status = status
  agent.progress = progress
  agent.currentTask = currentTask
  agent.lastActivity = new Date().toISOString()

  agentStates.set(agentId, agent)
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
        // Return all available agents with their current status
        const allAgents: Agent[] = Object.entries(AGENT_REGISTRY).map(([id, config]) => {
          const state = agentStates.get(id)
          return state || {
            id,
            name: config.name,
            type: config.type,
            status: 'idle' as AgentStatus,
            progress: 0
          }
        })
        response = { success: true, agents: allAgents }
        break

      case 'status':
        // Get status of specific agent(s)
        if (agentId) {
          const agent = agentStates.get(agentId)
          response = { success: true, agents: agent ? [agent] : [] }
        } else if (agents) {
          const requestedAgents = agents.map(id => agentStates.get(id)).filter(Boolean) as Agent[]
          response = { success: true, agents: requestedAgents }
        } else {
          response = { success: false, error: 'Agent ID or agents array required' }
        }
        break

      case 'execute':
        // Execute a specific agent
        if (!agentId) {
          throw new Error('Agent ID required for execution')
        }
        const result = await executeAgent(agentId, payload, userId)
        response = { success: true, result }
        break

      case 'start':
        // Start multiple agents
        if (!agents || !Array.isArray(agents)) {
          throw new Error('Agents array required')
        }
        const startPromises = agents.map(id => executeAgent(id, payload, userId))
        await Promise.all(startPromises)
        response = { success: true }
        break

      case 'pause':
        // Pause agent(s)
        if (agentId) {
          updateAgentStatus(agentId, 'paused', agentStates.get(agentId)?.progress || 0, 'Paused by user')
        } else if (agents) {
          agents.forEach(id => {
            updateAgentStatus(id, 'paused', agentStates.get(id)?.progress || 0, 'Paused by user')
          })
        }
        response = { success: true }
        break

      case 'resume':
        // Resume paused agent(s)
        if (agentId) {
          const agent = agentStates.get(agentId)
          if (agent?.status === 'paused') {
            updateAgentStatus(agentId, 'active', agent.progress, 'Resumed by user')
          }
        } else if (agents) {
          agents.forEach(id => {
            const agent = agentStates.get(id)
            if (agent?.status === 'paused') {
              updateAgentStatus(id, 'active', agent.progress, 'Resumed by user')
            }
          })
        }
        response = { success: true }
        break

      case 'stop':
        // Stop agent(s)
        if (agentId) {
          updateAgentStatus(agentId, 'idle', 0, 'Stopped by user')
        } else if (agents) {
          agents.forEach(id => {
            updateAgentStatus(id, 'idle', 0, 'Stopped by user')
          })
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