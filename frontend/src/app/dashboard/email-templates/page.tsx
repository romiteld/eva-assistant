'use client';

import React, { useState } from 'react';
import { Mail, FileText, Clock, BarChart } from 'lucide-react';
import { EmailTemplateList } from '@/components/email-templates/EmailTemplateList';
import { EmailTemplateEditor } from '@/components/email-templates/EmailTemplateEditor';
import { EmailTemplate } from '@/lib/services/email-templates';

export default function EmailTemplatesPage() {
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | undefined>(undefined);
  const [refreshList, setRefreshList] = useState(0);

  const handleCreate = () => {
    setEditingTemplate(undefined);
    setShowEditor(true);
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setShowEditor(true);
  };

  const handleSave = (template: EmailTemplate) => {
    setShowEditor(false);
    setEditingTemplate(undefined);
    setRefreshList(prev => prev + 1); // Trigger list refresh
  };

  const handleCancel = () => {
    setShowEditor(false);
    setEditingTemplate(undefined);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/10 to-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-600/20 rounded-lg">
              <Mail className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Email Templates</h1>
              <p className="text-gray-400 mt-1">
                Create and manage reusable email templates for faster communication
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg p-4 border border-purple-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Templates</p>
                  <p className="text-2xl font-bold text-white mt-1">--</p>
                </div>
                <FileText className="w-8 h-8 text-purple-400/50" />
              </div>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg p-4 border border-purple-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Emails Sent</p>
                  <p className="text-2xl font-bold text-white mt-1">--</p>
                </div>
                <Mail className="w-8 h-8 text-green-400/50" />
              </div>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg p-4 border border-purple-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Last Used</p>
                  <p className="text-2xl font-bold text-white mt-1">--</p>
                </div>
                <Clock className="w-8 h-8 text-blue-400/50" />
              </div>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg p-4 border border-purple-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Success Rate</p>
                  <p className="text-2xl font-bold text-white mt-1">--%</p>
                </div>
                <BarChart className="w-8 h-8 text-yellow-400/50" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {showEditor ? (
          <EmailTemplateEditor
            template={editingTemplate}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        ) : (
          <EmailTemplateList
            onEdit={handleEdit}
            onCreate={handleCreate}
            refresh={refreshList}
          />
        )}
      </div>
    </div>
  );
}