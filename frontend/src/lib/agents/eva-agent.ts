// Eva Voice Agent - Integrates with A2A system for dashboard control
import { Agent, AgentTask, AgentResult, AgentRegistry } from './a2a-orchestrator';
import { EvaBrain } from '@/lib/services/eva-brain';
import { whisperService } from '@/lib/services/whisper-transcription';
import { firecrawl } from '@/lib/firecrawl/client';
import { supabase } from '@/lib/supabase/browser';
import { EventEmitter } from 'events';

export interface EvaAgentTask extends AgentTask {
  type: 'voice_command' | 'search' | 'navigate' | 'execute_workflow' | 'query_data' | 'create_item';
  voiceTranscript?: string;
  audioData?: Blob;
}

export class EvaVoiceAgent extends EventEmitter implements Agent {
  id = 'eva-voice-agent';
  name = 'Eva Voice Assistant';
  type = 'custom' as const;
  capabilities = [
    'voice_transcription',
    'natural_language_understanding',
    'web_search',
    'dashboard_navigation',
    'workflow_execution',
    'data_manipulation',
    'task_creation'
  ];

  private brain: EvaBrain;
  private isProcessing = false;

  constructor(sessionId: string) {
    super();
    this.brain = new EvaBrain(sessionId);
    
    // Listen to brain events
    this.brain.on('tool_execution_start', (tool) => {
      this.emit('tool_start', tool);
    });
    
    this.brain.on('tool_execution_complete', (tool) => {
      this.emit('tool_complete', tool);
    });
    
    this.brain.on('error', (error) => {
      this.emit('error', error);
    });
  }

  async execute(task: AgentTask): Promise<AgentResult> {
    if (this.isProcessing) {
      return {
        taskId: task.id,
        status: 'failed',
        error: 'Eva is already processing a request'
      };
    }

    this.isProcessing = true;
    this.emit('processing_start', task);

    try {
      let result: any;

      switch (task.type) {
        case 'voice_command':
          result = await this.processVoiceCommand(task);
          break;

        case 'search':
          result = await this.performWebSearch(task.params);
          break;

        case 'navigate':
          result = await this.navigateDashboard(task.params);
          break;

        case 'execute_workflow':
          result = await this.executeWorkflow(task.params);
          break;

        case 'query_data':
          result = await this.queryData(task.params);
          break;

        case 'create_item':
          result = await this.createItem(task.params);
          break;

        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }

      this.emit('processing_complete', { task, result });
      
      return {
        taskId: task.id,
        status: 'success',
        data: result
      };
    } catch (error) {
      this.emit('processing_error', { task, error });
      
      return {
        taskId: task.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      this.isProcessing = false;
    }
  }

  // Process voice command with transcription and AI understanding
  private async processVoiceCommand(task: AgentTask): Promise<any> {
    let transcript = task.voiceTranscript;

    // If no transcript provided but audio data exists, transcribe it
    if (!transcript && task.audioData) {
      const audioFile = new File([task.audioData], 'voice_command.webm', { 
        type: 'audio/webm' 
      });
      
      const transcriptionResult = await whisperService.transcribeFile(audioFile, {
        language: task.params.language || 'en'
      });
      
      transcript = transcriptionResult.text;
      this.emit('transcription_complete', transcriptionResult);
    }

    if (!transcript) {
      throw new Error('No voice transcript or audio data provided');
    }

    // Process with Eva's brain
    const response = await this.brain.processInput(transcript, {
      preferredModel: task.params.preferredModel
    });

    // Store in voice conversations
    await this.storeConversation(task.params.sessionId, transcript, response);

    return {
      transcript,
      response,
      context: this.brain.getContext()
    };
  }

  // Perform web search using Firecrawl
  private async performWebSearch(params: any): Promise<any> {
    const results = [];
    const searchOptions = {
      limit: params.limit || 5,
      scrapeOptions: {
        formats: ['markdown' as const],
        onlyMainContent: true
      }
    };

    for await (const result of firecrawl.searchStream(params.query, searchOptions)) {
      results.push({
        title: result.title,
        url: result.url,
        content: result.content,
        metadata: result.metadata
      });
    }

    return results;
  }

  // Navigate to dashboard page
  private async navigateDashboard(params: any): Promise<any> {
    const { page, newTab = false } = params;

    if (typeof window !== 'undefined') {
      if (newTab) {
        window.open(page, '_blank');
      } else {
        window.location.href = page;
      }
      
      return { 
        success: true, 
        navigatedTo: page,
        method: newTab ? 'new_tab' : 'same_tab'
      };
    }

    return { 
      success: false, 
      error: 'Navigation not available in server context' 
    };
  }

  // Execute A2A workflow
  private async executeWorkflow(params: any): Promise<any> {
    const { workflowId, workflowParams, agents } = params;

    // Create workflow task
    const workflowTask: AgentTask = {
      id: `eva-workflow-${Date.now()}`,
      type: 'workflow',
      params: {
        ...workflowParams,
        initiatedBy: 'eva-voice-agent'
      }
    };

    // Get agents to execute
    const agentIds = agents || ['firecrawl-agent', 'gemini-agent'];
    const results = [];

    for (const agentId of agentIds) {
      const agent = AgentRegistry.get(agentId);
      if (agent) {
        const result = await agent.execute(workflowTask);
        results.push({
          agentId,
          result
        });
      }
    }

    return {
      workflowId,
      taskId: workflowTask.id,
      results
    };
  }

  // Query data from Supabase
  private async queryData(params: any): Promise<any> {
    const { table, select = '*', filters = {}, limit = 10, orderBy } = params;

    let query = supabase.from(table).select(select);

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    // Apply limit
    query = query.limit(limit);

    // Apply ordering
    if (orderBy) {
      query = query.order(orderBy.column, { 
        ascending: orderBy.ascending ?? true 
      });
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  // Create item in database
  private async createItem(params: any): Promise<any> {
    const { table, data: itemData } = params;

    const { data, error } = await supabase
      .from(table)
      .insert(itemData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Store conversation in database
  private async storeConversation(
    sessionId: string, 
    userMessage: string, 
    assistantResponse: string
  ): Promise<void> {
    const { error } = await supabase
      .from('voice_conversations')
      .upsert({
        id: sessionId,
        transcript: supabase.rpc('append_to_jsonb', {
          target_column: 'transcript',
          new_data: [
            {
              text: userMessage,
              speaker: 'user',
              timestamp: Date.now()
            },
            {
              text: assistantResponse,
              speaker: 'assistant',
              timestamp: Date.now()
            }
          ]
        }),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to store conversation:', error);
    }
  }

  // Public methods
  getBrain(): EvaBrain {
    return this.brain;
  }

  async initialize(): Promise<void> {
    await whisperService.initialize();
    this.emit('initialized');
  }

  destroy(): void {
    whisperService.destroy();
    this.brain.removeAllListeners();
    this.removeAllListeners();
  }
}

// Register Eva as an A2A agent
export function registerEvaAgent(sessionId: string): EvaVoiceAgent {
  const evaAgent = new EvaVoiceAgent(sessionId);
  AgentRegistry.register(evaAgent);
  return evaAgent;
}