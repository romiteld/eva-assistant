'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Microsoft365Client } from '@/lib/integrations/microsoft365';
import { 
  Users, 
  MessageSquare, 
  Video, 
  Hash,
  Send,
  Plus,
  Settings,
  Bell,
  Calendar,
  FileText,
  Loader2
} from 'lucide-react';

interface Team {
  id: string;
  displayName: string;
  description?: string;
  webUrl?: string;
}

interface Channel {
  id: string;
  displayName: string;
  description?: string;
  membershipType: string;
}

export default function TeamsPage() {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const [message, setMessage] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDescription, setNewChannelDescription] = useState('');
  const [showNewChannel, setShowNewChannel] = useState(false);

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      loadChannels(selectedTeam.id);
    }
  }, [selectedTeam]);

  const loadTeams = async () => {
    try {
      setLoading(true);
      // In a real implementation, this would fetch from Microsoft Graph API
      // For now, we'll use mock data
      const mockTeams: Team[] = [
        {
          id: '1',
          displayName: 'Recruiting Team',
          description: 'Main recruiting team for all positions',
          webUrl: 'https://teams.microsoft.com/...'
        },
        {
          id: '2',
          displayName: 'Financial Advisors',
          description: 'Team for financial advisor recruitment',
          webUrl: 'https://teams.microsoft.com/...'
        }
      ];
      setTeams(mockTeams);
      if (mockTeams.length > 0) {
        setSelectedTeam(mockTeams[0]);
      }
    } catch (error) {
      toast({
        title: 'Error loading teams',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadChannels = async (teamId: string) => {
    try {
      // In a real implementation, this would fetch from Microsoft Graph API
      const mockChannels: Channel[] = [
        {
          id: '1',
          displayName: 'General',
          description: 'General team discussions',
          membershipType: 'standard'
        },
        {
          id: '2',
          displayName: 'Candidate Pipeline',
          description: 'Discussion about active candidates',
          membershipType: 'standard'
        },
        {
          id: '3',
          displayName: 'Interview Scheduling',
          description: 'Coordinate interview schedules',
          membershipType: 'standard'
        }
      ];
      setChannels(mockChannels);
      if (mockChannels.length > 0) {
        setSelectedChannel(mockChannels[0]);
      }
    } catch (error) {
      toast({
        title: 'Error loading channels',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSendMessage = async () => {
    if (!selectedTeam || !selectedChannel || !message.trim()) return;

    try {
      setSending(true);
      
      // Initialize Microsoft365 client
      const client = new Microsoft365Client();
      await client.sendTeamsMessage(
        selectedTeam.id,
        selectedChannel.id,
        message
      );

      toast({
        title: 'Message sent',
        description: 'Your message has been posted to Teams.',
      });

      setMessage('');
    } catch (error) {
      toast({
        title: 'Error sending message',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleCreateChannel = async () => {
    if (!selectedTeam || !newChannelName.trim()) return;

    try {
      const client = new Microsoft365Client();
      await client.createTeamsChannel(selectedTeam.id, {
        displayName: newChannelName,
        description: newChannelDescription,
      });

      toast({
        title: 'Channel created',
        description: `${newChannelName} has been created successfully.`,
      });

      setNewChannelName('');
      setNewChannelDescription('');
      setShowNewChannel(false);
      loadChannels(selectedTeam.id);
    } catch (error) {
      toast({
        title: 'Error creating channel',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Microsoft Teams</h1>
            <p className="text-gray-400 mt-2">Collaborate with your recruiting team</p>
          </div>
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Teams Sidebar */}
          <div className="col-span-3">
            <Card className="bg-white/5 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-lg">Your Teams</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeam(team)}
                    className={`w-full text-left p-4 hover:bg-white/5 transition-colors ${
                      selectedTeam?.id === team.id ? 'bg-white/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-purple-400" />
                      <div>
                        <p className="font-medium text-white">{team.displayName}</p>
                        <p className="text-xs text-gray-400">{team.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Channels */}
          <div className="col-span-3">
            <Card className="bg-white/5 backdrop-blur-xl border-white/10">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Channels</CardTitle>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => setShowNewChannel(true)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setSelectedChannel(channel)}
                    className={`w-full text-left p-4 hover:bg-white/5 transition-colors ${
                      selectedChannel?.id === channel.id ? 'bg-white/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Hash className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="font-medium text-white">{channel.displayName}</p>
                        {channel.description && (
                          <p className="text-xs text-gray-400">{channel.description}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {showNewChannel && (
              <Card className="bg-white/5 backdrop-blur-xl border-white/10 mt-4">
                <CardHeader>
                  <CardTitle className="text-lg">Create Channel</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder="Channel name"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                  />
                  <Textarea
                    placeholder="Description (optional)"
                    value={newChannelDescription}
                    onChange={(e) => setNewChannelDescription(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleCreateChannel} size="sm">
                      Create
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setShowNewChannel(false);
                        setNewChannelName('');
                        setNewChannelDescription('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Message Area */}
          <div className="col-span-6">
            <Card className="bg-white/5 backdrop-blur-xl border-white/10 h-full">
              <CardHeader className="border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {selectedChannel ? `# ${selectedChannel.displayName}` : 'Select a channel'}
                    </CardTitle>
                    {selectedChannel?.description && (
                      <p className="text-sm text-gray-400 mt-1">{selectedChannel.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost">
                      <Video className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Calendar className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost">
                      <FileText className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col h-[calc(100%-5rem)]">
                {/* Messages area - in real app would show chat history */}
                <div className="flex-1 overflow-y-auto mb-4">
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No messages yet</p>
                      <p className="text-sm mt-2">Start a conversation in this channel</p>
                    </div>
                  </div>
                </div>

                {/* Message input */}
                {selectedChannel && (
                  <div className="border-t border-white/10 pt-4">
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Type a message..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={3}
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                      />
                      <Button 
                        onClick={handleSendMessage} 
                        disabled={!message.trim() || sending}
                      >
                        {sending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Integration Notice */}
        <Card className="bg-yellow-500/10 backdrop-blur-xl border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-yellow-400" />
              <div>
                <p className="text-sm font-medium text-yellow-200">Microsoft Teams Integration</p>
                <p className="text-xs text-yellow-200/80 mt-1">
                  To use Teams features, ensure you have connected your Microsoft account with Teams permissions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}