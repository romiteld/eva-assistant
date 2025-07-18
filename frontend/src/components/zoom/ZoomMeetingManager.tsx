'use client'

import { useState } from 'react'
import { useZoomMeetings } from '@/hooks/useZoomMeetings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { 
  Video, 
  Calendar, 
  Clock, 
  ExternalLink,
  Play,
  RefreshCw,
  AlertCircle,
  Copy,
  Trash2,
  Zap
} from 'lucide-react'
import { format } from 'date-fns'

export function ZoomMeetingManager() {
  const {
    meetings,
    loading,
    error,
    isAuthenticated,
    startMeeting,
    getJoinUrl,
    createInstantMeeting,
    scheduleMeeting,
    deleteMeeting,
    connectZoom,
    disconnectZoom,
    refreshMeetings
  } = useZoomMeetings()

  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [newMeeting, setNewMeeting] = useState({
    topic: '',
    startTime: '',
    duration: 60,
    agenda: ''
  })
  const [startMeetingConfirm, setStartMeetingConfirm] = useState<{
    open: boolean;
    meetingId: string | null;
  }>({ open: false, meetingId: null })
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    open: boolean;
    meetingId: string | null;
    meetingTopic: string;
  }>({ open: false, meetingId: null, meetingTopic: '' })

  const handleCreateInstantMeeting = async () => {
    if (!newMeeting.topic) return

    try {
      setActionLoading('instant')
      const meeting = await createInstantMeeting(newMeeting.topic)
      setNewMeeting({ ...newMeeting, topic: '' })
      
      // Show start meeting confirmation
      setStartMeetingConfirm({ open: true, meetingId: meeting.id })
    } catch (err) {
      console.error('Failed to create instant meeting:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleScheduleMeeting = async () => {
    if (!newMeeting.topic || !newMeeting.startTime) return

    try {
      setActionLoading('schedule')
      await scheduleMeeting(newMeeting.topic, newMeeting.startTime, newMeeting.duration)
      setNewMeeting({ topic: '', startTime: '', duration: 60, agenda: '' })
    } catch (err) {
      console.error('Failed to schedule meeting:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleStartMeeting = async (meetingId: string) => {
    try {
      setActionLoading(`start-${meetingId}`)
      const startUrl = await startMeeting(meetingId)
      window.open(startUrl, '_blank')
    } catch (err) {
      console.error('Failed to start meeting:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleJoinMeeting = async (meetingId: string) => {
    try {
      setActionLoading(`join-${meetingId}`)
      const joinUrl = await getJoinUrl(meetingId)
      window.open(joinUrl, '_blank')
    } catch (err) {
      console.error('Failed to get join URL:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCopyJoinUrl = async (meetingId: string) => {
    try {
      const joinUrl = await getJoinUrl(meetingId)
      await navigator.clipboard.writeText(joinUrl)
    } catch (err) {
      console.error('Failed to copy join URL:', err)
    }
  }

  const handleDeleteMeeting = async (meetingId: string, meetingTopic: string) => {
    setDeleteConfirmation({ open: true, meetingId, meetingTopic })
  }

  const confirmDeleteMeeting = async () => {
    const { meetingId } = deleteConfirmation
    if (!meetingId) return

    try {
      setActionLoading(`delete-${meetingId}`)
      await deleteMeeting(meetingId)
    } catch (err) {
      console.error('Failed to delete meeting:', err)
    } finally {
      setActionLoading(null)
      setDeleteConfirmation({ open: false, meetingId: null, meetingTopic: '' })
    }
  }

  const confirmStartMeeting = async () => {
    const { meetingId } = startMeetingConfirm
    if (!meetingId) return

    try {
      const startUrl = await startMeeting(meetingId)
      window.open(startUrl, '_blank')
    } catch (err) {
      console.error('Failed to start meeting:', err)
    } finally {
      setStartMeetingConfirm({ open: false, meetingId: null })
    }
  }

  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Zoom Integration
          </CardTitle>
          <CardDescription>
            Connect your Zoom account to create and manage meetings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg">
              <Video className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-4">
                Connect your Zoom account to start creating and managing meetings
              </p>
              <Button onClick={connectZoom} className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                Connect Zoom Account
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Zoom Meetings</h1>
          <p className="text-gray-600">Create and manage your Zoom meetings</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={refreshMeetings}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={disconnectZoom} variant="outline" size="sm">
            Disconnect
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Instant Meeting
            </CardTitle>
            <CardDescription>
              Start a meeting right now
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Input
                placeholder="Meeting topic"
                value={newMeeting.topic}
                onChange={(e) => setNewMeeting({ ...newMeeting, topic: e.target.value })}
              />
              <Button
                onClick={handleCreateInstantMeeting}
                disabled={!newMeeting.topic || actionLoading === 'instant'}
                className="w-full"
              >
                {actionLoading === 'instant' ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Start Instant Meeting
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Schedule Meeting
            </CardTitle>
            <CardDescription>
              Plan a meeting for later
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Input
                placeholder="Meeting topic"
                value={newMeeting.topic}
                onChange={(e) => setNewMeeting({ ...newMeeting, topic: e.target.value })}
              />
              <Input
                type="datetime-local"
                value={newMeeting.startTime}
                onChange={(e) => setNewMeeting({ ...newMeeting, startTime: e.target.value })}
              />
              <Button
                onClick={handleScheduleMeeting}
                disabled={!newMeeting.topic || !newMeeting.startTime || actionLoading === 'schedule'}
                className="w-full"
              >
                {actionLoading === 'schedule' ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Calendar className="h-4 w-4 mr-2" />
                )}
                Schedule Meeting
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Meetings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {meetings.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No meetings found</p>
            ) : (
              meetings.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  onStart={() => handleStartMeeting(meeting.id)}
                  onJoin={() => handleJoinMeeting(meeting.id)}
                  onCopy={() => handleCopyJoinUrl(meeting.id)}
                  onDelete={() => handleDeleteMeeting(meeting.id, meeting.topic)}
                  actionLoading={actionLoading}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Start Meeting Confirmation Dialog */}
      <ConfirmationDialog
        open={startMeetingConfirm.open}
        onOpenChange={(open) => !open && setStartMeetingConfirm({ open: false, meetingId: null })}
        title="Start Meeting"
        description="Meeting created! Would you like to start it now?"
        actionLabel="Start Meeting"
        onConfirm={confirmStartMeeting}
      />

      {/* Delete Meeting Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteConfirmation.open}
        onOpenChange={(open) => !open && setDeleteConfirmation({ open: false, meetingId: null, meetingTopic: '' })}
        title="Delete Meeting"
        description={`Are you sure you want to delete "${deleteConfirmation.meetingTopic}"? This action cannot be undone.`}
        actionLabel="Delete"
        onConfirm={confirmDeleteMeeting}
        variant="destructive"
      />
    </div>
  )
}

interface MeetingCardProps {
  meeting: any
  onStart: () => void
  onJoin: () => void
  onCopy: () => void
  onDelete: () => void
  actionLoading: string | null
}

function MeetingCard({ meeting, onStart, onJoin, onCopy, onDelete, actionLoading }: MeetingCardProps) {
  const isLoading = (action: string) => actionLoading === `${action}-${meeting.id}`

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold">{meeting.topic}</h3>
              <Badge variant="outline">{meeting.type === 1 ? 'Instant' : 'Scheduled'}</Badge>
              <Badge variant={meeting.status === 'started' ? 'success' : 'outline'}>
                {meeting.status === 'started' ? 'Live' : 'Ready'}
              </Badge>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(meeting.start_time), 'MMM dd, yyyy • h:mm a')}
              </div>
              <div className="flex items-center gap-1">
                <Video className="h-3 w-3" />
                Duration: {meeting.duration} minutes
              </div>
              {meeting.agenda && (
                <p className="text-gray-500 text-xs mt-1">{meeting.agenda}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={onStart}
              disabled={isLoading('start')}
              className="flex items-center gap-1"
            >
              {isLoading('start') ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              Start
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onJoin}
              disabled={isLoading('join')}
            >
              {isLoading('join') ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <ExternalLink className="h-3 w-3" />
              )}
              Join
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onCopy}
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDelete}
              disabled={isLoading('delete')}
            >
              {isLoading('delete') ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}