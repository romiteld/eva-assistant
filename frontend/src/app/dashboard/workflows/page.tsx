'use client';

import { VisualWorkflowDesigner } from '@/components/workflows/VisualWorkflowDesigner';

export default function WorkflowsPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold">Visual Workflow Designer</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Create powerful automations with drag-and-drop simplicity
        </p>
      </div>
      
      <div className="flex-1 min-h-0">
        <VisualWorkflowDesigner />
      </div>
    </div>
  );
}