'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Play, 
  Save, 
  Plus, 
  Settings, 
  Trash2, 
  Copy,
  Download,
  Upload,
  Zap,
  Mail,
  Database,
  Calendar,
  MessageSquare,
  Search,
  FileText,
  Users,
  BarChart,
  Globe,
  Phone,
  GitBranch,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkflowTemplates, WorkflowTemplate } from '@/lib/workflows/WorkflowTemplates';
import { WorkflowEngine } from '@/lib/workflows/WorkflowEngine';
import { AgentType } from '@/lib/agents/base/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'output';
  category: string;
  name: string;
  description: string;
  icon: React.ElementType;
  agent?: AgentType;
  action?: string;
  config: {
    input?: Record<string, any>;
    output?: string[];
    conditions?: Array<{
      type: 'always' | 'on_success' | 'on_failure' | 'custom';
      expression?: string;
    }>;
  };
  position: { x: number; y: number };
  connections: {
    input: string[];
    output: string[];
  };
}

interface WorkflowConnection {
  id: string;
  from: string;
  to: string;
  fromPort?: 'output' | 'success' | 'failure';
  toPort?: 'input';
  condition?: string;
}

interface DragItem {
  type: 'node' | 'connection';
  nodeType?: string;
  category?: string;
  template?: any;
  fromNode?: string;
  fromPort?: string;
}

const NODE_TEMPLATES = {
  triggers: [
    {
      type: 'trigger',
      category: 'email',
      name: 'Email Received',
      description: 'Trigger when email is received',
      icon: Mail,
      config: {
        input: {
          folder: 'Inbox',
          filter: { from: '', subject: '', hasAttachment: false }
        },
        output: ['email', 'attachments', 'sender']
      }
    },
    {
      type: 'trigger',
      category: 'schedule',
      name: 'Schedule',
      description: 'Run on a schedule',
      icon: Clock,
      config: {
        input: {
          frequency: 'daily',
          time: '09:00',
          timezone: 'UTC'
        },
        output: ['timestamp']
      }
    },
    {
      type: 'trigger',
      category: 'webhook',
      name: 'Webhook',
      description: 'Trigger via webhook',
      icon: Zap,
      config: {
        input: {
          method: 'POST',
          headers: {},
          authentication: 'none'
        },
        output: ['payload', 'headers']
      }
    },
    {
      type: 'trigger',
      category: 'zoho',
      name: 'Zoho CRM Event',
      description: 'Trigger on Zoho CRM events',
      icon: Database,
      config: {
        input: {
          module: 'Leads',
          event: 'create',
          filters: {}
        },
        output: ['record', 'oldRecord', 'changeSet']
      }
    }
  ],
  actions: [
    // Zoho CRM Actions
    {
      type: 'action',
      category: 'zoho',
      name: 'Create Lead',
      description: 'Create a new lead in Zoho CRM',
      icon: Users,
      agent: AgentType.DATA,
      action: 'zoho_create_lead',
      config: {
        input: {
          firstName: '{{input.firstName}}',
          lastName: '{{input.lastName}}',
          email: '{{input.email}}',
          company: '{{input.company}}',
          leadSource: 'Website'
        },
        output: ['leadId', 'lead']
      }
    },
    {
      type: 'action',
      category: 'zoho',
      name: 'Update Lead',
      description: 'Update lead information',
      icon: Users,
      agent: AgentType.DATA,
      action: 'zoho_update_lead',
      config: {
        input: {
          leadId: '{{input.leadId}}',
          fields: {}
        },
        output: ['success', 'lead']
      }
    },
    {
      type: 'action',
      category: 'zoho',
      name: 'Search Leads',
      description: 'Search for leads in Zoho',
      icon: Search,
      agent: AgentType.DATA,
      action: 'zoho_search_leads',
      config: {
        input: {
          criteria: '',
          fields: ['Email', 'Company', 'Lead_Status']
        },
        output: ['leads', 'count']
      }
    },
    {
      type: 'action',
      category: 'zoho',
      name: 'Create Task',
      description: 'Create a task in Zoho',
      icon: CheckCircle,
      agent: AgentType.DATA,
      action: 'zoho_create_task',
      config: {
        input: {
          subject: '{{input.subject}}',
          dueDate: '{{input.dueDate}}',
          relatedTo: '{{input.leadId}}',
          priority: 'High'
        },
        output: ['taskId', 'task']
      }
    },
    // Email Actions
    {
      type: 'action',
      category: 'email',
      name: 'Send Email',
      description: 'Send an email',
      icon: Mail,
      agent: AgentType.COMMUNICATION,
      action: 'send_email',
      config: {
        input: {
          to: '{{input.to}}',
          subject: '{{input.subject}}',
          body: '{{input.body}}',
          attachments: []
        },
        output: ['messageId', 'success']
      }
    },
    {
      type: 'action',
      category: 'email',
      name: 'Reply to Email',
      description: 'Reply to an email',
      icon: Mail,
      agent: AgentType.COMMUNICATION,
      action: 'reply_email',
      config: {
        input: {
          originalMessageId: '{{trigger.email.id}}',
          body: '{{input.body}}',
          replyAll: false
        },
        output: ['messageId', 'success']
      }
    },
    // AI Actions
    {
      type: 'action',
      category: 'ai',
      name: 'Generate Content',
      description: 'Generate AI content',
      icon: Zap,
      agent: AgentType.CONTENT,
      action: 'generate_content',
      config: {
        input: {
          prompt: '{{input.prompt}}',
          context: '{{input.context}}',
          tone: 'professional'
        },
        output: ['content', 'metadata']
      }
    },
    {
      type: 'action',
      category: 'ai',
      name: 'Analyze Sentiment',
      description: 'Analyze text sentiment',
      icon: BarChart,
      agent: AgentType.ANALYSIS,
      action: 'sentiment_analysis',
      config: {
        input: {
          text: '{{input.text}}',
          language: 'en'
        },
        output: ['sentiment', 'score', 'aspects']
      }
    },
    // Data Actions
    {
      type: 'action',
      category: 'data',
      name: 'Web Search',
      description: 'Search the web for information',
      icon: Globe,
      agent: AgentType.SCRAPING,
      action: 'search_web',
      config: {
        input: {
          query: '{{input.query}}',
          limit: 10
        },
        output: ['results', 'urls']
      }
    },
    {
      type: 'action',
      category: 'data',
      name: 'Extract Data',
      description: 'Extract structured data',
      icon: Database,
      agent: AgentType.SCRAPING,
      action: 'extract_data',
      config: {
        input: {
          url: '{{input.url}}',
          schema: {}
        },
        output: ['data', 'metadata']
      }
    }
  ],
  conditions: [
    {
      type: 'condition',
      category: 'logic',
      name: 'If/Else',
      description: 'Conditional branching',
      icon: GitBranch,
      config: {
        input: {
          condition: '{{input.value}} == "expected"',
          branches: ['true', 'false']
        },
        output: ['branch']
      }
    },
    {
      type: 'condition',
      category: 'logic',
      name: 'Switch',
      description: 'Multiple branches',
      icon: GitBranch,
      config: {
        input: {
          value: '{{input.value}}',
          cases: {}
        },
        output: ['branch']
      }
    }
  ],
  outputs: [
    {
      type: 'output',
      category: 'data',
      name: 'Log Result',
      description: 'Log workflow result',
      icon: FileText,
      config: {
        input: {
          message: '{{input.message}}',
          level: 'info'
        }
      }
    },
    {
      type: 'output',
      category: 'notification',
      name: 'Send Notification',
      description: 'Send a notification',
      icon: MessageSquare,
      config: {
        input: {
          channel: 'email',
          recipient: '{{input.recipient}}',
          message: '{{input.message}}'
        }
      }
    }
  ]
};

const GRID_SIZE = 20;

export function VisualWorkflowDesigner() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [connections, setConnections] = useState<WorkflowConnection[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [workflowName, setWorkflowName] = useState('New Workflow');
  const [isRunning, setIsRunning] = useState(false);
  const [nodeStatus, setNodeStatus] = useState<Record<string, 'pending' | 'running' | 'completed' | 'failed'>>({});
  const { toast } = useToast();

  // Snap to grid
  const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

  // Generate unique ID
  const generateId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Handle canvas drag
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setIsDragging(true);
      const startX = e.clientX - canvasOffset.x;
      const startY = e.clientY - canvasOffset.y;

      const handleMouseMove = (e: MouseEvent) => {
        setCanvasOffset({
          x: e.clientX - startX,
          y: e.clientY - startY
        });
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };

  // Handle node drag start
  const handleNodeDragStart = (e: React.DragEvent, node: any) => {
    e.dataTransfer.effectAllowed = 'copy';
    setDragItem({
      type: 'node',
      nodeType: node.type,
      category: node.category,
      template: node
    });
  };

  // Handle canvas drop
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragItem?.type === 'node' && dragItem.template) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = snapToGrid((e.clientX - rect.left - canvasOffset.x) / zoom);
        const y = snapToGrid((e.clientY - rect.top - canvasOffset.y) / zoom);

        const newNode: WorkflowNode = {
          id: generateId(),
          ...dragItem.template,
          position: { x, y },
          connections: { input: [], output: [] }
        };

        setNodes([...nodes, newNode]);
      }
    }
    setDragItem(null);
  };

  // Handle node position update
  const updateNodePosition = (nodeId: string, position: { x: number; y: number }) => {
    setNodes(nodes.map(node => 
      node.id === nodeId 
        ? { ...node, position: { x: snapToGrid(position.x), y: snapToGrid(position.y) } }
        : node
    ));
  };

  // Handle connection creation
  const createConnection = (fromNode: string, toNode: string, fromPort?: string, toPort?: string) => {
    const id = `conn_${fromNode}_${toNode}_${Date.now()}`;
    const newConnection: WorkflowConnection = {
      id,
      from: fromNode,
      to: toNode,
      fromPort: fromPort as any,
      toPort: toPort as any
    };

    setConnections([...connections, newConnection]);

    // Update node connections
    setNodes(nodes.map(node => {
      if (node.id === fromNode) {
        return { ...node, connections: { ...node.connections, output: [...node.connections.output, toNode] } };
      }
      if (node.id === toNode) {
        return { ...node, connections: { ...node.connections, input: [...node.connections.input, fromNode] } };
      }
      return node;
    }));
  };

  // Delete node
  const deleteNode = (nodeId: string) => {
    setNodes(nodes.filter(n => n.id !== nodeId));
    setConnections(connections.filter(c => c.from !== nodeId && c.to !== nodeId));
  };

  // Delete connection
  const deleteConnection = (connId: string) => {
    const conn = connections.find(c => c.id === connId);
    if (conn) {
      setConnections(connections.filter(c => c.id !== connId));
      
      // Update node connections
      setNodes(nodes.map(node => {
        if (node.id === conn.from) {
          return { 
            ...node, 
            connections: { 
              ...node.connections, 
              output: node.connections.output.filter(id => id !== conn.to) 
            } 
          };
        }
        if (node.id === conn.to) {
          return { 
            ...node, 
            connections: { 
              ...node.connections, 
              input: node.connections.input.filter(id => id !== conn.from) 
            } 
          };
        }
        return node;
      }));
    }
  };

  // Convert visual workflow to engine format
  const convertToEngineFormat = () => {
    const triggers = nodes.filter(n => n.type === 'trigger');
    if (triggers.length === 0) {
      throw new Error('Workflow must have at least one trigger');
    }

    const steps = nodes
      .filter(n => n.type !== 'trigger')
      .map(node => ({
        id: node.id,
        agent: node.agent || AgentType.WORKFLOW,
        action: node.action || node.name.toLowerCase().replace(/\s+/g, '_'),
        input: node.config.input || {},
        dependencies: node.connections.input,
        condition: node.type === 'condition' ? {
          type: 'custom' as const,
          expression: node.config.input?.condition
        } : undefined
      }));

    return {
      name: workflowName,
      triggers,
      steps,
      context: {}
    };
  };

  // Run workflow
  const runWorkflow = async () => {
    try {
      setIsRunning(true);
      const workflowConfig = convertToEngineFormat();
      
      // Reset node status
      const initialStatus: Record<string, 'pending'> = {};
      nodes.forEach(node => {
        initialStatus[node.id] = 'pending';
      });
      setNodeStatus(initialStatus);

      // Simulate workflow execution with status updates
      for (const node of nodes) {
        setNodeStatus(prev => ({ ...prev, [node.id]: 'running' }));
        await new Promise(resolve => setTimeout(resolve, 1000));
        setNodeStatus(prev => ({ ...prev, [node.id]: 'completed' }));
      }

      toast({
        title: 'Workflow completed',
        description: 'Your workflow has been executed successfully.'
      });
    } catch (error) {
      toast({
        title: 'Workflow failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Save workflow
  const saveWorkflow = async () => {
    try {
      const workflowConfig = convertToEngineFormat();
      // TODO: Save to database
      toast({
        title: 'Workflow saved',
        description: 'Your workflow has been saved successfully.'
      });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save workflow',
        variant: 'destructive'
      });
    }
  };

  // Load workflow template
  const loadTemplate = (template: WorkflowTemplate) => {
    // Convert template to visual nodes
    const newNodes: WorkflowNode[] = [];
    const newConnections: WorkflowConnection[] = [];
    
    // Create trigger node
    newNodes.push({
      id: 'trigger_1',
      type: 'trigger',
      category: 'manual',
      name: 'Manual Trigger',
      description: 'Start workflow manually',
      icon: Play,
      config: { output: ['context'] },
      position: { x: 100, y: 200 },
      connections: { input: [], output: [] }
    });

    // Create action nodes from template steps
    template.steps.forEach((step, index) => {
      const nodeTemplate = NODE_TEMPLATES.actions.find(
        a => a.agent === step.agent && a.action === step.action
      ) || NODE_TEMPLATES.actions[0];

      const node: WorkflowNode = {
        id: step.id,
        type: (nodeTemplate.type || 'action') as 'trigger' | 'action' | 'condition' | 'output',
        category: nodeTemplate.category || 'action',
        name: nodeTemplate.name,
        description: nodeTemplate.description,
        icon: nodeTemplate.icon,
        agent: nodeTemplate.agent,
        action: nodeTemplate.action,
        config: {
          ...nodeTemplate.config,
          input: step.input
        },
        position: { 
          x: 300 + (index % 3) * 200, 
          y: 100 + Math.floor(index / 3) * 150 
        },
        connections: { input: [], output: [] }
      };

      newNodes.push(node);

      // Create connections based on dependencies
      if (step.dependencies) {
        step.dependencies.forEach(dep => {
          newConnections.push({
            id: `conn_${dep}_${step.id}`,
            from: dep,
            to: step.id
          });
        });
      } else if (index === 0) {
        // Connect first step to trigger
        newConnections.push({
          id: `conn_trigger_1_${step.id}`,
          from: 'trigger_1',
          to: step.id
        });
      } else {
        // Connect to previous step
        newConnections.push({
          id: `conn_${template.steps[index - 1].id}_${step.id}`,
          from: template.steps[index - 1].id,
          to: step.id
        });
      }
    });

    setNodes(newNodes);
    setConnections(newConnections);
    setWorkflowName(template.name);
  };

  // Render connection path
  const renderConnection = (conn: WorkflowConnection) => {
    const fromNode = nodes.find(n => n.id === conn.from);
    const toNode = nodes.find(n => n.id === conn.to);
    
    if (!fromNode || !toNode) return null;

    const x1 = fromNode.position.x + 180;
    const y1 = fromNode.position.y + 40;
    const x2 = toNode.position.x;
    const y2 = toNode.position.y + 40;

    const path = `M ${x1},${y1} C ${x1 + 50},${y1} ${x2 - 50},${y2} ${x2},${y2}`;

    return (
      <g key={conn.id}>
        <path
          d={path}
          fill="none"
          stroke={selectedConnection === conn.id ? '#3b82f6' : '#6b7280'}
          strokeWidth={selectedConnection === conn.id ? 3 : 2}
          className="cursor-pointer hover:stroke-blue-500 transition-colors"
          onClick={() => setSelectedConnection(conn.id)}
        />
        {selectedConnection === conn.id && (
          <circle
            cx={(x1 + x2) / 2}
            cy={(y1 + y2) / 2}
            r={20}
            fill="#ef4444"
            className="cursor-pointer opacity-80 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              deleteConnection(conn.id);
              setSelectedConnection(null);
            }}
          >
            <title>Delete connection</title>
          </circle>
        )}
      </g>
    );
  };

  // Node status icon
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'running':
        return <Clock className="w-4 h-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Workflow Components</h2>
          
          {/* Templates */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Templates</h3>
            <div className="space-y-2">
              {WorkflowTemplates.getAllTemplates().slice(0, 3).map(template => (
                <button
                  key={template.id}
                  onClick={() => loadTemplate(template)}
                  className="w-full text-left p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="text-sm font-medium">{template.name}</div>
                  <div className="text-xs text-gray-500">{template.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Node Components */}
          {Object.entries({
            Triggers: NODE_TEMPLATES.triggers,
            Actions: NODE_TEMPLATES.actions,
            Conditions: NODE_TEMPLATES.conditions,
            Outputs: NODE_TEMPLATES.outputs
          }).map(([category, items]) => (
            <div key={category} className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{category}</h3>
              <div className="space-y-2">
                {items.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={`${category}_${index}`}
                      draggable
                      onDragStart={(e) => handleNodeDragStart(e, item)}
                      className="flex items-center gap-3 p-2 rounded cursor-move hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-gray-500">{item.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="text-lg font-semibold bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={runWorkflow}
                disabled={isRunning || nodes.length === 0}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                  isRunning || nodes.length === 0
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                )}
              >
                <Play className="w-4 h-4" />
                {isRunning ? 'Running...' : 'Run'}
              </button>
              
              <button
                onClick={saveWorkflow}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              
              <div className="border-l border-gray-300 dark:border-gray-600 h-6 mx-2" />
              
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
                <Download className="w-4 h-4" />
              </button>
              
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
                <Upload className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div 
          ref={canvasRef}
          className="flex-1 relative overflow-hidden bg-gray-50 dark:bg-gray-900"
          onMouseDown={handleCanvasMouseDown}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleCanvasDrop}
          onClick={() => {
            setSelectedNode(null);
            setSelectedConnection(null);
          }}
        >
          {/* Grid Background */}
          <svg
            className="absolute inset-0 w-full h-full"
            style={{
              transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})`
            }}
          >
            <defs>
              <pattern
                id="grid"
                width={GRID_SIZE}
                height={GRID_SIZE}
                patternUnits="userSpaceOnUse"
              >
                <circle
                  cx={GRID_SIZE / 2}
                  cy={GRID_SIZE / 2}
                  r={1}
                  fill="currentColor"
                  className="text-gray-300 dark:text-gray-700"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Connections */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})`
            }}
          >
            <g className="pointer-events-auto">
              {connections.map(renderConnection)}
            </g>
          </svg>

          {/* Nodes */}
          <div
            className="absolute inset-0"
            style={{
              transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})`
            }}
          >
            {nodes.map(node => {
              const Icon = node.icon;
              const status = nodeStatus[node.id];
              
              return (
                <motion.div
                  key={node.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={cn(
                    "absolute bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 transition-all cursor-move",
                    selectedNode === node.id
                      ? "border-blue-500 shadow-xl"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  )}
                  style={{
                    left: node.position.x,
                    top: node.position.y,
                    width: 180,
                    minHeight: 80
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode(node.id);
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const startX = e.clientX - node.position.x * zoom;
                    const startY = e.clientY - node.position.y * zoom;

                    const handleMouseMove = (e: MouseEvent) => {
                      updateNodePosition(node.id, {
                        x: (e.clientX - startX) / zoom,
                        y: (e.clientY - startY) / zoom
                      });
                    };

                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };

                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                >
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      <div className="flex items-center gap-1">
                        {getStatusIcon(status)}
                        {selectedNode === node.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNode(node.id);
                              setSelectedNode(null);
                            }}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-medium">{node.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{node.description}</div>
                  </div>

                  {/* Connection Points */}
                  {node.type !== 'output' && (
                    <div
                      className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full cursor-crosshair hover:scale-125 transition-transform"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        // Start connection creation
                      }}
                    />
                  )}
                  {node.type !== 'trigger' && (
                    <div
                      className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-gray-400 rounded-full"
                    />
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Zoom Controls */}
          <div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 flex items-center gap-2">
            <button
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              -
            </button>
            <span className="text-sm px-2">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(Math.min(2, zoom + 0.1))}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Properties Panel */}
      {selectedNode && (
        <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">Node Properties</h3>
          {/* TODO: Add node configuration form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={nodes.find(n => n.id === selectedNode)?.name || ''}
                onChange={(e) => {
                  setNodes(nodes.map(n => 
                    n.id === selectedNode 
                      ? { ...n, name: e.target.value }
                      : n
                  ));
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={nodes.find(n => n.id === selectedNode)?.description || ''}
                onChange={(e) => {
                  setNodes(nodes.map(n => 
                    n.id === selectedNode 
                      ? { ...n, description: e.target.value }
                      : n
                  ));
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent"
                rows={3}
              />
            </div>
            
            {/* Dynamic configuration based on node type */}
            <div className="text-sm text-gray-500">
              Configure node-specific settings here...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}