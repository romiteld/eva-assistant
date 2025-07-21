// Eva's Multimodal AI Brain - Master Orchestrator of all A2A Agents
// Eva is the central intelligence that controls and coordinates all specialized agents
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

// Available tools for Eva - Master Brain capabilities
export const availableTools = {
  search_web: {
    name: 'search_web',
    description: 'Search the web for current information, news, updates, or any online content using Firecrawl',
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
    description: 'Master orchestration tool - Delegate tasks to specialized agents or execute multi-agent workflows. Use this when you need to leverage specialized agents like Deep Thinking, Lead Generation, Content Creation, Document Processing, etc.',
    parameters: {
      workflowId: { type: 'string', description: 'Workflow identifier or agent name (e.g., "deep-thinking", "lead-generation", "content-studio", "document-processing")' },
      params: { type: 'object', description: 'Parameters for the workflow/agent including task details, context, and requirements' }
    }
  },
  query_data: {
    name: 'query_data',
    description: 'Query application data from Supabase including tasks, emails, candidates, deals, etc.',
    parameters: {
      table: { type: 'string', description: 'Table name (e.g., tasks, emails, candidates, deals)' },
      query: { type: 'object', description: 'Query parameters including filters, sorting, and limits' }
    }
  },
  create_task: {
    name: 'create_task',
    description: 'Create a new task with full details',
    parameters: {
      title: { type: 'string', description: 'Task title' },
      description: { type: 'string', description: 'Task description' },
      dueDate: { type: 'string', description: 'Due date (ISO format)' },
      priority: { type: 'string', description: 'Priority level (low, medium, high)' },
      assignee: { type: 'string', description: 'Assignee email or ID (optional)' }
    }
  },
  update_task: {
    name: 'update_task',
    description: 'Update an existing task',
    parameters: {
      taskId: { type: 'string', description: 'Task ID to update' },
      updates: { type: 'object', description: 'Object containing fields to update (title, description, status, priority, etc.)' }
    }
  },
  read_emails: {
    name: 'read_emails',
    description: 'Read emails from inbox or specific folders',
    parameters: {
      folder: { type: 'string', description: 'Email folder (inbox, sent, drafts, etc.)' },
      limit: { type: 'number', description: 'Number of emails to retrieve (default: 10)' },
      unreadOnly: { type: 'boolean', description: 'Only fetch unread emails (default: false)' }
    }
  },
  write_email: {
    name: 'write_email',
    description: 'Compose and send an email',
    parameters: {
      to: { type: 'string', description: 'Recipient email address' },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Email body content' },
      cc: { type: 'string', description: 'CC recipients (optional)' },
      isDraft: { type: 'boolean', description: 'Save as draft instead of sending (default: false)' }
    }
  },
  monitor_updates: {
    name: 'monitor_updates',
    description: 'Monitor for real-time updates on specific topics, websites, or data sources',
    parameters: {
      topic: { type: 'string', description: 'Topic or keyword to monitor' },
      sources: { type: 'array', description: 'Specific sources to monitor (optional)' },
      frequency: { type: 'string', description: 'Update frequency (realtime, hourly, daily)' }
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
            
          case 'update_task':
            toolCall.result = await this.updateTask(toolCall.arguments);
            break;
            
          case 'read_emails':
            toolCall.result = await this.readEmails(toolCall.arguments);
            break;
            
          case 'write_email':
            toolCall.result = await this.writeEmail(toolCall.arguments);
            break;
            
          case 'monitor_updates':
            toolCall.result = await this.monitorUpdates(toolCall.arguments);
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
    try {
      // Check if API key is configured
      if (!process.env.NEXT_PUBLIC_FIRECRAWL_API_KEY) {
        console.warn('Firecrawl API key not configured, using fallback search');
        return this.fallbackSearch(args);
      }

      // Detect financial data queries
      const queryLower = args.query.toLowerCase();
      const isFinancialQuery = /\b(price|stock|crypto|bitcoin|btc|ethereum|eth|xrp|market|trading)\b/.test(queryLower);
      
      if (isFinancialQuery) {
        // Delegate financial queries to specialized agent
        return await this.delegateFinancialSearch(args);
      }

      // Regular web search using Firecrawl
      const results = [];
      const limit = args.limit || 5;
      
      try {
        for await (const result of firecrawl.searchStream(args.query, { limit })) {
          results.push({
            title: result.title || 'No title',
            url: result.url || '',
            content: result.content?.substring(0, 500) + '...' || 'No content available'
          });
        }
      } catch (firecrawlError) {
        console.error('Firecrawl search error:', firecrawlError);
        // Fallback to basic search
        return this.fallbackSearch(args);
      }
      
      if (results.length === 0) {
        return [{
          title: 'No results found',
          url: '',
          content: `I couldn't find any results for "${args.query}". Try rephrasing your search or being more specific.`
        }];
      }
      
      return results;
    } catch (error) {
      console.error('Search web error:', error);
      return [{
        title: 'Search Error',
        url: '',
        content: `I encountered an error while searching. Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }];
    }
  }

  // Fallback search implementation
  private async fallbackSearch(args: { query: string; limit?: number }) {
    // For now, return a helpful message
    // In production, this could use an alternative search API
    return [{
      title: 'Search Capability Limited',
      url: '',
      content: `I'm currently unable to perform web searches. For real-time information like cryptocurrency prices, financial data, or current news, please check trusted sources directly. I can help with many other tasks like creating tasks, managing emails, and analyzing documents.`
    }];
  }

  // Delegate financial searches to specialized handling
  private async delegateFinancialSearch(args: { query: string; limit?: number }) {
    const queryLower = args.query.toLowerCase();
    
    // Extract cryptocurrency symbols
    const cryptoSymbols = {
      'bitcoin': 'BTC',
      'btc': 'BTC',
      'ethereum': 'ETH',
      'eth': 'ETH',
      'xrp': 'XRP',
      'ripple': 'XRP',
      'cardano': 'ADA',
      'solana': 'SOL',
      'dogecoin': 'DOGE'
    };
    
    let detectedCrypto = null;
    for (const [key, symbol] of Object.entries(cryptoSymbols)) {
      if (queryLower.includes(key)) {
        detectedCrypto = symbol;
        break;
      }
    }
    
    if (detectedCrypto) {
      return [{
        title: `${detectedCrypto} Price Information`,
        url: `https://www.coingecko.com/en/coins/${detectedCrypto.toLowerCase()}`,
        content: `For real-time ${detectedCrypto} price information, I recommend checking CoinGecko, Binance, or CoinMarketCap. Due to the volatile nature of cryptocurrency prices, it's best to check these sources directly for the most accurate, up-to-date pricing.`
      }];
    }
    
    // General financial query response
    return [{
      title: 'Financial Information Request',
      url: '',
      content: `For real-time financial data including stock prices, crypto prices, and market information, please check trusted financial platforms like Bloomberg, Yahoo Finance, CoinGecko, or your preferred trading platform. I can help you create tasks to track these or set up monitoring for specific financial events.`
    }];
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
    // Master orchestration logic - Eva decides how to delegate
    const workflowId = args.workflowId.toLowerCase();
    
    // Map common workflow IDs to agent types
    const agentMapping: Record<string, string> = {
      'deep-thinking': 'deep-thinking-orchestrator',
      'lead-generation': 'lead-generation-agent',
      'content-studio': 'ai-content-studio',
      'document-processing': 'process-document',
      'rag-query': 'rag-agent',
      'web-search': 'firecrawl-agent',
      'linkedin-enrichment': 'linkedin-enrichment',
      'interview-center': 'interview-center',
      'resume-parser': 'resume-parser-pipeline',
      'error-logging': 'error-logger',
      'queue-processing': 'queue-processor',
      'email-agent': 'email-management',
      'outlook-integration': 'microsoft-graph-agent',
      'monitoring-agent': 'real-time-monitor',
      'update-tracker': 'web-monitor-agent'
    };
    
    const selectedAgent = agentMapping[workflowId] || workflowId;
    
    // Create orchestrated task
    const task: AgentTask = {
      id: `eva-orchestrated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: workflowId.includes('search') ? 'search' : 
            workflowId.includes('analyze') ? 'analyze' :
            workflowId.includes('generate') ? 'generate' : 'workflow',
      params: {
        ...args.params,
        agentId: selectedAgent,
        orchestratedBy: 'eva-master-brain',
        context: {
          sessionId: this.context.sessionId,
          currentPage: this.context.currentPage,
          timestamp: new Date().toISOString()
        }
      }
    };
    
    // Log orchestration decision
    this.emit('orchestration_decision', {
      workflowId,
      selectedAgent,
      task
    });
    
    // Execute through appropriate channel
    if (selectedAgent === 'deep-thinking-orchestrator') {
      // Deep thinking requires special handling
      a2aEvents.emit('deep-thinking:execute', task);
    } else if (selectedAgent.includes('firecrawl')) {
      // Web operations go through firecrawl
      a2aEvents.emit('firecrawl:execute', task);
    } else {
      // General workflow execution
      a2aEvents.emit('workflow:execute', task);
    }
    
    return { 
      success: true, 
      taskId: task.id, 
      status: 'orchestrated',
      agent: selectedAgent,
      message: `Task delegated to ${selectedAgent} for execution`
    };
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

  private async createTask(args: { title: string; description?: string; dueDate?: string; priority?: string; assignee?: string }) {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: args.title,
        description: args.description,
        due_date: args.dueDate,
        priority: args.priority || 'medium',
        assignee: args.assignee,
        created_by: this.context.sessionId,
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  private async updateTask(args: { taskId: string; updates: any }) {
    const { data, error } = await supabase
      .from('tasks')
      .update(args.updates)
      .eq('id', args.taskId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  private async readEmails(args: { folder?: string; limit?: number; unreadOnly?: boolean }) {
    // Delegate to email agent through workflow
    const emailTask: AgentTask = {
      id: `eva-email-read-${Date.now()}`,
      type: 'read_emails',
      params: {
        folder: args.folder || 'inbox',
        limit: args.limit || 10,
        unreadOnly: args.unreadOnly || false,
        userId: this.context.sessionId
      }
    };
    
    // Use Microsoft Graph API integration
    a2aEvents.emit('email:read', emailTask);
    
    // For now, return mock data - in production, this would connect to email service
    return {
      emails: [
        {
          id: '1',
          subject: 'Meeting Tomorrow',
          from: 'john@example.com',
          date: new Date().toISOString(),
          preview: 'Don\'t forget about our meeting tomorrow at 2 PM...',
          unread: true
        }
      ],
      total: 1,
      folder: args.folder || 'inbox'
    };
  }

  private async writeEmail(args: { to: string; subject: string; body: string; cc?: string; isDraft?: boolean }) {
    // Delegate to email agent through workflow
    const emailTask: AgentTask = {
      id: `eva-email-write-${Date.now()}`,
      type: 'write_email',
      params: {
        to: args.to,
        subject: args.subject,
        body: args.body,
        cc: args.cc,
        isDraft: args.isDraft || false,
        userId: this.context.sessionId
      }
    };
    
    // Use Microsoft Graph API integration
    a2aEvents.emit('email:write', emailTask);
    
    return {
      success: true,
      messageId: `msg-${Date.now()}`,
      status: args.isDraft ? 'drafted' : 'sent',
      sentAt: args.isDraft ? null : new Date().toISOString()
    };
  }

  private async monitorUpdates(args: { topic: string; sources?: string[]; frequency?: string }) {
    // Create monitoring task for continuous updates
    const monitorTask: AgentTask = {
      id: `eva-monitor-${Date.now()}`,
      type: 'monitor',
      params: {
        topic: args.topic,
        sources: args.sources || [],
        frequency: args.frequency || 'hourly',
        userId: this.context.sessionId
      }
    };
    
    // Set up monitoring through Firecrawl and other agents
    a2aEvents.emit('monitor:create', monitorTask);
    
    return {
      success: true,
      monitorId: monitorTask.id,
      topic: args.topic,
      frequency: args.frequency || 'hourly',
      status: 'monitoring_active',
      message: `Now monitoring "${args.topic}" for updates. You'll be notified when new information is available.`
    };
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
    return `You are Eva, the Master AI Brain orchestrating all A2A (Agent-to-Agent) operations in the EVA Assistant ecosystem.

MASTER ORCHESTRATOR ROLE:
You are the central intelligence that controls and coordinates all specialized agents. You don't just execute tasks - you strategically delegate to the right agents based on their capabilities and the user's needs.

AVAILABLE SPECIALIZED AGENTS:
1. Deep Thinking Orchestrator - Complex reasoning with 5 parallel sub-agents
2. Lead Generation Agent - Automated lead discovery and qualification
3. AI Content Studio - Content creation and optimization
4. Resume Parser Pipeline - Document analysis and extraction
5. Interview Center - Interview scheduling and management
6. LinkedIn Enrichment - Profile data enrichment
7. Firecrawl Agent - Web scraping and search
8. Gemini Agent - AI analysis and generation
9. RAG Agent - Knowledge base queries
10. Document Processing Agent - PDF/document analysis
11. Error Logger Agent - System monitoring
12. Queue Processing Agent - Async task management

Current Context:
- Page: ${this.context.currentPage}
- Session: ${this.context.sessionId}
- Time: ${new Date().toISOString()}

ORCHESTRATION STRATEGY:
1. Analyze user intent and complexity
2. Identify which agents are best suited for the task
3. Delegate to specialized agents for execution
4. Coordinate multi-agent workflows when needed
5. Synthesize results from multiple agents

CORE CAPABILITIES:
- Read and write emails through Microsoft Graph integration
- Monitor real-time updates on any topic from the web
- Create, update, and manage tasks with full lifecycle control
- Search the web for current information and news
- Query and analyze data from multiple sources
- Execute complex multi-agent workflows
- Navigate and control the dashboard interface

As the master brain, you have complete control over all agents and can:
- Execute simple tasks directly
- Delegate complex tasks to specialized agents
- Orchestrate multi-agent workflows
- Monitor agent performance
- Ensure optimal task completion
- Maintain context across all operations

Respond with authority and confidence as the central intelligence of the system.`;
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
  ): Promise<{ 
    response: string; 
    toolExecutions?: Array<{
      toolName: string;
      status: 'success' | 'error';
      result: any;
    }>;
  }> {
    try {
      const response = await this.processInput(command, { attachments });
      const lastTurn = this.context.conversationHistory[this.context.conversationHistory.length - 1];
      
      // Transform tool calls to tool executions format
      const toolExecutions = lastTurn?.toolCalls?.map(toolCall => ({
        toolName: toolCall.name,
        status: (toolCall.result?.error ? 'error' : 'success') as 'success' | 'error',
        result: toolCall.result
      })) || [];
      
      return {
        response,
        toolExecutions
      };
    } catch (error) {
      console.error('Eva Brain voice command error:', error);
      return {
        response: 'I apologize, but I encountered an error processing your request. Please try again.',
        toolExecutions: []
      };
    }
  }

  // Master orchestration intelligence
  private analyzeTaskComplexity(input: string): {
    complexity: 'simple' | 'moderate' | 'complex';
    suggestedAgents: string[];
    reasoning: string;
  } {
    const inputLower = input.toLowerCase();
    
    // Analyze for deep thinking needs
    if (inputLower.includes('analyze') && inputLower.includes('complex') ||
        inputLower.includes('think deeply') || inputLower.includes('comprehensive analysis')) {
      return {
        complexity: 'complex',
        suggestedAgents: ['deep-thinking-orchestrator'],
        reasoning: 'Complex analysis requiring deep thinking with multiple perspectives'
      };
    }
    
    // Document processing
    if (inputLower.includes('resume') || inputLower.includes('pdf') || inputLower.includes('document')) {
      return {
        complexity: 'moderate',
        suggestedAgents: ['resume-parser-pipeline', 'process-document'],
        reasoning: 'Document analysis and extraction task'
      };
    }
    
    // Lead generation
    if (inputLower.includes('lead') || inputLower.includes('prospect') || inputLower.includes('find candidates')) {
      return {
        complexity: 'moderate',
        suggestedAgents: ['lead-generation-agent', 'linkedin-enrichment'],
        reasoning: 'Lead discovery and qualification task'
      };
    }
    
    // Content creation
    if (inputLower.includes('write') || inputLower.includes('content') || inputLower.includes('blog') || 
        inputLower.includes('linkedin post')) {
      return {
        complexity: 'moderate',
        suggestedAgents: ['ai-content-studio'],
        reasoning: 'Content creation and optimization task'
      };
    }
    
    // Web search and research
    if (inputLower.includes('search') || inputLower.includes('find information') || inputLower.includes('research')) {
      return {
        complexity: 'simple',
        suggestedAgents: ['firecrawl-agent'],
        reasoning: 'Web search and information gathering task'
      };
    }
    
    // Email operations
    if (inputLower.includes('email') || inputLower.includes('inbox') || inputLower.includes('send message')) {
      return {
        complexity: 'simple',
        suggestedAgents: ['email-management', 'microsoft-graph-agent'],
        reasoning: 'Email management task requiring Microsoft Graph integration'
      };
    }
    
    // Monitoring and updates
    if (inputLower.includes('monitor') || inputLower.includes('track updates') || inputLower.includes('notify me when')) {
      return {
        complexity: 'moderate',
        suggestedAgents: ['real-time-monitor', 'web-monitor-agent'],
        reasoning: 'Real-time monitoring task requiring continuous tracking'
      };
    }
    
    // Task management
    if (inputLower.includes('task') || inputLower.includes('todo') || inputLower.includes('reminder')) {
      return {
        complexity: 'simple',
        suggestedAgents: [],
        reasoning: 'Task management can be handled directly by Eva'
      };
    }
    
    // Default simple task
    return {
      complexity: 'simple',
      suggestedAgents: [],
      reasoning: 'Simple task that can be handled directly'
    };
  }

  // Get available agents and their capabilities
  getAvailableAgents(): Array<{
    id: string;
    name: string;
    capabilities: string[];
    description: string;
  }> {
    return [
      {
        id: 'deep-thinking-orchestrator',
        name: 'Deep Thinking Orchestrator',
        capabilities: ['complex-analysis', 'multi-perspective-thinking', 'strategic-planning'],
        description: 'Handles complex reasoning with 5 parallel sub-agents for comprehensive analysis'
      },
      {
        id: 'lead-generation-agent',
        name: 'Lead Generation Agent',
        capabilities: ['lead-discovery', 'qualification', 'outreach'],
        description: 'Automates lead discovery and qualification processes'
      },
      {
        id: 'ai-content-studio',
        name: 'AI Content Studio',
        capabilities: ['content-creation', 'optimization', 'social-media'],
        description: 'Creates and optimizes content for various platforms'
      },
      {
        id: 'resume-parser-pipeline',
        name: 'Resume Parser Pipeline',
        capabilities: ['document-parsing', 'data-extraction', 'candidate-analysis'],
        description: 'Processes resumes and extracts structured data'
      },
      {
        id: 'firecrawl-agent',
        name: 'Web Intelligence Agent',
        capabilities: ['web-search', 'scraping', 'data-extraction'],
        description: 'Searches and extracts information from the web'
      },
      {
        id: 'email-management',
        name: 'Email Management Agent',
        capabilities: ['read-emails', 'write-emails', 'manage-inbox', 'draft-emails'],
        description: 'Manages email operations through Microsoft Graph API'
      },
      {
        id: 'real-time-monitor',
        name: 'Real-Time Monitor Agent',
        capabilities: ['monitor-updates', 'track-changes', 'send-alerts', 'continuous-monitoring'],
        description: 'Monitors web sources and data for real-time updates'
      },
      {
        id: 'task-manager',
        name: 'Task Management Agent',
        capabilities: ['create-tasks', 'update-tasks', 'track-progress', 'manage-reminders'],
        description: 'Manages tasks, todos, and reminders with full lifecycle control'
      }
    ];
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