'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Mail, 
  Send, 
  Users, 
  Calendar,
  BarChart,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/app/providers';
import { toast } from 'sonner';

interface Campaign {
  id: number;
  name: string;
  status: string;
  sent: number;
  opened: number;
  responded: number;
}

export default function OutreachPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([
    { id: 1, name: 'Q1 Financial Advisor Recruitment', status: 'active', sent: 245, opened: 189, responded: 42 },
    { id: 2, name: 'Senior Advisor Outreach', status: 'draft', sent: 0, opened: 0, responded: 0 },
    { id: 3, name: 'Follow-up Campaign', status: 'completed', sent: 123, opened: 98, responded: 21 }
  ]);

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Outreach Campaign Management</h1>
            <p className="text-gray-400 mt-2">Create and manage personalized outreach campaigns at scale</p>
          </div>
          <Button>
            <Mail className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400" />
                Total Sent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">368</div>
              <p className="text-xs text-gray-400">This month</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                Open Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">76.3%</div>
              <p className="text-xs text-gray-400">+5.2% vs last month</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                Response Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">24.7%</div>
              <p className="text-xs text-gray-400">Above average</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-yellow-400" />
                Scheduled
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">12</div>
              <p className="text-xs text-gray-400">Upcoming campaigns</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="campaigns" className="space-y-4">
          <TabsList>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="space-y-4">
            {campaigns.map((campaign: Campaign) => (
              <Card key={campaign.id} className="bg-white/5 backdrop-blur-xl border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-white">{campaign.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>Sent: {campaign.sent}</span>
                        <span>Opened: {campaign.opened}</span>
                        <span>Responded: {campaign.responded}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="secondary"
                        className={
                          campaign.status === 'active' ? 'bg-green-500/20 text-green-400' :
                          campaign.status === 'draft' ? 'bg-gray-500/20 text-gray-400' :
                          'bg-blue-500/20 text-blue-400'
                        }
                      >
                        {campaign.status}
                      </Badge>
                      <Button size="sm" variant="ghost">View</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="templates">
            <Card className="bg-white/5 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle>Email Templates</CardTitle>
                <CardDescription>AI-powered templates for different outreach scenarios</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <Card className="bg-white/5 border-white/10">
                    <CardContent className="p-4">
                      <h4 className="font-medium text-white mb-2">Initial Outreach - Senior Advisors</h4>
                      <p className="text-sm text-gray-400">Personalized template for reaching out to experienced financial advisors</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/5 border-white/10">
                    <CardContent className="p-4">
                      <h4 className="font-medium text-white mb-2">Follow-up - No Response</h4>
                      <p className="text-sm text-gray-400">Gentle reminder for candidates who haven&apos;t responded to initial outreach</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/5 border-white/10">
                    <CardContent className="p-4">
                      <h4 className="font-medium text-white mb-2">Interview Invitation</h4>
                      <p className="text-sm text-gray-400">Professional invitation for qualified candidates to schedule interviews</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card className="bg-white/5 backdrop-blur-xl border-white/10">
              <CardContent className="p-6">
                <p className="text-gray-400 text-center">Campaign analytics dashboard coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}