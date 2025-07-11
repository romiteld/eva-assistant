import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { corsHeaders } from '../_shared/cors.ts'

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

    // Execute based on agent type
    let result: any
    switch (agentConfig.handler) {
      case 'enhanced-lead-generation':
        result = await executeLeadGeneration(payload, userId, (progress, status) => {
          updateAgentStatus(agentId, 'active', progress, status)
        })
        break
      
      case 'ai-content-studio':
        result = await executeContentStudio(payload, userId, (progress, status) => {
          updateAgentStatus(agentId, 'active', progress, status)
        })
        break
      
      case 'resume-parser-pipeline':
        result = await executeResumeParser(payload, userId, (progress, status) => {
          updateAgentStatus(agentId, 'active', progress, status)
        })
        break
      
      case 'ai-interview-center':
        result = await executeInterviewCenter(payload, userId, (progress, status) => {
          updateAgentStatus(agentId, 'active', progress, status)
        })
        break
      
      case 'deep-thinking-orchestrator':
        result = await executeDeepThinking(payload, userId, (progress, status) => {
          updateAgentStatus(agentId, 'active', progress, status)
        })
        break
      
      default:
        throw new Error(`Handler not implemented: ${agentConfig.handler}`)
    }

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
    return result

  } catch (error) {
    updateAgentStatus(agentId, 'error', 0, error.message)
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

// Agent execution handlers
async function executeLeadGeneration(payload: any, userId: string, onProgress: (progress: number, status: string) => void) {
  onProgress(10, 'Searching for leads...')
  
  // Simulate multi-stage lead generation
  const stages = [
    { progress: 20, status: 'Web scraping financial advisors...', duration: 2000 },
    { progress: 40, status: 'Qualifying leads based on criteria...', duration: 1500 },
    { progress: 60, status: 'Scoring and ranking leads...', duration: 1000 },
    { progress: 80, status: 'Enriching lead data...', duration: 1500 },
    { progress: 90, status: 'Syncing to Zoho CRM...', duration: 1000 }
  ]

  for (const stage of stages) {
    await new Promise(resolve => setTimeout(resolve, stage.duration))
    onProgress(stage.progress, stage.status)
  }

  // Return mock results (in production, call actual agent logic)
  return {
    leadsFound: 15,
    qualified: 8,
    syncedToCRM: 8,
    topLeads: [
      { name: 'John Smith', score: 95, location: 'New York', aum: '$50M' },
      { name: 'Sarah Johnson', score: 92, location: 'Los Angeles', aum: '$45M' }
    ]
  }
}

async function executeContentStudio(payload: any, userId: string, onProgress: (progress: number, status: string) => void) {
  onProgress(10, 'Analyzing market trends...')
  
  const stages = [
    { progress: 25, status: 'Generating content variations...', duration: 2000 },
    { progress: 50, status: 'Optimizing for engagement...', duration: 1500 },
    { progress: 75, status: 'Creating multimedia assets...', duration: 2000 },
    { progress: 90, status: 'Preparing distribution plan...', duration: 1000 }
  ]

  for (const stage of stages) {
    await new Promise(resolve => setTimeout(resolve, stage.duration))
    onProgress(stage.progress, stage.status)
  }

  return {
    contentGenerated: 5,
    formats: ['LinkedIn Post', 'Blog Article', 'Email Template'],
    engagementScore: 87,
    distributionChannels: ['LinkedIn', 'Email', 'Website']
  }
}

async function executeResumeParser(payload: any, userId: string, onProgress: (progress: number, status: string) => void) {
  onProgress(10, 'Extracting resume data...')
  
  const stages = [
    { progress: 30, status: 'Analyzing skills and experience...', duration: 1500 },
    { progress: 50, status: 'Matching against job requirements...', duration: 2000 },
    { progress: 70, status: 'Verifying credentials...', duration: 1500 },
    { progress: 90, status: 'Generating recommendations...', duration: 1000 }
  ]

  for (const stage of stages) {
    await new Promise(resolve => setTimeout(resolve, stage.duration))
    onProgress(stage.progress, stage.status)
  }

  return {
    candidatesProcessed: 12,
    topMatches: 5,
    averageScore: 78,
    recommendations: ['Schedule interviews with top 3 candidates']
  }
}

async function executeInterviewCenter(payload: any, userId: string, onProgress: (progress: number, status: string) => void) {
  onProgress(10, 'Checking calendar availability...')
  
  const stages = [
    { progress: 25, status: 'Generating interview questions...', duration: 1500 },
    { progress: 50, status: 'Creating interview guides...', duration: 2000 },
    { progress: 75, status: 'Scheduling meetings...', duration: 1500 },
    { progress: 90, status: 'Sending notifications...', duration: 1000 }
  ]

  for (const stage of stages) {
    await new Promise(resolve => setTimeout(resolve, stage.duration))
    onProgress(stage.progress, stage.status)
  }

  return {
    interviewsScheduled: 3,
    questionsGenerated: 15,
    calendarIntegration: 'Microsoft Outlook',
    nextInterview: '2024-01-15 10:00 AM'
  }
}

async function executeDeepThinking(payload: any, userId: string, onProgress: (progress: number, status: string) => void) {
  onProgress(10, 'Initializing sub-agents...')
  
  const stages = [
    { progress: 20, status: 'Analysis agent processing...', duration: 2000 },
    { progress: 40, status: 'Planning agent strategizing...', duration: 2000 },
    { progress: 60, status: 'Execution agent implementing...', duration: 2000 },
    { progress: 80, status: 'Validation agent verifying...', duration: 1500 },
    { progress: 95, status: 'Learning agent updating models...', duration: 1000 }
  ]

  for (const stage of stages) {
    await new Promise(resolve => setTimeout(resolve, stage.duration))
    onProgress(stage.progress, stage.status)
  }

  return {
    problemSolved: true,
    confidence: 0.92,
    subAgentsUsed: 5,
    reasoningSteps: 12,
    recommendation: 'Proceed with recommended approach'
  }
}

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