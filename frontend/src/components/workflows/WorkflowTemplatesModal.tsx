'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Search, 
  Globe, 
  Mail, 
  Calendar, 
  BarChart, 
  Database,
  Megaphone,
  Filter,
  ChevronRight
} from 'lucide-react';
import { WorkflowTemplates, WorkflowTemplate } from '@/lib/workflows/WorkflowTemplates';
import { cn } from '@/lib/utils';

interface WorkflowTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: WorkflowTemplate) => void;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  research: Globe,
  marketing: Megaphone,
  productivity: Calendar,
  data: Database,
  all: Filter
};

const CATEGORY_LABELS: Record<string, string> = {
  research: 'Research & Analysis',
  marketing: 'Marketing & Outreach',
  productivity: 'Productivity & Scheduling',
  data: 'Data Processing',
  all: 'All Templates'
};

export function WorkflowTemplatesModal({ isOpen, onClose, onSelectTemplate }: WorkflowTemplatesModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);

  const templates = selectedCategory === 'all' 
    ? WorkflowTemplates.getAllTemplates()
    : WorkflowTemplates.getTemplatesByCategory(selectedCategory);

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = ['all', 'research', 'marketing', 'productivity', 'data'];

  const handleSelectTemplate = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-x-4 top-[10%] bottom-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[800px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-2xl font-bold">Workflow Templates</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Start with a pre-built template or create from scratch
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Sidebar */}
              <div className="w-64 border-r border-gray-200 dark:border-gray-700 p-4">
                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Categories */}
                <div className="space-y-1">
                  {categories.map(category => {
                    const Icon = CATEGORY_ICONS[category];
                    const isActive = selectedCategory === category;
                    
                    return (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                          isActive
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                            : "hover:bg-gray-100 dark:hover:bg-gray-700"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          {CATEGORY_LABELS[category]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Templates List */}
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="grid gap-4">
                  {filteredTemplates.map(template => (
                    <motion.div
                      key={template.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedTemplate(template)}
                      className={cn(
                        "p-4 rounded-lg border-2 cursor-pointer transition-all",
                        selectedTemplate?.id === template.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{template.name}</h3>
                          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                            {template.description}
                          </p>
                          
                          {/* Template Details */}
                          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                            <span>{template.steps.length} steps</span>
                            <span>•</span>
                            <span className="capitalize">{template.category}</span>
                            {template.requiredContext && (
                              <>
                                <span>•</span>
                                <span>{template.requiredContext.length} inputs required</span>
                              </>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 ml-4" />
                      </div>
                    </motion.div>
                  ))}
                </div>

                {filteredTemplates.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No templates found matching your search.</p>
                  </div>
                )}
              </div>

              {/* Preview Panel */}
              {selectedTemplate && (
                <div className="w-80 border-l border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
                  <h3 className="font-semibold text-lg mb-4">Template Preview</h3>
                  
                  <div className="space-y-4">
                    {/* Steps */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Workflow Steps
                      </h4>
                      <div className="space-y-2">
                        {selectedTemplate.steps.map((step, index) => (
                          <div key={step.id} className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{step.action}</p>
                              <p className="text-xs text-gray-500">
                                Agent: {step.agent}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Required Inputs */}
                    {selectedTemplate.requiredContext && selectedTemplate.requiredContext.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Required Inputs
                        </h4>
                        <div className="space-y-1">
                          {selectedTemplate.requiredContext.map(input => (
                            <div key={input} className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-gray-400 rounded-full" />
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {input.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  onSelectTemplate({
                    id: 'blank',
                    name: 'Blank Workflow',
                    description: 'Start with an empty canvas',
                    category: 'custom',
                    steps: []
                  } as WorkflowTemplate);
                  onClose();
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Start from Scratch
              </button>
              
              <button
                onClick={handleSelectTemplate}
                disabled={!selectedTemplate}
                className={cn(
                  "px-6 py-2 rounded-lg transition-colors",
                  selectedTemplate
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                )}
              >
                Use Template
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}