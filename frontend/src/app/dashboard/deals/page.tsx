'use client';

import { useState, useEffect } from 'react';
import { 
  Zap, 
  TrendingUp, 
  Clock, 
  DollarSign,
  Mail,
  FileText,
  BarChart3,
  Activity,
  Target,
  AlertCircle
} from 'lucide-react';
import { QuickDealTemplates } from '@/components/deals/QuickDealTemplates';
import { DealMetricsDashboard } from '@/components/deals/DealMetricsDashboard';
import { EmailDealCreator } from '@/components/deals/EmailDealCreator';
import { useDealAutomation } from '@/hooks/useDealAutomation';

export default function DealsPage() {
  const [activeTab, setActiveTab] = useState('templates');
  const { metrics } = useDealAutomation();
  const [performanceData, setPerformanceData] = useState<any>(null);

  // Fetch performance data
  useEffect(() => {
    fetchPerformanceData();
    const interval = setInterval(fetchPerformanceData, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchPerformanceData = async () => {
    try {
      const response = await fetch('/api/deals/metrics?timeRange=7d');
      if (response.ok) {
        const data = await response.json();
        setPerformanceData(data);
      }
    } catch (error) {
      console.error('Failed to fetch performance data:', error);
    }
  };

  const tabs = [
    { id: 'templates', label: 'Quick Templates', icon: <Zap className="w-4 h-4" /> },
    { id: 'email', label: 'Email to Deal', icon: <Mail className="w-4 h-4" /> },
    { id: 'metrics', label: 'Performance', icon: <BarChart3 className="w-4 h-4" /> }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 text-white backdrop-blur-xl border border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Deal Automation Center</h1>
            <p className="text-purple-100">Create deals in under 30 seconds with AI-powered automation</p>
          </div>
          <div className="text-right">
            {performanceData && (
              <>
                <div className="text-4xl font-bold">
                  {(performanceData.summary.averageDuration / 1000).toFixed(1)}s
                </div>
                <div className="text-sm text-purple-100">Avg. Creation Time</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Performance Summary Cards */}
      {performanceData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-5 h-5 text-green-400" />
              <span className="text-xs text-gray-400">7 days</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {performanceData.summary.totalDeals}
            </div>
            <div className="text-sm text-gray-400">Total Deals Created</div>
            <div className="mt-2 text-xs text-green-400">
              {performanceData.summary.successRate.toFixed(0)}% success rate
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="text-xs text-gray-400">Target: 30s</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {performanceData.summary.under30s}
            </div>
            <div className="text-sm text-gray-400">Under 30s</div>
            <div className="mt-2">
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-400 h-2 rounded-full"
                  style={{ width: `${(performanceData.summary.under30s / performanceData.summary.totalDeals) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <Mail className="w-5 h-5 text-purple-400" />
              <span className="text-xs text-gray-400">Email source</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {performanceData.bySource.email?.count || 0}
            </div>
            <div className="text-sm text-gray-400">From Emails</div>
            <div className="mt-2 text-xs text-purple-400">
              {performanceData.bySource.email ? 
                `${(performanceData.bySource.email.avgDuration / 1000).toFixed(1)}s avg` : 
                'No data'}
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <FileText className="w-5 h-5 text-orange-400" />
              <span className="text-xs text-gray-400">Template source</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {performanceData.bySource.template?.count || 0}
            </div>
            <div className="text-sm text-gray-400">From Templates</div>
            <div className="mt-2 text-xs text-orange-400">
              {performanceData.bySource.template ? 
                `${(performanceData.bySource.template.avgDuration / 1000).toFixed(1)}s avg` : 
                'No data'}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10">
        <div className="border-b border-white/10">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab.id
                    ? 'border-purple-400 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                  }
                `}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'templates' && <QuickDealTemplates />}
          {activeTab === 'email' && <EmailDealCreator />}
          {activeTab === 'metrics' && <DealMetricsDashboard data={performanceData} />}
        </div>
      </div>

      {/* Tips Section */}
      <div className="bg-purple-500/10 backdrop-blur-xl rounded-xl p-6 border border-purple-500/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-purple-400 mt-0.5" />
          <div>
            <h3 className="font-semibold text-purple-300 mb-2">Pro Tips for Faster Deal Creation</h3>
            <ul className="space-y-1 text-sm text-purple-200">
              <li>• Use keyboard shortcuts (⌘1-5) for instant template creation</li>
              <li>• Set up email rules to auto-forward deal-related emails</li>
              <li>• Keep deal templates updated with your most common scenarios</li>
              <li>• Use the email parser for complex deals with multiple requirements</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}