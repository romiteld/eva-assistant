'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Save, X, Plus, Trash2, Eye, Code } from 'lucide-react';
import { 
  EmailTemplate, 
  EmailTemplateVariable, 
  TemplateCategory,
  CreateEmailTemplateInput,
  UpdateEmailTemplateInput,
  emailTemplateService 
} from '@/lib/services/email-templates';
import { useToast } from '@/hooks/use-toast';

interface EmailTemplateEditorProps {
  template?: EmailTemplate;
  onSave: (template: EmailTemplate) => void;
  onCancel: () => void;
}

const CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: 'recruiting', label: 'Recruiting' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'scheduling', label: 'Scheduling' },
  { value: 'welcome', label: 'Welcome' },
  { value: 'rejection', label: 'Rejection' },
  { value: 'offer', label: 'Offer' },
  { value: 'referral', label: 'Referral' },
  { value: 'networking', label: 'Networking' },
  { value: 'custom', label: 'Custom' },
];

export function EmailTemplateEditor({ template, onSave, onCancel }: EmailTemplateEditorProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showCode, setShowCode] = useState(false);
  
  const [formData, setFormData] = useState({
    name: template?.name || '',
    subject: template?.subject || '',
    body: template?.body || '',
    category: template?.category || 'custom' as TemplateCategory,
    tags: template?.tags || [] as string[],
    variables: template?.variables || [] as EmailTemplateVariable[],
  });

  const [newTag, setNewTag] = useState('');
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});

  useEffect(() => {
    // Initialize preview variables with default values
    const defaultVariables: Record<string, string> = {};
    formData.variables.forEach(v => {
      defaultVariables[v.name] = v.defaultValue;
    });
    setPreviewVariables(defaultVariables);
  }, [formData.variables]);

  const handleAddVariable = () => {
    const newVariable: EmailTemplateVariable = {
      name: '',
      label: '',
      defaultValue: '',
    };
    setFormData(prev => ({
      ...prev,
      variables: [...prev.variables, newVariable],
    }));
  };

  const handleUpdateVariable = (index: number, field: keyof EmailTemplateVariable, value: string) => {
    const updatedVariables = [...formData.variables];
    updatedVariables[index] = {
      ...updatedVariables[index],
      [field]: value,
    };
    setFormData(prev => ({
      ...prev,
      variables: updatedVariables,
    }));
  };

  const handleRemoveVariable = (index: number) => {
    const updatedVariables = formData.variables.filter((_, i) => i !== index);
    setFormData(prev => ({
      ...prev,
      variables: updatedVariables,
    }));
  };

  const handleAddTag = () => {
    if (newTag && !formData.tags.includes(newTag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag],
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag),
    }));
  };

  const handleInsertVariable = (variableName: string) => {
    const placeholder = `{{${variableName}}}`;
    const textarea = document.getElementById('template-body') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newBody = 
        formData.body.substring(0, start) + 
        placeholder + 
        formData.body.substring(end);
      
      setFormData(prev => ({ ...prev, body: newBody }));
      
      // Reset cursor position
      setTimeout(() => {
        textarea.selectionStart = start + placeholder.length;
        textarea.selectionEnd = start + placeholder.length;
        textarea.focus();
      }, 0);
    }
  };

  const getRenderedPreview = () => {
    return emailTemplateService.renderTemplate(
      {
        ...formData,
        id: template?.id || '',
        user_id: '',
        is_active: true,
        usage_count: 0,
        last_used_at: null,
        metadata: {},
        created_at: '',
        updated_at: '',
      } as EmailTemplate,
      previewVariables
    );
  };

  const handleSave = async () => {
    if (!formData.name || !formData.subject || !formData.body) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      let savedTemplate: EmailTemplate;
      
      if (template) {
        // Update existing template
        const updates: UpdateEmailTemplateInput = {
          name: formData.name,
          subject: formData.subject,
          body: formData.body,
          category: formData.category,
          tags: formData.tags,
          variables: formData.variables,
        };
        savedTemplate = await emailTemplateService.updateTemplate(template.id, updates);
      } else {
        // Create new template
        const input: CreateEmailTemplateInput = {
          name: formData.name,
          subject: formData.subject,
          body: formData.body,
          category: formData.category,
          tags: formData.tags,
          variables: formData.variables,
        };
        savedTemplate = await emailTemplateService.createTemplate(input);
      }

      toast({
        title: 'Success',
        description: `Template ${template ? 'updated' : 'created'} successfully`,
      });
      
      onSave(savedTemplate);
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: 'Error',
        description: 'Failed to save template. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg p-6 border border-purple-500/20">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-white">
          {template ? 'Edit Template' : 'Create New Template'}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCode(!showCode)}
            className="p-2 rounded-lg bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            title="Toggle code view"
          >
            <Code className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="p-2 rounded-lg bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            title="Toggle preview"
          >
            <Eye className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor Section */}
        <div className="space-y-4">
          {/* Template Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Template Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
              placeholder="e.g., Initial Candidate Outreach"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Category *
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as TemplateCategory }))}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
            >
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Subject Line *
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
              placeholder="e.g., Exciting Opportunity at {{companyName}}"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email Body *
            </label>
            <div className="relative">
              <textarea
                id="template-body"
                value={formData.body}
                onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none font-mono text-sm"
                rows={showCode ? 15 : 10}
                placeholder="Write your email template here..."
              />
              {formData.variables.length > 0 && (
                <div className="absolute top-2 right-2 flex flex-wrap gap-1 max-w-xs">
                  {formData.variables.map((v, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleInsertVariable(v.name)}
                      className="px-2 py-1 bg-purple-600/20 text-purple-400 rounded text-xs hover:bg-purple-600/30 transition-colors"
                      title={`Insert {{${v.name}}}`}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                className="flex-1 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                placeholder="Add a tag..."
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-gray-800/50 text-gray-300 rounded-full text-sm flex items-center gap-2"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="text-gray-500 hover:text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Variables & Preview Section */}
        <div className="space-y-4">
          {/* Variables */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Template Variables
              </label>
              <button
                onClick={handleAddVariable}
                className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Variable
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {formData.variables.map((variable, idx) => (
                <div key={idx} className="p-3 bg-gray-800/30 rounded-lg space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={variable.name}
                      onChange={(e) => handleUpdateVariable(idx, 'name', e.target.value)}
                      className="px-3 py-1 bg-gray-700/50 border border-gray-600 rounded text-sm text-white"
                      placeholder="Variable name"
                    />
                    <input
                      type="text"
                      value={variable.label}
                      onChange={(e) => handleUpdateVariable(idx, 'label', e.target.value)}
                      className="px-3 py-1 bg-gray-700/50 border border-gray-600 rounded text-sm text-white"
                      placeholder="Display label"
                    />
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={variable.defaultValue}
                        onChange={(e) => handleUpdateVariable(idx, 'defaultValue', e.target.value)}
                        className="flex-1 px-3 py-1 bg-gray-700/50 border border-gray-600 rounded text-sm text-white"
                        placeholder="Default"
                      />
                      <button
                        onClick={() => handleRemoveVariable(idx)}
                        className="p-1 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          {showPreview && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Preview
              </label>
              <div className="p-4 bg-gray-800/30 rounded-lg space-y-3">
                {/* Preview Variables Input */}
                {formData.variables.length > 0 && (
                  <div className="space-y-2 pb-3 border-b border-gray-700">
                    <p className="text-xs text-gray-400">Preview Variables:</p>
                    {formData.variables.map((v, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <label className="text-xs text-gray-400 w-24">{v.label}:</label>
                        <input
                          type="text"
                          value={previewVariables[v.name] || ''}
                          onChange={(e) => setPreviewVariables(prev => ({
                            ...prev,
                            [v.name]: e.target.value,
                          }))}
                          className="flex-1 px-2 py-1 bg-gray-700/50 border border-gray-600 rounded text-xs text-white"
                          placeholder={v.defaultValue}
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Rendered Preview */}
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-1">Subject:</p>
                  <p className="text-white mb-3">{getRenderedPreview().subject}</p>
                  
                  <p className="text-sm font-medium text-gray-300 mb-1">Body:</p>
                  <div 
                    className="text-gray-200 whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: getRenderedPreview().body.replace(/\n/g, '<br>') }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-700">
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {isLoading ? 'Saving...' : (template ? 'Update Template' : 'Create Template')}
        </button>
      </div>
    </div>
  );
}