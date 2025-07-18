'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LinkedInProfileViewer } from '@/components/linkedin/profile-viewer';
import { LinkedInMessaging } from '@/components/linkedin/messaging';
import { LinkedInLeadEnrichment } from '@/components/linkedin/lead-enrichment';
import { LinkedInContentSharing } from '@/components/linkedin/content-sharing';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Linkedin, Users, MessageSquare, Share2, TrendingUp, UserPlus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { authHelpers } from '@/lib/supabase/auth';
import { toast } from 'sonner';

export default function LinkedInIntegrationPage() {
  const { user } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasLinkedInToken, setHasLinkedInToken] = useState(false);
  const [stats, setStats] = useState({
    connections: 0,
    messagesSent: 0,
    profileViews: 0,
    leadsEnriched: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLinkedInStats();
  }, []);

  const loadLinkedInStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/linkedin/stats');
      
      if (response.ok) {
        const data = await response.json();
        setHasLinkedInToken(data.hasIntegration);
        if (data.stats) {
          setStats(data.stats);
        }
      } else {
        setHasLinkedInToken(false);
      }
    } catch (error) {
      console.error('Failed to load LinkedIn stats:', error);
      setHasLinkedInToken(false);
    } finally {
      setLoading(false);
    }
  };

  const connectLinkedIn = async () => {
    try {
      setIsConnecting(true);
      await authHelpers.signInWithLinkedIn();
      // The OAuth flow will redirect to /auth/linkedin/callback
      // No need to reload stats here as the page will redirect
    } catch (error) {
      console.error('LinkedIn connection error:', error);
      toast.error('Failed to connect to LinkedIn. Please try again.');
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Linkedin className="w-8 h-8 text-blue-500" />
              LinkedIn Integration
            </h1>
            <p className="text-zinc-400 mt-2">
              Connect with professionals and enrich your lead data
            </p>
          </div>
          
          {!hasLinkedInToken && (
            <Button
              onClick={connectLinkedIn}
              disabled={isConnecting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Linkedin className="w-4 h-4 mr-2" />
              {isConnecting ? 'Connecting...' : 'Connect LinkedIn'}
            </Button>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-black/40 backdrop-blur-xl border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Connections</p>
                  <p className="text-2xl font-bold text-white">
                    {loading ? '...' : stats.connections.toLocaleString()}
                  </p>
                </div>
                <Users className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 backdrop-blur-xl border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Messages Sent</p>
                  <p className="text-2xl font-bold text-white">
                    {loading ? '...' : stats.messagesSent.toLocaleString()}
                  </p>
                </div>
                <MessageSquare className="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 backdrop-blur-xl border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Profile Views</p>
                  <p className="text-2xl font-bold text-white">
                    {loading ? '...' : stats.profileViews.toLocaleString()}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 backdrop-blur-xl border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Leads Enriched</p>
                  <p className="text-2xl font-bold text-white">
                    {loading ? '...' : stats.leadsEnriched.toLocaleString()}
                  </p>
                </div>
                <UserPlus className="w-8 h-8 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-zinc-900/50 border border-zinc-800">
            <TabsTrigger value="profile" className="data-[state=active]:bg-zinc-700">
              Profile
            </TabsTrigger>
            <TabsTrigger value="messaging" className="data-[state=active]:bg-zinc-700">
              Messaging
            </TabsTrigger>
            <TabsTrigger value="lead-enrichment" className="data-[state=active]:bg-zinc-700">
              Lead Enrichment
            </TabsTrigger>
            <TabsTrigger value="content-sharing" className="data-[state=active]:bg-zinc-700">
              Content Sharing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <LinkedInProfileViewer />
          </TabsContent>

          <TabsContent value="messaging" className="space-y-6">
            <LinkedInMessaging />
          </TabsContent>

          <TabsContent value="lead-enrichment" className="space-y-6">
            <LinkedInLeadEnrichment />
          </TabsContent>

          <TabsContent value="content-sharing" className="space-y-6">
            <LinkedInContentSharing />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}