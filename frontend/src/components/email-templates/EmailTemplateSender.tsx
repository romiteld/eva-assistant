'use client';

import React, { useState, useEffect } from 'react';
import { X, Send, Plus, Trash2 } from 'lucide-react';
import { EmailTemplate, emailTemplateService } from '@/lib/services/email-templates';
import { useToast } from '@/hooks/use-toast';

interface EmailTemplateSenderProps {
  template: EmailTemplate;
  onClose: () => void;
  onSent: () => void;
  defaultRecipient?: {
    email: string;
    name?: string;
  };
  defaultVariables?: Record<string, string>;
}

export function EmailTemplateSender({ 
  template, 
  onClose, 
  onSent,
  defaultRecipient,
  defaultVariables 
}: EmailTemplateSenderProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [recipient, setRecipient] = useState({
    email: defaultRecipient?.email || '',
    name: defaultRecipient?.name || '',
  });
  const [ccRecipients, setCcRecipients] = useState<string[]>([]);
  const [bccRecipients, setBccRecipients] = useState<string[]>([]);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [newCc, setNewCc] = useState('');
  const [newBcc, setNewBcc] = useState('');
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    // Initialize variables with defaults
    const initialVariables: Record<string, string> = {};
    template.variables.forEach(v => {
      initialVariables[v.name] = defaultVariables?.[v.name] || v.defaultValue;
    });
    setVariables(initialVariables);
  }, [template, defaultVariables]);

  const getRenderedContent = () => {
    return emailTemplateService.renderTemplate(template, variables);
  };

  const handleAddCc = () => {
    if (newCc && !ccRecipients.includes(newCc)) {
      setCcRecipients([...ccRecipients, newCc]);
      setNewCc('');
    }
  };

  const handleAddBcc = () => {
    if (newBcc && !bccRecipients.includes(newBcc)) {
      setBccRecipients([...bccRecipients, newBcc]);
      setNewBcc('');
    }
  };

  const handleSend = async () => {
    // Validate
    if (!recipient.email) {
      toast({
        title: 'Error',
        description: 'Please enter a recipient email address',
        variant: 'destructive',
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient.email)) {
      toast({
        title: 'Error',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await emailTemplateService.sendEmailFromTemplate({
        templateId: template.id,
        recipient,
        variables,
        cc: ccRecipients,
        bcc: bccRecipients,
      });

      toast({
        title: 'Success',
        description: 'Email sent successfully',
      });

      onSent();
      onClose();
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send email',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
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
          <h3 className="text-xl font-semibold text-white">Send Email: {template.name}</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          <div className="p-6 space-y-6">
            {/* Recipient */}
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-3">Recipient</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Email Address *</label>
                  <input
                    type="email"
                    value={recipient.email}
                    onChange={(e) => setRecipient(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                    placeholder="recipient@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name (Optional)</label>
                  <input
                    type="text"
                    value={recipient.name}
                    onChange={(e) => setRecipient(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            </div>

            {/* CC/BCC */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CC */}
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-3">CC Recipients</h4>
                <div className="flex gap-2 mb-2">
                  <input
                    type="email"
                    value={newCc}
                    onChange={(e) => setNewCc(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCc()}
                    className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none text-sm"
                    placeholder="Add CC email..."
                  />
                  <button
                    onClick={handleAddCc}
                    className="p-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  {ccRecipients.map((email, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-1 bg-gray-800/30 rounded">
                      <span className="text-sm text-gray-300">{email}</span>
                      <button
                        onClick={() => setCcRecipients(ccRecipients.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* BCC */}
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-3">BCC Recipients</h4>
                <div className="flex gap-2 mb-2">
                  <input
                    type="email"
                    value={newBcc}
                    onChange={(e) => setNewBcc(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddBcc()}
                    className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none text-sm"
                    placeholder="Add BCC email..."
                  />
                  <button
                    onClick={handleAddBcc}
                    className="p-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  {bccRecipients.map((email, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-1 bg-gray-800/30 rounded">
                      <span className="text-sm text-gray-300">{email}</span>
                      <button
                        onClick={() => setBccRecipients(bccRecipients.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Template Variables */}
            {template.variables.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-3">Email Variables</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {template.variables.map((variable, idx) => (
                    <div key={idx}>
                      <label className="block text-xs text-gray-400 mb-1">
                        {variable.label}
                      </label>
                      <input
                        type="text"
                        value={variables[variable.name] || ''}
                        onChange={(e) => setVariables(prev => ({
                          ...prev,
                          [variable.name]: e.target.value,
                        }))}
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none text-sm"
                        placeholder={variable.defaultValue}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview Toggle */}
            <div>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
            </div>

            {/* Email Preview */}
            {showPreview && (
              <div className="bg-gray-800/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Email Preview</h4>
                <div className="bg-white rounded-lg overflow-hidden">
                  {/* Email Header */}
                  <div className="bg-gray-100 p-4 border-b">
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">To:</span>{' '}
                        <span className="text-gray-800">
                          {recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email}
                        </span>
                      </div>
                      {ccRecipients.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-600">CC:</span>{' '}
                          <span className="text-gray-800">{ccRecipients.join(', ')}</span>
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-gray-600">Subject:</span>{' '}
                        <span className="text-gray-800 font-semibold">
                          {getRenderedContent().subject}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Email Body */}
                  <div className="p-6">
                    <div 
                      className="text-gray-800 whitespace-pre-wrap text-sm"
                      dangerouslySetInnerHTML={{ 
                        __html: getRenderedContent().body.replace(/\n/g, '<br>') 
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-800/50 px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isLoading || !recipient.email}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {isLoading ? 'Sending...' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  );
}