import React, { useState, useEffect } from 'react';
import { 
  Play, Pause, CheckCircle, AlertCircle, Loader2, 
  Zap, ChevronRight, ChevronDown 
} from 'lucide-react';
import { WorkflowEngine, a2aEvents } from '@/lib/agents/a2a-orchestrator';
import { prebuiltWorkflows } from '@/lib/agents/workflows';

export default function WorkflowExecutor() {
  const [selectedWorkflow, setSelectedWorkflow] = useState('');
  const [executing, setExecuting] = useState(false);
  const [workflowUpdates, setWorkflowUpdates] = useState<any[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);

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
    if (!selectedWorkflow) return;
    
    setExecuting(true);
    setWorkflowUpdates([]);
    setProgress(0);

    const workflow = prebuiltWorkflows[selectedWorkflow as keyof typeof prebuiltWorkflows];
    
    try {
      for await (const update of WorkflowEngine.execute(workflow)) {
        setWorkflowUpdates(prev => [...prev, { ...update, timestamp: new Date() }]);
        
        if (update.progress) {
          setProgress(update.progress);
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
    }
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

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
      <h2 className="text-lg sm:text-xl font-semibold mb-4 flex items-center">
        <Zap className="w-5 h-5 mr-2 text-yellow-500" />
        A2A Workflow Executor
      </h2>

      {/* Workflow Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Select Workflow
        </label>
        <select
          value={selectedWorkflow}
          onChange={(e) => setSelectedWorkflow(e.target.value)}
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

      {/* Execute Button */}
      <button
        onClick={executeWorkflow}
        disabled={!selectedWorkflow || executing}
        className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mb-6"
      >
        {executing ? (
          <>
            <Pause className="w-5 h-5 mr-2" />
            Executing Workflow...
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
  );
}