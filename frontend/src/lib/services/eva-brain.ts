// Eva's Multimodal AI Brain - Orchestrates Gemini Pro/Flash models with tool calling
import { models, geminiHelpers } from '@/lib/gemini/client';
import { AgentRegistry, AgentTask, a2aEvents } from '@/lib/agents/a2a-orchestrator';
import { firecrawl } from '@/lib/firecrawl/client';
import { supabase } from '@/lib/supabase/browser';
import { EventEmitter } from 'events';

// Eva's context and state management
export interface EvaContext {
  currentPage?: string;
  userPreferences?: any;
  conversationHistory: ConversationTurn[];
  activeTools: string[];
  sessionId: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
  result?: any;
}

// Available tools for Eva
export const availableTools = {
  search_web: {
    name: 'search_web',
    description: 'Search the web for current information using Firecrawl',
    parameters: {
      query: { type: 'string', description: 'Search query' },
      limit: { type: 'number', description: 'Number of results (default: 5)' }
    }
  },
  navigate_dashboard: {
    name: 'navigate_dashboard',
    description: 'Navigate to a specific page in the dashboard',
    parameters: {
      page: { type: 'string', description: 'Dashboard page path (e.g., /dashboard/deals)' }
    }
  },
  execute_workflow: {
    name: 'execute_workflow',
    description: 'Execute an A2A agent workflow',
    parameters: {
      workflowId: { type: 'string', description: 'Workflow identifier' },
      params: { type: 'object', description: 'Workflow parameters' }
    }
  },
  query_data: {
    name: 'query_data',
    description: 'Query application data from Supabase',
    parameters: {
      table: { type: 'string', description: 'Table name' },
      query: { type: 'object', description: 'Query parameters' }
    }
  },
  create_task: {
    name: 'create_task',
    description: 'Create a new task',
    parameters: {
      title: { type: 'string', description: 'Task title' },
      description: { type: 'string', description: 'Task description' },
      dueDate: { type: 'string', description: 'Due date (ISO format)' }
    }
  }
};

export class EvaBrain extends EventEmitter {
  private context: EvaContext;
  private modelSelection: 'pro' | 'flash' = 'flash'; // Default to flash for speed

  constructor(sessionId: string) {
    super();
    this.context = {
      sessionId,
      conversationHistory: [],
      activeTools: Object.keys(availableTools),
      currentPage: typeof window !== 'undefined' ? window.location.pathname : undefined
    };
  }

  // Process user input and generate response with tool calling
  async processInput(
    input: string, 
    options?: { 
      preferredModel?: 'pro' | 'flash';
      attachments?: Array<{
        type: 'image' | 'document';
        content: string; // base64 for images, text for documents
        mimeType: string;
        fileName?: string;
      }>;
    }
  ): Promise<string> {
    // Add user message to history
    this.addToHistory('user', input);

    // Determine model based on complexity
    this.modelSelection = options?.preferredModel || this.determineModel(input);
    
    // Build prompt with context and tools
    const systemPrompt = this.buildSystemPrompt();
    const toolsPrompt = this.buildToolsPrompt();
    
    let fullPrompt = `${systemPrompt}\n\n${toolsPrompt}\n\nUser: ${input}`;
    
    // Add attachment context if present
    if (options?.attachments && options.attachments.length > 0) {
      fullPrompt += '\n\nAttachments:';
      options.attachments.forEach((attachment, index) => {
        if (attachment.type === 'document') {
          fullPrompt += `\n\nDocument ${index + 1} (${attachment.fileName || 'Untitled'}):\n${attachment.content}`;
        } else {
          fullPrompt += `\n\n[Image ${index + 1}: ${attachment.fileName || 'Untitled'} attached]`;
        }
      });
    }
    
    fullPrompt += '\n\nAssistant:';

    try {
      // Generate response with selected model
      const model = this.modelSelection === 'pro' ? models.pro : models.flash;
      
      // Prepare content for multimodal input
      const content: any[] = [{ text: fullPrompt }];
      
      // Add images for multimodal processing
      if (options?.attachments) {
        options.attachments.forEach(attachment => {
          if (attachment.type === 'image') {
            content.push({
              inlineData: {
                mimeType: attachment.mimeType,
                data: attachment.content
              }
            });
          }
        });
      }
      
      const result = await model.generateContent(content);
      const response = result.response.text();

      // Parse and execute any tool calls
      const toolCalls = this.parseToolCalls(response);
      if (toolCalls.length > 0) {
        const toolResults = await this.executeTools(toolCalls);
        
        // Generate final response with tool results
        const finalPrompt = `${response}\n\nTool Results:\n${JSON.stringify(toolResults, null, 2)}\n\nFinal Response:`;
        const finalResult = await model.generateContent(finalPrompt);
        const finalResponse = finalResult.response.text();
        
        this.addToHistory('assistant', finalResponse, toolCalls);
        return finalResponse;
      }

      this.addToHistory('assistant', response);
      return response;
    } catch (error) {
      console.error('Eva Brain processing error:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // Execute tool calls
  private async executeTools(toolCalls: ToolCall[]): Promise<any[]> {
    const results = [];
    
    for (const toolCall of toolCalls) {
      try {
        this.emit('tool_execution_start', toolCall);
        
        switch (toolCall.name) {
          case 'search_web':
            toolCall.result = await this.searchWeb(toolCall.arguments);
            break;
            
          case 'navigate_dashboard':
            toolCall.result = await this.navigateDashboard(toolCall.arguments);
            break;
            
          case 'execute_workflow':
            toolCall.result = await this.executeWorkflow(toolCall.arguments);
            break;
            
          case 'query_data':
            toolCall.result = await this.queryData(toolCall.arguments);
            break;
            
          case 'create_task':
            toolCall.result = await this.createTask(toolCall.arguments);
            break;
            
          default:
            toolCall.result = { error: `Unknown tool: ${toolCall.name}` };
        }
        
        results.push(toolCall.result);
        this.emit('tool_execution_complete', toolCall);
      } catch (error) {
        toolCall.result = { error: error instanceof Error ? error.message : 'Tool execution failed' };
        results.push(toolCall.result);
        this.emit('tool_execution_error', { toolCall, error });
      }
    }
    
    return results;
  }

  // Tool implementations
  private async searchWeb(args: { query: string; limit?: number }) {
    const results = [];
    const limit = args.limit || 5;
    
    for await (const result of firecrawl.searchStream(args.query, { limit })) {
      results.push({
        title: result.title,
        url: result.url,
        content: result.content?.substring(0, 500) + '...'
      });
    }
    
    return results;
  }

  private async navigateDashboard(args: { page: string }) {
    if (typeof window !== 'undefined') {
      // Emit navigation event for tracking
      this.emit('page_navigation', args.page);
      window.location.href = args.page;
      return { success: true, navigatedTo: args.page };
    }
    return { error: 'Navigation not available in server context' };
  }

  private async executeWorkflow(args: { workflowId: string; params: any }) {
    // Execute through A2A system
    const task: AgentTask = {
      id: `eva-task-${Date.now()}`,
      type: 'workflow',
      params: args
    };
    
    // Emit to A2A system
    a2aEvents.emit('workflow:execute', task);
    
    return { success: true, taskId: task.id, status: 'initiated' };
  }

  private async queryData(args: { table: string; query: any }) {
    const { data, error } = await supabase
      .from(args.table)
      .select(args.query.select || '*')
      .match(args.query.match || {})
      .limit(args.query.limit || 10);
    
    if (error) throw error;
    return data;
  }

  private async createTask(args: { title: string; description?: string; dueDate?: string }) {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: args.title,
        description: args.description,
        due_date: args.dueDate,
        created_by: this.context.sessionId
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // Helper methods
  private determineModel(input: string): 'pro' | 'flash' {
    // Use Pro for complex queries
    const complexIndicators = [
      'analyze', 'explain', 'compare', 'evaluate', 'plan',
      'multiple', 'steps', 'detailed', 'comprehensive'
    ];
    
    const inputLower = input.toLowerCase();
    const isComplex = complexIndicators.some(indicator => inputLower.includes(indicator));
    
    return isComplex ? 'pro' : 'flash';
  }

  private buildSystemPrompt(): string {
    return `You are Eva, a multimodal AI assistant integrated into the EVA Assistant dashboard.
    
Current Context:
- Page: ${this.context.currentPage}
- Session: ${this.context.sessionId}
- Time: ${new Date().toISOString()}

Capabilities:
- Search the web for current information
- Navigate dashboard pages
- Execute workflows
- Query and modify data
- Create tasks and reminders

Respond naturally and conversationally while helping users accomplish their goals.`;
  }

  private buildToolsPrompt(): string {
    return `Available Tools:
${JSON.stringify(availableTools, null, 2)}

To use a tool, respond with:
<tool_call>
{
  "name": "tool_name",
  "arguments": { ... }
}
</tool_call>

You can call multiple tools in a single response.`;
  }

  private parseToolCalls(response: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    const regex = /<tool_call>(.*?)<\/tool_call>/gs;
    let match;
    
    while ((match = regex.exec(response)) !== null) {
      try {
        const toolData = JSON.parse(match[1]);
        toolCalls.push({
          id: `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: toolData.name,
          arguments: toolData.arguments
        });
      } catch (error) {
        console.error('Failed to parse tool call:', error);
      }
    }
    
    return toolCalls;
  }

  private addToHistory(role: 'user' | 'assistant' | 'system', content: string, toolCalls?: ToolCall[]) {
    this.context.conversationHistory.push({
      role,
      content,
      timestamp: Date.now(),
      toolCalls
    });
    
    // Keep only last 20 turns
    if (this.context.conversationHistory.length > 20) {
      this.context.conversationHistory = this.context.conversationHistory.slice(-20);
    }
  }

  // Process voice command with attachments
  async processVoiceCommand(
    command: string,
    attachments?: Array<{
      type: 'image' | 'document';
      content: string;
      mimeType: string;
      fileName?: string;
    }>
  ): Promise<{ response: string; tools?: ToolCall[] }> {
    const response = await this.processInput(command, { attachments });
    const lastTurn = this.context.conversationHistory[this.context.conversationHistory.length - 1];
    
    return {
      response,
      tools: lastTurn?.toolCalls
    };
  }

  // Public methods
  getContext(): EvaContext {
    return this.context;
  }

  setCurrentPage(page: string) {
    this.context.currentPage = page;
  }

  clearHistory() {
    this.context.conversationHistory = [];
  }
}