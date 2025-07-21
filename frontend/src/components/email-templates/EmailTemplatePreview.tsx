'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Copy, Mail } from 'lucide-react';
import { EmailTemplate, emailTemplateService } from '@/lib/services/email-templates';
import { useToast } from '@/hooks/use-toast';

interface EmailTemplatePreviewProps {
  template: EmailTemplate;
  onClose: () => void;
}

export function EmailTemplatePreview({ template, onClose }: EmailTemplatePreviewProps) {
  const { toast } = useToast();
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'preview' | 'html' | 'stats'>('preview');
  const [stats, setStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  useEffect(() => {
    // Initialize preview variables with default values
    const defaultVariables: Record<string, string> = {};
    template.variables.forEach(v => {
      defaultVariables[v.name] = v.defaultValue;
    });
    setPreviewVariables(defaultVariables);
  }, [template]);

  const loadStatistics = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const statistics = await emailTemplateService.getTemplateStatistics(template.id);
      setStats(statistics);
    } catch (error) {
      console.error('Error loading template statistics:', error);
    } finally {
      setIsLoadingStats(false);
    }
  }, [template.id]);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  const getRenderedContent = () => {
    return emailTemplateService.renderTemplate(template, previewVariables);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Content copied to clipboard',
    });
  };

  const handleClose = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={handleClose}
    >
      <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden border border-purple-500/20">
        {/* Header */}
        <div className="bg-gray-800/50 px-6 py-4 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold text-white">{template.name}</h3>
            <p className="text-sm text-gray-400 mt-1">
              {template.category.charAt(0).toUpperCase() + template.category.slice(1).replace('_', ' ')} Template
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-700">
          <div className="flex">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'preview' 
                  ? 'text-purple-400 border-b-2 border-purple-400' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setActiveTab('html')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'html' 
                  ? 'text-purple-400 border-b-2 border-purple-400' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              HTML Code
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'stats' 
                  ? 'text-purple-400 border-b-2 border-purple-400' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Statistics
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {activeTab === 'preview' && (
            <div className="p-6 space-y-6">
              {/* Variable Inputs */}
              {template.variables.length > 0 && (
                <div className="bg-gray-800/30 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-medium text-gray-300 mb-3">Preview Variables</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {template.variables.map((variable, idx) => (
                      <div key={idx}>
                        <label className="block text-xs text-gray-400 mb-1">
                          {variable.label}
                        </label>
                        <input
                          type="text"
                          value={previewVariables[variable.name] || ''}
                          onChange={(e) => setPreviewVariables(prev => ({
                            ...prev,
                            [variable.name]: e.target.value,
                          }))}
                          className="w-full px-3 py-1.5 bg-gray-700/50 border border-gray-600 rounded text-sm text-white"
                          placeholder={variable.defaultValue}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Preview */}
              <div className="bg-white rounded-lg overflow-hidden">
                {/* Email Header */}
                <div className="bg-gray-100 p-4 border-b">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-600">From:</span>
                      <span className="text-sm text-gray-800">recruiter@thewellrecruiting.com</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-600">To:</span>
                      <span className="text-sm text-gray-800">recipient@example.com</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-600">Subject:</span>
                      <span className="text-sm text-gray-800 font-semibold">
                        {getRenderedContent().subject}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Email Body */}
                <div className="p-6">
                  <div 
                    className="text-gray-800 whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ 
                      __html: getRenderedContent().body.replace(/\n/g, '<br>') 
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'html' && (
            <div className="p-6">
              <div className="bg-gray-800/30 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-medium text-gray-300">HTML Template</h4>
                  <button
                    onClick={() => copyToClipboard(getRenderedContent().body)}
                    className="flex items-center gap-2 px-3 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors text-sm"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                </div>
                <pre className="bg-gray-900 p-4 rounded overflow-x-auto">
                  <code className="text-sm text-gray-300 font-mono">
                    {`Subject: ${getRenderedContent().subject}\n\n${getRenderedContent().body}`}
                  </code>
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="p-6">
              {isLoadingStats ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
                </div>
              ) : stats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-800/30 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <Mail className="w-8 h-8 text-purple-400" />
                        <div>
                          <p className="text-2xl font-bold text-white">{stats.totalSent}</p>
                          <p className="text-sm text-gray-400">Total Sent</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-800/30 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                          <span className="text-green-400 font-bold">%</span>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-white">{stats.successRate.toFixed(1)}%</p>
                          <p className="text-sm text-gray-400">Success Rate</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-800/30 rounded-lg p-4">
                      <p className="text-sm text-gray-400 mb-1">Last Used</p>
                      <p className="text-white">
                        {stats.lastUsed 
                          ? new Date(stats.lastUsed).toLocaleDateString() 
                          : 'Never'
                        }
                      </p>
                    </div>
                  </div>

                  {Object.keys(stats.mostUsedVariables).length > 0 && (
                    <div className="bg-gray-800/30 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-300 mb-3">
                        Most Frequently Used Variable Values
                      </h4>
                      <div className="space-y-2">
                        {Object.entries(stats.mostUsedVariables).map(([variable, count]) => (
                          <div key={variable} className="flex justify-between items-center">
                            <span className="text-sm text-gray-400">{variable}</span>
                            <span className="text-sm text-white">{count as React.ReactNode} times</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8">
                  No statistics available yet
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}