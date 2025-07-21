'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Competitor, CompetitorAlert } from '@/types/competitor-analysis';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Bell,
  Calendar,
  Clock,
  Eye,
  Filter,
  Globe,
  RefreshCw,
  Settings,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  Users,
  FileText,
  DollarSign,
  MessageSquare,
  Package,
  Share2,
  ChevronRight,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

interface CompetitorTrackerProps {
  competitors: Competitor[];
  alerts: CompetitorAlert[];
}

// Activity Timeline Component
function ActivityTimeline({ activities }: { activities: any[] }) {
  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
      
      <div className="space-y-4">
        {activities.map((activity, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-start gap-4"
          >
            <div className={cn(
              "relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 bg-background",
              activity.type === 'alert' && "border-red-500",
              activity.type === 'update' && "border-blue-500",
              activity.type === 'analysis' && "border-green-500"
            )}>
              {activity.type === 'alert' && <AlertTriangle className="h-4 w-4 text-red-500" />}
              {activity.type === 'update' && <RefreshCw className="h-4 w-4 text-blue-500" />}
              {activity.type === 'analysis' && <BarChart3 className="h-4 w-4 text-green-500" />}
            </div>
            
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">{activity.title}</h4>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{activity.description}</p>
              {activity.competitor && (
                <Badge variant="outline" className="text-xs">
                  {activity.competitor}
                </Badge>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Monitoring Status Card
function MonitoringStatusCard({ 
  competitor,
  status 
}: { 
  competitor: Competitor;
  status: any;
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", getStatusColor(status.health))} />
            <h4 className="font-medium">{competitor.name}</h4>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Last Check</p>
            <p className="font-medium">
              {status.lastCheck ? formatDistanceToNow(new Date(status.lastCheck), { addSuffix: true }) : 'Never'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Next Check</p>
            <p className="font-medium">
              {status.nextCheck ? formatDistanceToNow(new Date(status.nextCheck), { addSuffix: true }) : 'Not scheduled'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Changes</p>
            <p className="font-medium">{status.changesDetected || 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Alerts</p>
            <p className="font-medium">{status.alertsGenerated || 0}</p>
          </div>
        </div>
        
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Monitoring Coverage</span>
            <span className="font-medium">{status.coverage || 85}%</span>
          </div>
          <Progress value={status.coverage || 85} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  );
}

export function CompetitorTracker({ competitors, alerts }: CompetitorTrackerProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'critical' | 'updates' | 'analysis'>('all');
  const [monitoringStatus, setMonitoringStatus] = useState<Map<string, any>>(new Map());
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMonitoringData = useCallback(() => {
    // Create monitoring status for each competitor
    const statusMap = new Map();
    competitors.forEach(comp => {
      statusMap.set(comp.id, {
        health: ['active', 'warning', 'error'][Math.floor(Math.random() * 3)],
        lastCheck: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        nextCheck: new Date(Date.now() + Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        changesDetected: Math.floor(Math.random() * 20),
        alertsGenerated: Math.floor(Math.random() * 10),
        coverage: 70 + Math.floor(Math.random() * 30)
      });
    });
    setMonitoringStatus(statusMap);

    // Create activity timeline
    const allActivities = [
      ...alerts.map(alert => ({
        type: 'alert',
        title: alert.title,
        description: alert.description,
        timestamp: alert.detectedAt,
        competitor: competitors.find(c => c.id === alert.competitorId)?.name
      })),
      // Add some mock activities
      {
        type: 'update',
        title: 'Website content updated',
        description: 'Detected changes in product pricing page',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        competitor: competitors[0]?.name
      },
      {
        type: 'analysis',
        title: 'Analysis completed',
        description: 'Full competitive analysis report generated',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        competitor: 'All competitors'
      }
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    setActivities(allActivities);
  }, [competitors, alerts]);

  useEffect(() => {
    loadMonitoringData();
  }, [loadMonitoringData]);

  // Filter activities based on selected filter and time range
  const filteredActivities = activities.filter(activity => {
    // Time range filter
    const activityDate = new Date(activity.timestamp);
    const now = new Date();
    const hoursDiff = (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60);
    
    if (selectedTimeRange === '24h' && hoursDiff > 24) return false;
    if (selectedTimeRange === '7d' && hoursDiff > 24 * 7) return false;
    if (selectedTimeRange === '30d' && hoursDiff > 24 * 30) return false;

    // Type filter
    if (selectedFilter === 'critical' && activity.type !== 'alert') return false;
    if (selectedFilter === 'updates' && activity.type !== 'update') return false;
    if (selectedFilter === 'analysis' && activity.type !== 'analysis') return false;

    return true;
  });

  // Calculate statistics
  const stats = {
    totalAlerts: alerts.length,
    criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
    activeMonitoring: competitors.filter(c => c.status === 'active').length,
    recentChanges: activities.filter(a => {
      const hoursDiff = (new Date().getTime() - new Date(a.timestamp).getTime()) / (1000 * 60 * 60);
      return hoursDiff <= 24;
    }).length
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Competitor Tracking</CardTitle>
            <CardDescription>
              Real-time monitoring and activity tracking
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Activity className="h-3 w-3" />
              {stats.activeMonitoring} Active
            </Badge>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="activity">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="activity" className="gap-2">
              <Activity className="h-4 w-4" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="gap-2">
              <Eye className="h-4 w-4" />
              Monitoring
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2">
              <Calendar className="h-4 w-4" />
              Schedule
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="space-y-4">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{stats.totalAlerts}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total Alerts</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-2xl font-bold text-red-600">{stats.criticalAlerts}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Critical</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{stats.activeMonitoring}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Monitoring</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{stats.recentChanges}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Recent (24h)</p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant={selectedFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={selectedFilter === 'critical' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedFilter('critical')}
                >
                  Critical
                </Button>
                <Button
                  variant={selectedFilter === 'updates' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedFilter('updates')}
                >
                  Updates
                </Button>
                <Button
                  variant={selectedFilter === 'analysis' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedFilter('analysis')}
                >
                  Analysis
                </Button>
              </div>
              
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value as any)}
                className="px-3 py-1.5 border rounded-lg text-sm bg-background"
              >
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </div>

            {/* Activity Timeline */}
            <ScrollArea className="h-96">
              {filteredActivities.length > 0 ? (
                <ActivityTimeline activities={filteredActivities} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No activities found for the selected filters
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {competitors.map(competitor => (
                <MonitoringStatusCard
                  key={competitor.id}
                  competitor={competitor}
                  status={monitoringStatus.get(competitor.id) || {}}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monitoring Schedule</CardTitle>
                <CardDescription>
                  Automated tracking and analysis schedule
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {competitors.map(competitor => {
                    const status = monitoringStatus.get(competitor.id);
                    return (
                      <div key={competitor.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            status?.health === 'active' ? "bg-green-500" :
                            status?.health === 'warning' ? "bg-yellow-500" :
                            "bg-red-500"
                          )} />
                          <div>
                            <p className="font-medium">{competitor.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Next check: {status?.nextCheck ? format(new Date(status.nextCheck), 'PPp') : 'Not scheduled'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Daily</Badge>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">Scheduled Tasks</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Daily website monitoring</span>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Weekly competitive analysis</span>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Monthly market report</span>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}