'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Mail, ChevronDown } from 'lucide-react';
import { EmailTemplate, TemplateCategory, emailTemplateService } from '@/lib/services/email-templates';
import { EmailTemplateSender } from './EmailTemplateSender';

interface EmailTemplateSelectorProps {
  category?: TemplateCategory;
  onSent?: () => void;
  defaultRecipient?: {
    email: string;
    name?: string;
  };
  defaultVariables?: Record<string, string>;
  buttonText?: string;
  buttonClassName?: string;
}

export function EmailTemplateSelector({
  category,
  onSent,
  defaultRecipient,
  defaultVariables,
  buttonText = 'Send Email',
  buttonClassName = '',
}: EmailTemplateSelectorProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSender, setShowSender] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters = category ? { category, isActive: true } : { isActive: true };
      const data = await emailTemplateService.getTemplates(filters);
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, [category]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleSelectTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setShowDropdown(false);
    setShowSender(true);
  };

  const defaultButtonClass = "flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors";

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={buttonClassName || defaultButtonClass}
          disabled={isLoading || templates.length === 0}
        >
          <Mail className="w-4 h-4" />
          {buttonText}
          <ChevronDown className="w-4 h-4" />
        </button>

        {showDropdown && templates.length > 0 && (
          <div className="absolute top-full mt-2 right-0 w-80 bg-gray-900 border border-purple-500/20 rounded-lg shadow-xl z-50">
            <div className="p-3 border-b border-gray-700">
              <h4 className="text-sm font-medium text-white">Select Email Template</h4>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-800/50 transition-colors"
                >
                  <div className="text-sm font-medium text-white">{template.name}</div>
                  <div className="text-xs text-gray-400 mt-1 line-clamp-1">
                    {template.subject}
                  </div>
                </button>
              ))}
            </div>
            {templates.length === 0 && (
              <div className="p-4 text-center text-gray-400 text-sm">
                No templates available
              </div>
            )}
          </div>
        )}
      </div>

      {showSender && selectedTemplate && (
        <EmailTemplateSender
          template={selectedTemplate}
          onClose={() => {
            setShowSender(false);
            setSelectedTemplate(null);
          }}
          onSent={() => {
            setShowSender(false);
            setSelectedTemplate(null);
            onSent?.();
          }}
          defaultRecipient={defaultRecipient}
          defaultVariables={defaultVariables}
        />
      )}
    </>
  );
}