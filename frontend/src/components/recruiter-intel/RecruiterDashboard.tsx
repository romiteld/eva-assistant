'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Plus, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Clock,
  Building,
  Filter,
  BarChart3,
  UserCheck,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Activity,
  Briefcase,
  Award
} from 'lucide-react';
import { RecruiterDashboard as RecruiterDashboardType } from '@/types/recruiter';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';

export function RecruiterDashboard() {
  const [recruiters, setRecruiters] = useState<RecruiterDashboardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTier, setFilterTier] = useState<string | null>(null);
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [timeRange, setTimeRange] = useState('90'); // days
  const { toast } = useToast();

  const fetchRecruiters = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      if (filterTier) params.append('performance_tier', filterTier);
      if (filterActive !== null) params.append('is_active', filterActive.toString());

      const response = await fetch(`/api/recruiters?${params}`);
      if (!response.ok) throw new Error('Failed to fetch recruiters');
      
      const { data } = await response.json();
      setRecruiters(data || []);
    } catch (error) {
      console.error('Error fetching recruiters:', error);
      toast({
        title: 'Error',
        description: 'Failed to load recruiters',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutiveMetrics = async () => {
    // Fetch high-level metrics for CEO view
    try {
      const response = await fetch(`/api/recruiters/metrics?period=${timeRange}`);
      if (response.ok) {
        const { data, aggregatedMetrics } = await response.json();
        // Process executive metrics
      }
    } catch (error) {
      console.error('Error fetching executive metrics:', error);
    }
  };

  // Executive-level KPIs
  const stats = {
    totalRecruiters: recruiters.length,
    activeRecruiters: recruiters.filter((r: RecruiterDashboardType) => r.is_active).length,
    totalPlacements: recruiters.reduce((sum: number, r: RecruiterDashboardType) => sum + r.recent_placements, 0),
    totalRevenue: recruiters.reduce((sum: number, r: RecruiterDashboardType) => sum + r.recent_revenue, 0),
    avgRevenuePerRecruiter: recruiters.filter(r => r.is_active).length > 0
      ? recruiters.reduce((sum: number, r: RecruiterDashboardType) => sum + r.recent_revenue, 0) / recruiters.filter((r: RecruiterDashboardType) => r.is_active).length
      : 0,
    utilizationRate: recruiters.filter(r => r.is_active && r.active_candidates > 0).length / Math.max(recruiters.filter(r => r.is_active).length, 1) * 100,
  };

  // Calculate performance distribution
  const performanceDistribution = {
    platinum: recruiters.filter(r => r.performance_tier === 'platinum').length,
    gold: recruiters.filter(r => r.performance_tier === 'gold').length,
    silver: recruiters.filter(r => r.performance_tier === 'silver').length,
    bronze: recruiters.filter(r => r.performance_tier === 'bronze').length,
  };

  // Top performers
  const topPerformers = [...recruiters]
    .sort((a, b) => b.recent_revenue - a.recent_revenue)
    .slice(0, 5);

  // At-risk recruiters (low activity or revenue)
  const atRiskRecruiters = recruiters.filter(r => 
    r.is_active && 
    (r.recent_placements === 0 || r.active_candidates < 2)
  );

  const performanceTierColors = {
    platinum: 'bg-purple-100 text-purple-800 border-purple-200',
    gold: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    silver: 'bg-gray-100 text-gray-800 border-gray-200',
    bronze: 'bg-orange-100 text-orange-800 border-orange-200',
  };

  useEffect(() => {
    fetchRecruiters();
    fetchExecutiveMetrics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filterTier, filterActive, timeRange]);

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Executive Dashboard</h1>
          <p className="text-muted-foreground">Recruiter performance intelligence for strategic decision making</p>
        </div>
        <div className="flex items-center gap-4">
          <select 
            className="px-4 py-2 border rounded-md"
            value={timeRange}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTimeRange(e.target.value)}
          >
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 6 months</option>
            <option value="365">Last year</option>
          </select>
          <Link href="/recruiters/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Recruiter
            </Button>
          </Link>
        </div>
      </div>

      {/* Executive KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.totalRevenue.toLocaleString()}
            </div>
            <div className="flex items-center text-xs text-green-600">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              <span>+12.5% from last period</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilization Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.utilizationRate.toFixed(1)}%</div>
            <Progress value={stats.utilizationRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              Active recruiters with pipeline
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Revenue/Recruiter</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${Math.round(stats.avgRevenuePerRecruiter).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Target: $50,000
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Placement Success</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPlacements}</div>
            <p className="text-xs text-muted-foreground">
              Total placements ({timeRange} days)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Distribution & Alerts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Performance Distribution</CardTitle>
            <CardDescription>Recruiter tier breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(performanceDistribution).map(([tier, count]) => (
                <div key={tier} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={cn(
                      'capitalize',
                      performanceTierColors[tier as keyof typeof performanceTierColors]
                    )}>
                      {tier}
                    </Badge>
                    <span className="text-sm font-medium">{count} recruiters</span>
                  </div>
                  <div className="w-32">
                    <Progress 
                      value={(count / stats.totalRecruiters) * 100} 
                      className="h-2"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Executive Alerts</CardTitle>
            <CardDescription>Items requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {atRiskRecruiters.length > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900">
                      {atRiskRecruiters.length} recruiters at risk
                    </p>
                    <p className="text-xs text-red-700">
                      Low activity or no recent placements
                    </p>
                  </div>
                  <Link href="/recruiters/at-risk">
                    <Button size="sm" variant="outline" className="text-xs">
                      Review
                    </Button>
                  </Link>
                </div>
              )}
              
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                <Briefcase className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">
                    15 high-value positions open
                  </p>
                  <p className="text-xs text-blue-700">
                    $2.5M potential revenue
                  </p>
                </div>
                <Button size="sm" variant="outline" className="text-xs">
                  Assign
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performers</CardTitle>
          <CardDescription>Leading recruiters by revenue</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topPerformers.map((recruiter: RecruiterDashboardType, index: number) => (
              <div key={recruiter.id} className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{recruiter.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {recruiter.company_name || 'Independent'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="font-semibold">${recruiter.recent_revenue.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{recruiter.recent_placements} placements</p>
                  </div>
                  <Badge className={cn(
                    'capitalize',
                    recruiter.performance_tier && performanceTierColors[recruiter.performance_tier as keyof typeof performanceTierColors]
                  )}>
                    {recruiter.performance_tier || 'unranked'}
                  </Badge>
                  <Link href={`/recruiters/${recruiter.id}/insights`}>
                    <Button size="sm" variant="outline">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Insights
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Recruiter List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Recruiters</CardTitle>
              <CardDescription>Complete recruiter roster and performance metrics</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search recruiters..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50">
                <tr>
                  <th className="px-6 py-3">Recruiter</th>
                  <th className="px-6 py-3">Company/Type</th>
                  <th className="px-6 py-3">Performance</th>
                  <th className="px-6 py-3">Revenue</th>
                  <th className="px-6 py-3">Placements</th>
                  <th className="px-6 py-3">Pipeline</th>
                  <th className="px-6 py-3">Last Activity</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    </td>
                  </tr>
                ) : recruiters.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted-foreground">
                      No recruiters found
                    </td>
                  </tr>
                ) : (
                  recruiters.map((recruiter: RecruiterDashboardType) => (
                    <tr key={recruiter.id} className="border-b hover:bg-muted/50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium">{recruiter.full_name}</div>
                          <div className="text-xs text-muted-foreground">{recruiter.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm">{recruiter.company_name || 'Independent'}</div>
                          <Badge variant="outline" className="text-xs mt-1">
                            {recruiter.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {recruiter.performance_tier && (
                          <Badge className={cn(
                            'capitalize',
                            performanceTierColors[recruiter.performance_tier as keyof typeof performanceTierColors]
                          )}>
                            {recruiter.performance_tier}
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-semibold">
                            ${recruiter.recent_revenue.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Last {timeRange} days
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="font-semibold">{recruiter.recent_placements}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">{recruiter.active_candidates}</div>
                          <div className="text-xs text-muted-foreground">active</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        {new Date(recruiter.last_activity).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Link href={`/recruiters/${recruiter.id}`}>
                            <Button size="sm" variant="outline">
                              Profile
                            </Button>
                          </Link>
                          <Link href={`/recruiters/${recruiter.id}/insights`}>
                            <Button size="sm" variant="outline">
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}