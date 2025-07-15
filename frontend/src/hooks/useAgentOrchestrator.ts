import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/auth-service'
import { createClient } from '@/lib/supabase/browser'
import { AgentOrchestratorService } from '@/lib/services/agent-orchestrator'
import { Agent } from '@/types/agent'

export interface AgentExecution {
  id: string
  agentId: string
  status: 'running' | 'completed' | 'error'
  progress: number
  currentTask?: string
  result?: any
  error?: string
  startedAt: string
  completedAt?: string
}

export interface AgentUpdate {
  agentId: string
  progress: number
  status: string
  currentTask?: string
  result?: any
  error?: string
  timestamp: string
}

export function useAgentOrchestrator() {
  const { user } = useAuth()
  const [agents, setAgents] = useState<Agent[]>([])
  const [executions, setExecutions] = useState<AgentExecution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  const supabase = createClient()
  const orchestratorService = new AgentOrchestratorService()

  // Load initial agent states
  const loadAgents = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      // Get all available agents
      const agentsData = await orchestratorService.listAgents(user.id)
      setAgents(agentsData)

      // Get recent executions
      const { data: executionsData, error: executionsError } = await supabase
        .from('agent_executions')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(20)

      if (executionsError) throw executionsError

      setExecutions(executionsData || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [user, orchestratorService, supabase])

  // Execute an agent
  const executeAgent = useCallback(async (agentId: string, payload: any = {}) => {
    if (!user) {
      throw new Error('User not authenticated')
    }

    try {
      setError(null)
      
      // Update agent status optimistically
      setAgents(prev => prev.map(agent => 
        agent.id === agentId 
          ? { ...agent, status: 'active', progress: 0, currentTask: 'Starting...' }
          : agent
      ))

      // Execute the agent
      const result = await orchestratorService.executeAgent(agentId, payload, user.id)
      
      // The real-time updates will handle the progress
      // Final result will be broadcast when complete
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute agent')
      
      // Revert optimistic update
      setAgents(prev => prev.map(agent => 
        agent.id === agentId 
          ? { ...agent, status: 'error', progress: 0, error: err instanceof Error ? err.message : 'Unknown error' }
          : agent
      ))
      
      throw err
    }
  }, [user, orchestratorService])

  // Pause an agent
  const pauseAgent = useCallback(async (agentId: string) => {
    if (!user) return

    try {
      await orchestratorService.pauseAgent(agentId, user.id)
      
      // Update local state
      setAgents(prev => prev.map(agent => 
        agent.id === agentId 
          ? { ...agent, status: 'paused' }
          : agent
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause agent')
      throw err
    }
  }, [user, orchestratorService])

  // Resume an agent
  const resumeAgent = useCallback(async (agentId: string) => {
    if (!user) return

    try {
      await orchestratorService.resumeAgent(agentId, user.id)
      
      // Update local state
      setAgents(prev => prev.map(agent => 
        agent.id === agentId 
          ? { ...agent, status: 'active' }
          : agent
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume agent')
      throw err
    }
  }, [user, orchestratorService])

  // Stop an agent
  const stopAgent = useCallback(async (agentId: string) => {
    if (!user) return

    try {
      await orchestratorService.stopAgent(agentId, user.id)
      
      // Update local state
      setAgents(prev => prev.map(agent => 
        agent.id === agentId 
          ? { ...agent, status: 'idle', progress: 0, currentTask: undefined }
          : agent
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop agent')
      throw err
    }
  }, [user, orchestratorService])

  // Execute multiple agents
  const executeMultipleAgents = useCallback(async (agentIds: string[], payload: any = {}) => {
    if (!user) return

    try {
      setError(null)
      
      // Update all agents optimistically
      setAgents(prev => prev.map(agent => 
        agentIds.includes(agent.id)
          ? { ...agent, status: 'active', progress: 0, currentTask: 'Starting...' }
          : agent
      ))

      // Execute all agents
      const results = await orchestratorService.startMultipleAgents(agentIds, payload, user.id)
      return results
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute agents')
      throw err
    }
  }, [user, orchestratorService])

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return

    let channel: any

    const setupRealtimeSubscription = async () => {
      try {
        // Subscribe to agent updates channel
        channel = supabase.channel(`agent-updates:${user.id}`)
          .on('broadcast', { event: 'agent-progress' }, (payload) => {
            const update = payload.payload as AgentUpdate
            
            // Update agent state
            setAgents(prev => prev.map(agent => 
              agent.id === update.agentId 
                ? { 
                    ...agent, 
                    progress: update.progress,
                    currentTask: update.currentTask,
                    status: update.status as any,
                    error: update.error,
                    lastActivity: update.timestamp
                  }
                : agent
            ))

            // If completed, update executions
            if (update.status === 'completed' && update.result) {
              setExecutions(prev => {
                const existing = prev.find(e => e.agentId === update.agentId && e.status === 'running')
                if (existing) {
                  return prev.map(e => 
                    e.id === existing.id 
                      ? { ...e, status: 'completed', result: update.result, completedAt: update.timestamp }
                      : e
                  )
                }
                return prev
              })
            }
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              setConnected(true)
            } else if (status === 'CLOSED') {
              setConnected(false)
            }
          })

        // Also subscribe to database changes for executions
        const executionChannel = supabase
          .channel('agent_executions')
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'agent_executions',
            filter: `user_id=eq.${user.id}`
          }, (payload) => {
            const newExecution = payload.new as AgentExecution
            setExecutions(prev => [newExecution, ...prev])
          })
          .subscribe()

        return () => {
          channel?.unsubscribe()
          executionChannel?.unsubscribe()
        }
      } catch (err) {
        console.error('Failed to set up real-time subscription:', err)
        setError('Failed to connect to real-time updates')
      }
    }

    setupRealtimeSubscription()

    return () => {
      if (channel) {
        channel.unsubscribe()
      }
    }
  }, [user, supabase])

  // Load agents on mount
  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  // Refresh agents data
  const refreshAgents = useCallback(() => {
    loadAgents()
  }, [loadAgents])

  // Get agent by ID
  const getAgent = useCallback((agentId: string) => {
    return agents.find(agent => agent.id === agentId)
  }, [agents])

  // Get executions for a specific agent
  const getAgentExecutions = useCallback((agentId: string) => {
    return executions.filter(exec => exec.agentId === agentId)
  }, [executions])

  // Get running agents
  const getRunningAgents = useCallback(() => {
    return agents.filter(agent => agent.status === 'active')
  }, [agents])

  // Get completed agents
  const getCompletedAgents = useCallback(() => {
    return agents.filter(agent => agent.status === 'completed')
  }, [agents])

  return {
    // State
    agents,
    executions,
    loading,
    error,
    connected,

    // Actions
    executeAgent,
    pauseAgent,
    resumeAgent,
    stopAgent,
    executeMultipleAgents,
    refreshAgents,

    // Getters
    getAgent,
    getAgentExecutions,
    getRunningAgents,
    getCompletedAgents,
  }
}