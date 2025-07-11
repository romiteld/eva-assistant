import React, { useState, useEffect } from 'react';
import { 
  Play, Pause, CheckCircle, AlertCircle, Loader2, 
  Zap, ChevronRight, ChevronDown, RefreshCw, Trash2,
  Clock, TrendingUp
} from 'lucide-react';
import { a2aEvents } from '@/lib/agents/a2a-orchestrator';
import { prebuiltWorkflows } from '@/lib/agents/workflows';
import { WorkflowManager, DatabaseWorkflow } from '@/lib/agents/workflow-manager';
import { supabase } from '@/lib/supabase/browser';

export default function WorkflowExecutorEnhanced() {
  const [selectedWorkflow, setSelectedWorkflow] = useState('');
  const [executing, setExecuting] = useState(false);
  const [workflowUpdates, setWorkflowUpdates] = useState<any[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);
  const [recentWorkflows, setRecentWorkflows] = useState<DatabaseWorkflow[]>([]);
  const [workflowStats, setWorkflowStats] = useState<any>(null);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  // Load recent workflows and stats
  useEffect(() => {
    if (!user) return;

    const loadWorkflowData = async () => {
      const workflows = await WorkflowManager.getWorkflowsByStatus(user.id);
      setRecentWorkflows(workflows.slice(0, 5));

      const stats = await WorkflowManager.getWorkflowStats(user.id);
      setWorkflowStats(stats);
    };

    loadWorkflowData();
    
    // Refresh every 5 seconds
    const interval = setInterval(loadWorkflowData, 5000);
    return () => clearInterval(interval);
  }, [user]);

  // Subscribe to A2A events
  useEffect(() => {
    const handleAgentEvent = (event: any) => {
      console.log('A2A Event:', event);
    };

    a2aEvents.on('agent:registered', handleAgentEvent);
    
    return () => {
      a2aEvents.off('agent:registered', handleAgentEvent);
    };
  }, []);

  const executeWorkflow = async () => {
    if (!selectedWorkflow || !user) return;
    
    setExecuting(true);
    setWorkflowUpdates([]);
    setProgress(0);
    setCurrentWorkflowId(null);

    const workflow = prebuiltWorkflows[selectedWorkflow as keyof typeof prebuiltWorkflows];
    
    try {
      for await (const update of WorkflowManager.executeWithTracking(workflow, user.id)) {
        setWorkflowUpdates(prev => [...prev, { ...update, timestamp: new Date() }]);
        
        if (update.progress) {
          setProgress(update.progress);
        }

        if (update.dbWorkflow) {
          setCurrentWorkflowId(update.dbWorkflow.id);
        }
      }
    } catch (error) {
      console.error('Workflow execution error:', error);
      setWorkflowUpdates(prev => [...prev, {
        type: 'workflow_failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      }]);
    } finally {
      setExecuting(false);
      // Refresh workflow list
      if (user) {
        const workflows = await WorkflowManager.getWorkflowsByStatus(user.id);
        setRecentWorkflows(workflows.slice(0, 5));
        const stats = await WorkflowManager.getWorkflowStats(user.id);
        setWorkflowStats(stats);
      }
    }
  };

  const cancelWorkflow = async () => {
    if (!currentWorkflowId) return;
    
    await WorkflowManager.cancelWorkflow(currentWorkflowId);
    setExecuting(false);
  };

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const getUpdateIcon = (type: string) => {
    switch (type) {
      case 'task_start':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'task_complete':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'task_failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'workflow_complete':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'workflow_failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Zap className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-gray-400';
      case 'active':
        return 'text-blue-400';
      case 'completed':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'active':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Zap className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Workflow Stats */}
      {workflowStats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400">Total</p>
            <p className="text-2xl font-bold">{workflowStats.total}</p>
          </div>
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400">Active</p>
            <p className="text-2xl font-bold text-blue-400">{workflowStats.active}</p>
          </div>
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400">Completed</p>
            <p className="text-2xl font-bold text-green-400">{workflowStats.completed}</p>
          </div>
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400">Failed</p>
            <p className="text-2xl font-bold text-red-400">{workflowStats.failed}</p>
          </div>
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400">Success Rate</p>
            <p className="text-2xl font-bold flex items-center">
              {workflowStats.successRate.toFixed(1)}%
              <TrendingUp className="w-4 h-4 ml-2 text-green-400" />
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workflow Executor */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
          <h2 className="text-lg sm:text-xl font-semibold mb-4 flex items-center">
            <Zap className="w-5 h-5 mr-2 text-yellow-500" />
            Workflow Executor
          </h2>

          {/* Workflow Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Workflow
            </label>
            <select
              value={selectedWorkflow}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedWorkflow(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
              disabled={executing}
            >
              <option value="">Choose a workflow...</option>
              <option value="candidateResearchWorkflow">Comprehensive Candidate Research</option>
              <option value="companyIntelWorkflow">Company Intelligence Gathering</option>
              <option value="outreachOptimizationWorkflow">Outreach Message Optimization</option>
              <option value="competitiveAnalysisWorkflow">Competitive Analysis</option>
            </select>
          </div>

          {/* Execute/Cancel Button */}
          <button
            onClick={executing ? cancelWorkflow : executeWorkflow}
            disabled={(!selectedWorkflow && !executing) || !user}
            className={`w-full py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mb-6 ${
              executing 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white'
            }`}
          >
            {executing ? (
              <>
                <Pause className="w-5 h-5 mr-2" />
                Cancel Workflow
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Execute Workflow
              </>
            )}
          </button>

          {/* Progress Bar */}
          {executing && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-400 mb-1">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-yellow-500 to-orange-600 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Workflow Updates */}
          {workflowUpdates.length > 0 && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              <h3 className="text-sm font-semibold text-gray-300 sticky top-0 bg-gray-800 py-2">
                Execution Log
              </h3>
              {workflowUpdates.map((update, index) => (
                <div 
                  key={index} 
                  className="bg-gray-800/50 rounded-lg p-3 border border-gray-700"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-2 flex-1">
                      {getUpdateIcon(update.type)}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">
                          {update.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          {update.taskId && ` - ${update.taskId}`}
                        </p>
                        {update.error && (
                          <p className="text-xs text-red-400 mt-1">{update.error}</p>
                        )}
                        {update.data && (
                          <button
                            onClick={() => toggleTaskExpansion(`${index}`)}
                            className="flex items-center text-xs text-blue-400 hover:text-blue-300 mt-1"
                          >
                            {expandedTasks.has(`${index}`) ? (
                              <ChevronDown className="w-3 h-3 mr-1" />
                            ) : (
                              <ChevronRight className="w-3 h-3 mr-1" />
                            )}
                            View Data
                          </button>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {update.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  
                  {/* Expanded Data View */}
                  {expandedTasks.has(`${index}`) && update.data && (
                    <div className="mt-3 p-3 bg-gray-900 rounded-lg">
                      <pre className="text-xs text-gray-300 overflow-x-auto">
                        {JSON.stringify(update.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Workflows */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-semibold flex items-center">
              <Clock className="w-5 h-5 mr-2 text-blue-500" />
              Recent Workflows
            </h2>
            <button
              onClick={async () => {
                if (user) {
                  const workflows = await WorkflowManager.getWorkflowsByStatus(user.id);
                  setRecentWorkflows(workflows.slice(0, 5));
                }
              }}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {recentWorkflows.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No workflows yet</p>
            ) : (
              recentWorkflows.map((workflow: DatabaseWorkflow) => (
                <div key={workflow.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{workflow.name}</p>
                      <p className="text-xs text-gray-400">{workflow.agent}</p>
                    </div>
                    <div className={`flex items-center space-x-1 ${getStatusColor(workflow.status)}`}>
                      {getStatusIcon(workflow.status)}
                      <span className="text-xs capitalize">{workflow.status}</span>
                    </div>
                  </div>
                  
                  {workflow.status === 'active' && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-700 rounded-full h-1.5">
                        <div 
                          className="bg-blue-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${workflow.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {workflow.error_message && (
                    <p className="text-xs text-red-400 mt-2">{workflow.error_message}</p>
                  )}
                  
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">
                      {new Date(workflow.created_at).toLocaleString()}
                    </span>
                    {workflow.completed_at && (
                      <span className="text-xs text-gray-500">
                        Duration: {Math.round((new Date(workflow.completed_at).getTime() - new Date(workflow.created_at).getTime()) / 1000)}s
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cleanup Button */}
          {user && recentWorkflows.length > 0 && (
            <button
              onClick={async () => {
                const cleaned = await WorkflowManager.cleanupOldWorkflows(user.id, 7);
                if (cleaned > 0) {
                  const workflows = await WorkflowManager.getWorkflowsByStatus(user.id);
                  setRecentWorkflows(workflows.slice(0, 5));
                }
              }}
              className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm flex items-center justify-center transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clean Up Old Workflows (7+ days)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}