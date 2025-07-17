export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: 'active' | 'inactive' | 'error';
  capabilities: string[];
  configuration?: Record<string, any>;
  metadata?: Record<string, any>;
}

export enum AgentType {
  RESEARCH = 'research',
  COMMUNICATION = 'communication',
  WORKFLOW = 'workflow',
  ORCHESTRATOR = 'orchestrator',
  DEAL_AUTOMATION = 'deal_automation',
  LEAD_GENERATION = 'lead_generation',
  CONTENT_STUDIO = 'content_studio',
  RESUME_PARSER = 'resume_parser',
  INTERVIEW_CENTER = 'interview_center'
}

export interface AgentAction {
  id: string;
  name: string;
  description: string;
  parameters?: Record<string, any>;
  execute?: (params: any) => Promise<any>;
  handler?: (params: any) => Promise<any>;
  inputSchema?: any;
  outputSchema?: any;
}

export interface AgentResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: Date;
}

export interface AgentExecution {
  id: string;
  agentId: string;
  status: 'running' | 'completed' | 'error';
  startTime: Date;
  endTime?: Date;
  result?: AgentResult;
}