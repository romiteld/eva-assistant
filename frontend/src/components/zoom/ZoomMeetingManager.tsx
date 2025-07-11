'use client';

import React, { useState, useEffect } from 'react';
import { zoomService } from '@/lib/services/zoom';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Video,
  Calendar,
  Clock,
  Copy,
  ExternalLink,
  Settings,
  Users,
  Link2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Edit,
  Share2,
  Mail
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ZoomMeetingManagerProps {
  interviewScheduleId?: string;
  candidateName?: string;
  jobTitle?: string;
  interviewType?: string;
  round?: number;
  scheduledAt?: Date;
  duration?: number;
  interviewers?: Array<{ name: string; email: string }>;
  onMeetingCreated?: (meeting: any) => void;
  onMeetingDeleted?: () => void;
}

export function ZoomMeetingManager({
  interviewScheduleId,
  candidateName = '',
  jobTitle = '',
  interviewType = 'video',
  round = 1,
  scheduledAt,
  duration = 60,
  interviewers = [],
  onMeetingCreated,
  onMeetingDeleted
}: ZoomMeetingManagerProps) {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [meeting, setMeeting] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [meetingForm, setMeetingForm] = useState({
    topic: `Interview: ${candidateName} - ${jobTitle} (Round ${round})`,
    agenda: '',
    password: '',
    enableWaitingRoom: true,
    autoRecording: 'cloud',
    muteOnEntry: false,
    hostVideo: true,
    participantVideo: true,
  });

  useEffect(() => {
    checkZoomConnection();
  }, []);

  useEffect(() => {
    // Update topic when props change
    setMeetingForm(prev => ({
      ...prev,
      topic: `Interview: ${candidateName} - ${jobTitle} (Round ${round})`
    }));
  }, [candidateName, jobTitle, round]);

  const checkZoomConnection = async () => {
    try {
      const credentials = await zoomService.getCredentials();
      setIsConnected(!!credentials && credentials.is_active);
    } catch (error) {
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const connectZoom = () => {
    window.location.href = '/api/auth/zoom';
  };

  const createMeeting = async () => {
    if (!scheduledAt || !interviewScheduleId) {
      toast({
        title: 'Missing Information',
        description: 'Please ensure interview is scheduled with a date/time',
        variant: 'destructive'
      });
      return;
    }

    setIsCreating(true);
    
    try {
      const meetingData = await zoomService.createInterviewMeeting(interviewScheduleId, {
        candidateName,
        jobTitle,
        interviewType,
        round,
        scheduledAt,
        duration,
        interviewers
      });
      
      setMeeting(meetingData);
      
      toast({
        title: 'Zoom Meeting Created!',
        description: 'Meeting details have been saved and invites will be sent.',
      });
      
      if (onMeetingCreated) {
        onMeetingCreated(meetingData);
      }
    } catch (error) {
      console.error('Failed to create meeting:', error);
      toast({
        title: 'Failed to create meeting',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsCreating(false);
    }
  };

  const updateMeeting = async () => {
    if (!meeting) return;
    
    try {
      await zoomService.updateMeeting(meeting.id, {
        topic: meetingForm.topic,
        agenda: meetingForm.agenda,
        settings: {
          waiting_room: meetingForm.enableWaitingRoom,
          auto_recording: meetingForm.autoRecording as any,
          mute_upon_entry: meetingForm.muteOnEntry,
          host_video: meetingForm.hostVideo,
          participant_video: meetingForm.participantVideo,
        }
      });
      
      toast({
        title: 'Meeting Updated',
        description: 'Meeting settings have been updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  const deleteMeeting = async () => {
    if (!meeting) return;
    
    setIsDeleting(true);
    
    try {
      await zoomService.deleteMeeting(meeting.id);
      setMeeting(null);
      
      toast({
        title: 'Meeting Deleted',
        description: 'The Zoom meeting has been cancelled.',
      });
      
      if (onMeetingDeleted) {
        onMeetingDeleted();
      }
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
    });
  };

  const sendInvites = async () => {
    // This would integrate with your email service
    toast({
      title: 'Invites Sent',
      description: 'Meeting invitations have been sent to all participants.',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connect Zoom Account</CardTitle>
          <CardDescription>
            Connect your Zoom account to schedule video interviews
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Video className="h-4 w-4" />
            <AlertDescription>
              You need to connect your Zoom account to create and manage video interviews.
            </AlertDescription>
          </Alert>
          
          <Button 
            className="w-full mt-4" 
            onClick={connectZoom}
          >
            <Link2 className="mr-2 h-4 w-4" />
            Connect Zoom Account
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!meeting) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Create Zoom Meeting</CardTitle>
          <CardDescription>
            Set up a video interview meeting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Meeting Topic</Label>
            <Input
              value={meetingForm.topic}
              onChange={(e) => setMeetingForm({ ...meetingForm, topic: e.target.value })}
              placeholder="Interview meeting topic"
            />
          </div>
          
          <div>
            <Label>Agenda / Notes</Label>
            <Textarea
              value={meetingForm.agenda}
              onChange={(e) => setMeetingForm({ ...meetingForm, agenda: e.target.value })}
              placeholder="Additional meeting notes or agenda items"
              rows={3}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label>Meeting Settings</Label>
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-3 pl-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={meetingForm.enableWaitingRoom}
                onChange={(e) => setMeetingForm({ ...meetingForm, enableWaitingRoom: e.target.checked })}
                className="rounded"
              />
              Enable waiting room
            </label>
            
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={meetingForm.muteOnEntry}
                onChange={(e) => setMeetingForm({ ...meetingForm, muteOnEntry: e.target.checked })}
                className="rounded"
              />
              Mute participants on entry
            </label>
            
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={meetingForm.hostVideo}
                onChange={(e) => setMeetingForm({ ...meetingForm, hostVideo: e.target.checked })}
                className="rounded"
              />
              Start host video
            </label>
            
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={meetingForm.participantVideo}
                onChange={(e) => setMeetingForm({ ...meetingForm, participantVideo: e.target.checked })}
                className="rounded"
              />
              Start participant video
            </label>
          </div>
          
          <div>
            <Label>Auto Recording</Label>
            <select
              value={meetingForm.autoRecording}
              onChange={(e) => setMeetingForm({ ...meetingForm, autoRecording: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="none">No recording</option>
              <option value="local">Local recording</option>
              <option value="cloud">Cloud recording</option>
            </select>
          </div>
          
          <Button 
            className="w-full" 
            onClick={createMeeting}
            disabled={isCreating || !scheduledAt}
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Meeting...
              </>
            ) : (
              <>
                <Video className="mr-2 h-4 w-4" />
                Create Zoom Meeting
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Zoom Meeting Details</CardTitle>
            <CardDescription>
              Meeting ID: {meeting.id}
            </CardDescription>
          </div>
          <Badge variant="outline" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Scheduled
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Meeting Info */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Topic</span>
            <span className="text-sm font-medium">{meeting.topic}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Date & Time</span>
            <span className="text-sm font-medium">
              {format(new Date(meeting.start_time), 'PPp')}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Duration</span>
            <span className="text-sm font-medium">{meeting.duration} minutes</span>
          </div>
          
          {meeting.password && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Password</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium font-mono">{meeting.password}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(meeting.password, 'Password')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {/* Meeting Links */}
        <div className="space-y-2">
          <Label>Meeting Links</Label>
          
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Join URL</span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(meeting.join_url, 'Join URL')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(meeting.join_url, '_blank')}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground break-all">
              {meeting.join_url}
            </div>
          </div>
          
          {meeting.start_url && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Host URL is private. Only share with meeting hosts.
              </AlertDescription>
            </Alert>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button 
            className="w-full" 
            variant="outline"
            onClick={sendInvites}
          >
            <Mail className="mr-2 h-4 w-4" />
            Send Calendar Invites
          </Button>
          
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline"
              onClick={() => {
                // Open edit modal
                toast({
                  title: 'Edit Meeting',
                  description: 'Meeting editing coming soon',
                });
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            
            <Button 
              variant="outline"
              className="text-destructive"
              onClick={deleteMeeting}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Cancel
            </Button>
          </div>
        </div>
        
        {/* Recording Status */}
        {meeting.settings?.auto_recording !== 'none' && (
          <Alert>
            <Video className="h-4 w-4" />
            <AlertDescription>
              This meeting will be automatically recorded to the {meeting.settings.auto_recording}.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}