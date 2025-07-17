'use client';

import React, { useState, useEffect } from 'react';
import { 
  Mail, Edit, Trash2, Copy, Send, Filter, Search, 
  Tag, Clock, BarChart3, Plus 
} from 'lucide-react';
import { 
  EmailTemplate, 
  TemplateCategory,
  emailTemplateService 
} from '@/lib/services/email-templates';
import { useToast } from '@/hooks/use-toast';
import { EmailTemplatePreview } from './EmailTemplatePreview';
import { EmailTemplateSender } from './EmailTemplateSender';

interface EmailTemplateListProps {
  onEdit: (template: EmailTemplate) => void;
  onCreate: () => void;
  refresh?: number; // To trigger refresh from parent
}

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  recruiting: 'bg-blue-600',
  follow_up: 'bg-green-600',
  scheduling: 'bg-yellow-600',
  welcome: 'bg-purple-600',
  rejection: 'bg-red-600',
  offer: 'bg-indigo-600',
  referral: 'bg-pink-600',
  networking: 'bg-teal-600',
  custom: 'bg-gray-600',
};

export function EmailTemplateList({ onEdit, onCreate, refresh }: EmailTemplateListProps) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showSender, setShowSender] = useState(false);

  useEffect(() => {
    const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const filters = selectedCategory !== 'all' ? { category: selectedCategory } : undefined;
      const data = await emailTemplateService.getTemplates(filters);
      setTemplates(data);
    } catch (error) {
      // Error loading templates
      toast({
        title: 'Error',
        description: 'Failed to load email templates',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
    loadTemplates();
  }, [selectedCategory, refresh]);

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await emailTemplateService.deleteTemplate(templateId);
      toast({
        title: 'Success',
        description: 'Template deleted successfully',
      });
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete template',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = async (template: EmailTemplate) => {
    try {
      const newName = `${template.name} (Copy)`;
      await emailTemplateService.duplicateTemplate(template.id, newName);
      toast({
        title: 'Success',
        description: 'Template duplicated successfully',
      });
      loadTemplates();
    } catch (error) {
      console.error('Error duplicating template:', error);
      toast({
        title: 'Error',
        description: 'Failed to duplicate template',
        variant: 'destructive',
      });
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = searchQuery === '' || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSearch;
  });

  const getCategoryLabel = (category: TemplateCategory): string => {
    return category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ');
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header Controls */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="text-gray-400 w-5 h-5" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as TemplateCategory | 'all')}
              className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="all">All Categories</option>
              {Object.keys(CATEGORY_COLORS).map(category => (
                <option key={category} value={category}>
                  {getCategoryLabel(category as TemplateCategory)}
                </option>
              ))}
            </select>
          </div>

          {/* Create Button */}
          <button
            onClick={onCreate}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Template
          </button>
        </div>

        {/* Templates Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">
              {searchQuery || selectedCategory !== 'all' 
                ? 'No templates found matching your criteria'
                : 'No email templates yet'}
            </p>
            <button
              onClick={onCreate}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Create Your First Template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredTemplates.map(template => (
              <div
                key={template.id}
                className="bg-gray-900/50 backdrop-blur-sm rounded-lg p-4 border border-purple-500/20 hover:border-purple-500/40 transition-all"
              >
                {/* Template Header */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-white mb-1">
                      {template.name}
                    </h4>
                    <span className={`inline-block px-2 py-1 text-xs text-white rounded ${CATEGORY_COLORS[template.category]}`}>
                      {getCategoryLabel(template.category)}
                    </span>
                  </div>
                  {!template.is_active && (
                    <span className="px-2 py-1 text-xs bg-gray-700 text-gray-400 rounded">
                      Inactive
                    </span>
                  )}
                </div>

                {/* Subject Preview */}
                <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                  <span className="text-gray-500">Subject:</span> {template.subject}
                </p>

                {/* Tags */}
                {template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {template.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-gray-800/50 text-gray-400 rounded text-xs flex items-center gap-1"
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                      </span>
                    ))}
                    {template.tags.length > 3 && (
                      <span className="px-2 py-1 text-gray-500 text-xs">
                        +{template.tags.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                {/* Statistics */}
                <div className="flex items-center gap-4 mb-4 text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />
                    <span>{template.usage_count} uses</span>
                  </div>
                  {template.last_used_at && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>
                        {new Date(template.last_used_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedTemplate(template);
                      setShowPreview(true);
                    }}
                    className="flex-1 px-3 py-1.5 bg-gray-800/50 text-gray-300 rounded hover:bg-gray-800 transition-colors text-sm"
                    title="Preview"
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTemplate(template);
                      setShowSender(true);
                    }}
                    className="flex-1 px-3 py-1.5 bg-purple-600/20 text-purple-400 rounded hover:bg-purple-600/30 transition-colors text-sm flex items-center justify-center gap-1"
                    title="Send"
                  >
                    <Send className="w-3 h-3" />
                    Send
                  </button>
                  <button
                    onClick={() => onEdit(template)}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDuplicate(template)}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                    title="Duplicate"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && selectedTemplate && (
        <EmailTemplatePreview
          template={selectedTemplate}
          onClose={() => {
            setShowPreview(false);
            setSelectedTemplate(null);
          }}
        />
      )}

      {/* Send Email Modal */}
      {showSender && selectedTemplate && (
        <EmailTemplateSender
          template={selectedTemplate}
          onClose={() => {
            setShowSender(false);
            setSelectedTemplate(null);
          }}
          onSent={() => {
            loadTemplates(); // Refresh to update usage count
          }}
        />
      )}
    </>
  );
}