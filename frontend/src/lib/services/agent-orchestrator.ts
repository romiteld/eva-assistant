import { supabase } from '@/lib/supabase/browser'

export type AgentStatus = 'idle' | 'active' | 'completed' | 'error' | 'paused'

export interface Agent {
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

export interface OrchestratorRequest {
  action: 'start' | 'stop' | 'pause' | 'resume' | 'status' | 'list' | 'execute'
  agentId?: string
  agents?: string[]
  payload?: any
  userId: string
}

export interface OrchestratorResponse {
  success: boolean
  agents?: Agent[]
  result?: any
  error?: string
}

export interface AgentExecution {
  id: string
  agent_id: string
  user_id: string
  status: string
  started_at: string
  completed_at?: string
  payload?: any
  result?: any
  error?: string
}

export class AgentOrchestratorService {
  private baseUrl: string

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
    }
    // Remove trailing slash if present
    this.baseUrl = supabaseUrl.replace(/\/$/, '') + '/functions/v1/agent-orchestrator';
    console.log('Agent Orchestrator URL:', this.baseUrl);
  }

  private async makeRequest(request: Partial<OrchestratorRequest>): Promise<OrchestratorResponse> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data: session } = await supabase.auth.getSession()
    if (!session?.session) throw new Error('No active session')

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured');
    }

    console.log('Making request to Agent Orchestrator:', {
      action: request.action,
      agentId: request.agentId,
      userId: user.id
    });

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`,
        'apikey': anonKey
      },
      body: JSON.stringify({
        ...request,
        userId: user.id
      })
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorText = await response.text();
        errorMessage += ` - ${errorText}`;
      } catch (e) {
        // Ignore parsing error
      }
      console.error('Agent orchestrator error:', errorMessage);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Agent orchestrator response:', data);
    return data;
  }

  async listAgents(): Promise<Agent[]> {
    const response = await this.makeRequest({ action: 'list' })
    return response.agents || []
  }

  async getAgentStatus(agentId: string): Promise<Agent | null> {
    const response = await this.makeRequest({ action: 'status', agentId })
    return response.agents?.[0] || null
  }

  async getMultipleAgentStatus(agentIds: string[]): Promise<Agent[]> {
    const response = await this.makeRequest({ action: 'status', agents: agentIds })
    return response.agents || []
  }

  async executeAgent(agentId: string, payload?: any): Promise<any> {
    const response = await this.makeRequest({ action: 'execute', agentId, payload })
    if (!response.success) throw new Error(response.error || 'Execution failed')
    return response.result
  }

  async startAgents(agentIds: string[], payload?: any): Promise<void> {
    const response = await this.makeRequest({ action: 'start', agents: agentIds, payload })
    if (!response.success) throw new Error(response.error || 'Start failed')
  }

  async pauseAgent(agentId: string): Promise<void> {
    const response = await this.makeRequest({ action: 'pause', agentId })
    if (!response.success) throw new Error(response.error || 'Pause failed')
  }

  async pauseAgents(agentIds: string[]): Promise<void> {
    const response = await this.makeRequest({ action: 'pause', agents: agentIds })
    if (!response.success) throw new Error(response.error || 'Pause failed')
  }

  async resumeAgent(agentId: string): Promise<void> {
    const response = await this.makeRequest({ action: 'resume', agentId })
    if (!response.success) throw new Error(response.error || 'Resume failed')
  }

  async resumeAgents(agentIds: string[]): Promise<void> {
    const response = await this.makeRequest({ action: 'resume', agents: agentIds })
    if (!response.success) throw new Error(response.error || 'Resume failed')
  }

  async stopAgent(agentId: string): Promise<void> {
    const response = await this.makeRequest({ action: 'stop', agentId })
    if (!response.success) throw new Error(response.error || 'Stop failed')
  }

  async stopAgents(agentIds: string[]): Promise<void> {
    const response = await this.makeRequest({ action: 'stop', agents: agentIds })
    if (!response.success) throw new Error(response.error || 'Stop failed')
  }

  // Get execution history from database
  async getExecutionHistory(limit = 10): Promise<AgentExecution[]> {
    const { data, error } = await supabase
      .from('agent_executions')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  }

  async getAgentExecutions(agentId: string, limit = 10): Promise<AgentExecution[]> {
    const { data, error } = await supabase
      .from('agent_executions')
      .select('*')
      .eq('agent_id', agentId)
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  }

  // Get activity logs for monitoring
  async getActivityLogs(limit = 50, agentId?: string): Promise<any[]> {
    let query = supabase
      .from('agent_activity_logs')
      .select(`
        *,
        agent_registry!inner(name)
      `)
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  }

  // Get performance metrics
  async getPerformanceMetrics(agentId?: string, limit = 20): Promise<any[]> {
    let query = supabase
      .from('agent_performance_metrics')
      .select(`
        *,
        agent_registry!inner(name)
      `)
      .order('start_time', { ascending: false })
      .limit(limit)

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  }
}

// Export singleton instance
export const agentOrchestrator = new AgentOrchestratorService()