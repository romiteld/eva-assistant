'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Activity,
  Calendar,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface DealMetricsDashboardProps {
  data: any;
}

export const DealMetricsDashboard: React.FC<DealMetricsDashboardProps> = ({ data: initialData }) => {
  const [timeRange, setTimeRange] = useState('7d');
  const [data, setData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async (range: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/deals/metrics?timeRange=${range}`);
      if (response.ok) {
        const newData = await response.json();
        setData(newData);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (timeRange !== '7d') {
      fetchData(timeRange);
    }
  }, [timeRange]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">No data available</div>
      </div>
    );
  }

  // Prepare chart data
  const sourceData = Object.entries(data.bySource || {}).map(([source, metrics]: [string, any]) => ({
    name: source.charAt(0).toUpperCase() + source.slice(1),
    deals: metrics.count,
    avgTime: (metrics.avgDuration / 1000).toFixed(1)
  }));

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  const performanceTrend = data.trend?.map((item: any) => ({
    ...item,
    avgDuration: (item.avgDuration / 1000).toFixed(1)
  })) || [];

  // Calculate performance score
  const performanceScore = Math.round(
    ((data.summary.under30s / data.summary.totalDeals) * 100) || 0
  );

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          
          <button
            onClick={() => fetchData(timeRange)}
            disabled={isLoading}
            className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <button className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900">
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </div>

      {/* Performance Score */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Performance Score</h3>
            <p className="text-sm text-gray-600">
              Percentage of deals created in under 30 seconds
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600">{performanceScore}%</div>
            <div className="text-sm text-gray-600 mt-1">
              {data.summary.under30s} of {data.summary.totalDeals} deals
            </div>
          </div>
        </div>
        
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                performanceScore >= 80 ? 'bg-green-500' :
                performanceScore >= 60 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${performanceScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Creation Time Trend */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Creation Time Trend
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={performanceTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value) => `${value}s`} />
              <Line
                type="monotone"
                dataKey="avgDuration"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ fill: '#3B82F6' }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ fill: '#10B981' }}
                yAxisId="right"
              />
              <YAxis yAxisId="right" orientation="right" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Source Distribution */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            Deals by Source
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={sourceData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="deals"
              >
                {sourceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Average Time by Source */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-600" />
            Average Time by Source
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={sourceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `${value}s`} />
              <Bar dataKey="avgTime" fill="#F59E0B" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Deals Table */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-600" />
            Recent Deal Creations
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.recentDeals?.map((deal: any, index: number) => (
              <div key={index} className="flex items-center justify-between py-2 border-b">
                <div>
                  <div className="text-sm font-medium">{deal.dealId}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(deal.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium ${
                    deal.duration < 30000 ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    {(deal.duration / 1000).toFixed(1)}s
                  </div>
                  <div className="text-xs text-gray-500 capitalize">{deal.source}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-yellow-50 rounded-xl p-6 border border-yellow-200">
        <h3 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Performance Insights
        </h3>
        <div className="space-y-2 text-sm text-yellow-800">
          {performanceScore < 60 && (
            <div>• Consider optimizing your Zoho API integration to improve speed</div>
          )}
          {data.bySource.email && data.bySource.email.avgDuration > 35000 && (
            <div>• Email parsing is taking longer than expected. Review complex emails manually</div>
          )}
          {data.summary.totalDeals < 10 && (
            <div>• Limited data available. Create more deals to see detailed trends</div>
          )}
          {performanceScore >= 80 && (
            <div>• Excellent performance! {performanceScore}% of deals created under target time</div>
          )}
        </div>
      </div>
    </div>
  );
};