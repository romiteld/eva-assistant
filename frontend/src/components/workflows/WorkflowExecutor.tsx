'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  RotateCw, 
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkflowEngine } from '@/hooks/useWorkflowEngine';

interface WorkflowExecutorProps {
  workflowId: string;
  workflowName: string;
  onClose?: () => void;
}

export function WorkflowExecutor({ workflowId, workflowName, onClose }: WorkflowExecutorProps) {
  const { executeWorkflow, cancelWorkflow, retryWorkflow, getWorkflowStatus } = useWorkflowEngine();
  const status = getWorkflowStatus(workflowId);

  const handleExecute = () => {
    executeWorkflow(workflowId);
  };

  const handleCancel = () => {
    cancelWorkflow(workflowId);
  };

  const handleRetry = () => {
    retryWorkflow(workflowId);
  };

  const getStatusIcon = () => {
    switch (status?.status) {
      case 'running':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'cancelled':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (status?.status) {
      case 'running':
        return 'Running...';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Ready';
    }
  };

  const getStatusColor = () => {
    switch (status?.status) {
      case 'running':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'cancelled':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 w-80"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <div>
              <h4 className="font-medium text-sm">{workflowName}</h4>
              <p className="text-xs text-gray-500">{getStatusText()}</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Progress Bar */}
        {status?.status === 'running' && (
          <div className="mb-3">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <motion.div
                className={cn("h-full rounded-full", getStatusColor())}
                initial={{ width: 0 }}
                animate={{ width: `${status.progress || 0}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{status.progress || 0}% complete</p>
          </div>
        )}

        {/* Error Message */}
        {status?.error && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
            {status.error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {(!status || status.status === 'pending') && (
            <button
              onClick={handleExecute}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Play className="w-4 h-4" />
              Run
            </button>
          )}

          {status?.status === 'running' && (
            <button
              onClick={handleCancel}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              <Pause className="w-4 h-4" />
              Cancel
            </button>
          )}

          {(status?.status === 'failed' || status?.status === 'cancelled') && (
            <button
              onClick={handleRetry}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
              <RotateCw className="w-4 h-4" />
              Retry
            </button>
          )}

          {status?.status === 'completed' && (
            <button
              onClick={handleExecute}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              <Play className="w-4 h-4" />
              Run Again
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}