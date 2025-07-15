'use client';

import { useState } from 'react';
import { 
  UserCheck, 
  FileText, 
  Briefcase, 
  Clock, 
  AlertCircle,
  DollarSign,
  Calendar,
  TrendingUp,
  Zap,
  Plus
} from 'lucide-react';
import { useDealAutomation } from '@/hooks/useDealAutomation';
import { toast } from 'react-hot-toast';

interface DealTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  fields: {
    stage: string;
    dealType: string;
    probability: number;
    amount?: number;
    nextStep?: string;
  };
  color: string;
  hotkey?: string;
}

interface DealTemplateCardProps {
  template: DealTemplate;
  onClick: () => void;
  isLoading?: boolean;
}

const DealTemplateCard: React.FC<DealTemplateCardProps> = ({ template, onClick, isLoading }) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`group relative overflow-hidden rounded-xl border-2 border-gray-200 bg-white p-6 transition-all hover:border-${template.color}-500 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {/* Background gradient on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br from-${template.color}-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
      
      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-lg bg-${template.color}-100 text-${template.color}-600`}>
            {template.icon}
          </div>
          {template.hotkey && (
            <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
              {template.hotkey}
            </span>
          )}
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {template.name}
        </h3>
        
        <p className="text-sm text-gray-600 mb-4">
          {template.description}
        </p>
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">Stage:</span>
            <span className="font-medium">{template.fields.stage}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Probability:</span>
            <span className="font-medium">{template.fields.probability}%</span>
          </div>
          {template.fields.amount && (
            <div className="flex justify-between">
              <span className="text-gray-500">Est. Value:</span>
              <span className="font-medium">${template.fields.amount.toLocaleString()}</span>
            </div>
          )}
        </div>
        
        {/* Quick action indicator */}
        <div className="mt-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Zap className="w-4 h-4 text-yellow-500 mr-1" />
          <span className="text-xs font-medium text-gray-700">Quick Create</span>
        </div>
      </div>
      
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}
    </button>
  );
};

interface QuickDealFormProps {
  template: DealTemplate;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const QuickDealForm: React.FC<QuickDealFormProps> = ({ template, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    dealName: '',
    contactEmail: '',
    amount: template.fields.amount || 0,
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      ...template.fields
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-semibold mb-4">
          Quick Create: {template.name}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deal Name*
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={formData.dealName}
              onChange={(e) => setFormData({ ...formData, dealName: e.target.value })}
              placeholder="e.g., Senior Developer - ABC Corp"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Email
            </label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              placeholder="contact@company.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deal Value
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quick Notes
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional context..."
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Deal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const QuickDealTemplates: React.FC = () => {
  const { createFromTemplate, isCreating, metrics } = useDealAutomation();
  const [selectedTemplate, setSelectedTemplate] = useState<DealTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);

  const templates: DealTemplate[] = [
    {
      id: 'direct-placement',
      name: 'Direct Placement',
      description: 'Permanent placement opportunity',
      icon: <UserCheck className="w-6 h-6" />,
      fields: {
        stage: 'Qualification',
        dealType: 'Direct Placement',
        probability: 30,
        amount: 25000
      },
      color: 'blue',
      hotkey: '⌘1'
    },
    {
      id: 'contract-role',
      name: 'Contract Role',
      description: 'Contract or consulting opportunity',
      icon: <FileText className="w-6 h-6" />,
      fields: {
        stage: 'Needs Analysis',
        dealType: 'Contract',
        probability: 40,
        amount: 15000
      },
      color: 'green',
      hotkey: '⌘2'
    },
    {
      id: 'executive-search',
      name: 'Executive Search',
      description: 'C-level or senior placement',
      icon: <Briefcase className="w-6 h-6" />,
      fields: {
        stage: 'Qualification',
        dealType: 'Executive Search',
        probability: 25,
        amount: 50000
      },
      color: 'purple',
      hotkey: '⌘3'
    },
    {
      id: 'temp-staffing',
      name: 'Temp Staffing',
      description: 'Short-term placement',
      icon: <Clock className="w-6 h-6" />,
      fields: {
        stage: 'Value Proposition',
        dealType: 'Temporary',
        probability: 50,
        amount: 8000
      },
      color: 'orange',
      hotkey: '⌘4'
    },
    {
      id: 'urgent-need',
      name: 'Urgent Requirement',
      description: 'High-priority placement',
      icon: <AlertCircle className="w-6 h-6" />,
      fields: {
        stage: 'Value Proposition',
        dealType: 'Urgent Placement',
        probability: 60,
        nextStep: 'Immediate candidate sourcing'
      },
      color: 'red',
      hotkey: '⌘5'
    }
  ];

  const handleTemplateClick = (template: DealTemplate) => {
    setSelectedTemplate(template);
  };

  const handleQuickCreate = async (template: DealTemplate) => {
    setLoadingTemplate(template.id);
    try {
      const result = await createFromTemplate(template.id, template.fields);
      toast.success(`Deal created in ${(result.metrics.duration / 1000).toFixed(1)}s! 🚀`);
      
      // Navigate to deal
      if (result.deal?.id) {
        window.open(`https://crm.zoho.com/crm/org123456789/tab/Potentials/${result.deal.id}`, '_blank');
      }
    } catch (error) {
      toast.error('Failed to create deal');
      console.error(error);
    } finally {
      setLoadingTemplate(null);
    }
  };

  const handleFormSubmit = async (data: any) => {
    try {
      const result = await createFromTemplate(selectedTemplate!.id, data);
      toast.success(`Deal "${data.dealName}" created in ${(result.metrics.duration / 1000).toFixed(1)}s!`);
      setSelectedTemplate(null);
      
      // Navigate to deal
      if (result.deal?.id) {
        window.open(`https://crm.zoho.com/crm/org123456789/tab/Potentials/${result.deal.id}`, '_blank');
      }
    } catch (error) {
      toast.error('Failed to create deal');
      console.error(error);
    }
  };

  // Set up keyboard shortcuts
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 5) {
          e.preventDefault();
          const template = templates[num - 1];
          handleQuickCreate(template);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className="space-y-6">
      {/* Performance Metrics */}
      {metrics && metrics.totalDeals > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">
                Average Deal Creation Time:
              </span>
              <span className="text-lg font-bold text-blue-600">
                {(metrics.averageDuration / 1000).toFixed(1)}s
              </span>
            </div>
            <div className="text-sm text-gray-600">
              {metrics.totalDeals} deals created • {metrics.successRate.toFixed(0)}% success rate
            </div>
          </div>
        </div>
      )}

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <DealTemplateCard
            key={template.id}
            template={template}
            onClick={() => handleTemplateClick(template)}
            isLoading={loadingTemplate === template.id}
          />
        ))}
        
        {/* Custom Deal Card */}
        <button
          className="group relative overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 transition-all hover:border-gray-400 hover:bg-gray-100"
          onClick={() => {/* Open custom deal form */}}
        >
          <div className="flex flex-col items-center justify-center h-full">
            <Plus className="w-8 h-8 text-gray-400 mb-2" />
            <span className="text-sm font-medium text-gray-600">Custom Deal</span>
          </div>
        </button>
      </div>

      {/* Quick Create Form Modal */}
      {selectedTemplate && (
        <QuickDealForm
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onSubmit={handleFormSubmit}
        />
      )}

      {/* Keyboard Shortcuts Help */}
      <div className="text-center text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          <kbd className="px-2 py-1 bg-gray-100 rounded font-mono">⌘</kbd>
          <span>+</span>
          <kbd className="px-2 py-1 bg-gray-100 rounded font-mono">1-5</kbd>
          <span>for quick create</span>
        </span>
      </div>
    </div>
  );
};