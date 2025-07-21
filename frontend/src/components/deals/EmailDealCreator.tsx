'use client';

import { useState } from 'react';
import { 
  Mail, 
  Upload, 
  Zap, 
  FileText, 
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { useDealAutomation } from '@/hooks/useDealAutomation';
import { toast } from 'react-hot-toast';

interface EmailPreview {
  suggestedName: string;
  stage: string;
  urgency: string;
  estimatedAmount?: number;
  dealType?: string;
}

export const EmailDealCreator: React.FC = () => {
  const { createFromEmail, previewEmailDeal, isCreating } = useDealAutomation();
  const [emailContent, setEmailContent] = useState({
    from: '',
    subject: '',
    content: ''
  });
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleEmailPaste = async (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    
    // Try to parse email format
    const fromMatch = text.match(/From:\s*(.+)/i);
    const subjectMatch = text.match(/Subject:\s*(.+)/i);
    
    if (fromMatch || subjectMatch) {
      setEmailContent({
        from: fromMatch?.[1] || '',
        subject: subjectMatch?.[1] || '',
        content: text
      });
      
      // Auto-analyze
      handleAnalyze({
        from: fromMatch?.[1] || '',
        subject: subjectMatch?.[1] || '',
        content: text
      });
    }
  };

  const handleAnalyze = async (email = emailContent) => {
    if (!email.content) {
      toast.error('Please provide email content');
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await previewEmailDeal(email);
      setPreview(result);
      toast.success('Email analyzed successfully!');
    } catch (error) {
      toast.error('Failed to analyze email');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateDeal = async () => {
    if (!emailContent.content) {
      toast.error('Please provide email content');
      return;
    }

    try {
      const email = {
        id: `email-${Date.now()}`,
        from: emailContent.from || 'unknown@email.com',
        to: ['recruiter@company.com'],
        subject: emailContent.subject || 'No subject',
        content: emailContent.content,
        timestamp: new Date()
      };

      const result = await createFromEmail(email);
      
      toast.success(
        <div>
          <div className="font-semibold">Deal created successfully!</div>
          <div className="text-sm">Time: {(result.metrics.duration / 1000).toFixed(1)}s</div>
        </div>
      );

      // Reset form
      setEmailContent({ from: '', subject: '', content: '' });
      setPreview(null);

      // Open in Zoho
      if (result.deal?.id) {
        window.open(`https://crm.zoho.com/crm/org123456789/tab/Potentials/${result.deal.id}`, '_blank');
      }
    } catch (error) {
      toast.error('Failed to create deal');
    }
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-blue-500/10 backdrop-blur-xl rounded-lg p-4 border border-blue-500/20">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-300 mb-1">How to create deals from emails</h3>
            <ol className="space-y-1 text-sm text-blue-200">
              <li>1. Copy the entire email (including From: and Subject: lines)</li>
              <li>2. Paste it into the box below</li>
              <li>3. Our AI will analyze and extract deal information</li>
              <li>4. Review and create the deal with one click</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Email Input */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              From Email
            </label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="client@company.com"
              value={emailContent.from}
              onChange={(e) => setEmailContent({ ...emailContent, from: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Subject
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Urgent: Need Senior Developer ASAP"
              value={emailContent.subject}
              onChange={(e) => setEmailContent({ ...emailContent, subject: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Email Content
          </label>
          <textarea
            className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            rows={8}
            placeholder="Paste the full email content here..."
            value={emailContent.content}
            onChange={(e) => setEmailContent({ ...emailContent, content: e.target.value })}
            onPaste={handleEmailPaste}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleAnalyze()}
            disabled={!emailContent.content || isAnalyzing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            Analyze Email
          </button>

          <button
            className="flex items-center gap-2 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800"
            onClick={() => {
              setEmailContent({ from: '', subject: '', content: '' });
              setPreview(null);
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* AI Analysis Preview */}
      {preview && (
        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 backdrop-blur-xl rounded-xl p-6 border border-purple-500/20">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            AI Analysis Results
          </h3>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Suggested Deal Name</div>
              <div className="font-medium text-white">{preview.suggestedName}</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Stage</div>
              <div className="font-medium text-white">{preview.stage}</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Urgency Level</div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  preview.urgency === 'urgent' ? 'bg-red-400' :
                  preview.urgency === 'high' ? 'bg-orange-400' :
                  preview.urgency === 'medium' ? 'bg-yellow-400' :
                  'bg-green-400'
                }`} />
                <span className="font-medium capitalize text-white">{preview.urgency}</span>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Deal Type</div>
              <div className="font-medium text-white">{preview.dealType || 'Standard'}</div>
            </div>
            
            {preview.estimatedAmount && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 col-span-2">
                <div className="text-sm text-gray-400 mb-1">Estimated Value</div>
                <div className="font-medium text-lg text-white">${preview.estimatedAmount.toLocaleString()}</div>
              </div>
            )}
          </div>

          <button
            onClick={handleCreateDeal}
            disabled={isCreating}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating Deal...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Create Deal Now
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}

      {/* Sample Email Templates */}
      <div className="border-t border-gray-700 pt-6">
        <h3 className="font-semibold text-white mb-3">Sample Email Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => {
              const sample = {
                from: 'john.smith@techcorp.com',
                subject: 'Urgent: Senior Developer Position - $150k Budget',
                content: `From: john.smith@techcorp.com
Subject: Urgent: Senior Developer Position - $150k Budget

Hi,

We have an urgent need for a Senior Full-Stack Developer to join our team. This is a permanent position with a budget of $150,000 plus benefits.

Requirements:
- 5+ years of experience with React and Node.js
- Experience with cloud platforms (AWS preferred)
- Strong communication skills

We need someone who can start within 2 weeks. Please send me your best candidates ASAP.

Best regards,
John Smith
VP of Engineering, TechCorp`
              };
              setEmailContent(sample);
              handleAnalyze(sample);
            }}
            className="text-left p-4 border border-gray-600 bg-gray-800/50 rounded-lg hover:bg-gray-800"
          >
            <div className="font-medium text-sm mb-1 text-white">Urgent Placement Request</div>
            <div className="text-xs text-gray-400">High-priority permanent role with budget</div>
          </button>

          <button
            onClick={() => {
              const sample = {
                from: 'sarah.jones@startup.io',
                subject: 'Contract Developer Needed',
                content: `From: sarah.jones@startup.io
Subject: Contract Developer Needed

Hello,

We're looking for a contract developer for a 3-month project starting next month. Budget is flexible based on experience.

Project involves building a new microservices architecture. Looking for someone with strong backend skills.

Let me know if you have anyone available.

Thanks,
Sarah`
              };
              setEmailContent(sample);
              handleAnalyze(sample);
            }}
            className="text-left p-4 border border-gray-600 bg-gray-800/50 rounded-lg hover:bg-gray-800"
          >
            <div className="font-medium text-sm mb-1 text-white">Contract Opportunity</div>
            <div className="text-xs text-gray-400">Short-term project with flexible timeline</div>
          </button>
        </div>
      </div>
    </div>
  );
};