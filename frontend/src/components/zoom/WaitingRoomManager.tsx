'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'

interface WaitingRoomParticipant {
  id: string
  name: string
  email?: string
  join_time: string
  waiting_time: number
}

interface WaitingRoomManagerProps {
  meetingId: string
  accessToken: string
}

export function WaitingRoomManager({ meetingId, accessToken }: WaitingRoomManagerProps) {
  const [participants, setParticipants] = useState<WaitingRoomParticipant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])

  const loadWaitingRoomParticipants = useCallback(async () => {
    try {
      const response = await fetch(`/api/zoom/meetings/${meetingId}/waiting-room`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to load waiting room participants')
      }

      const data = await response.json()
      setParticipants(data.participants || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load participants')
    } finally {
      setLoading(false)
    }
  }, [meetingId, accessToken])

  useEffect(() => {
    loadWaitingRoomParticipants()
    // Poll for updates every 5 seconds
    const interval = setInterval(loadWaitingRoomParticipants, 5000)
    return () => clearInterval(interval)
  }, [loadWaitingRoomParticipants])

  const admitParticipant = async (participantId: string) => {
    try {
      const response = await fetch(`/api/zoom/meetings/${meetingId}/participants/${participantId}/admit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to admit participant')
      }

      // Remove from waiting room list
      setParticipants(prev => prev.filter(p => p.id !== participantId))
      setSelectedParticipants(prev => prev.filter(id => id !== participantId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to admit participant')
    }
  }

  const denyParticipant = async (participantId: string) => {
    try {
      const response = await fetch(`/api/zoom/meetings/${meetingId}/participants/${participantId}/deny`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to deny participant')
      }

      // Remove from waiting room list
      setParticipants(prev => prev.filter(p => p.id !== participantId))
      setSelectedParticipants(prev => prev.filter(id => id !== participantId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deny participant')
    }
  }

  const admitAll = async () => {
    try {
      const response = await fetch(`/api/zoom/meetings/${meetingId}/participants/admit-all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to admit all participants')
      }

      setParticipants([])
      setSelectedParticipants([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to admit all participants')
    }
  }

  const admitSelected = async () => {
    for (const participantId of selectedParticipants) {
      await admitParticipant(participantId)
    }
  }

  const toggleParticipantSelection = (participantId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(participantId)
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId]
    )
  }

  const formatWaitingTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-b-2 border-gray-900 rounded-full mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading waiting room...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Waiting Room
            </CardTitle>
            <CardDescription>
              {participants.length} {participants.length === 1 ? 'participant' : 'participants'} waiting
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {selectedParticipants.length > 0 && (
              <Button 
                onClick={admitSelected}
                size="sm"
                variant="outline"
              >
                Admit Selected ({selectedParticipants.length})
              </Button>
            )}
            {participants.length > 0 && (
              <Button 
                onClick={admitAll}
                size="sm"
                variant="default"
              >
                Admit All
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {participants.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No participants in waiting room</p>
          </div>
        ) : (
          <div className="space-y-3">
            {participants.map((participant) => (
              <div 
                key={participant.id}
                className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                  selectedParticipants.includes(participant.id) ? 'bg-blue-50 border-blue-300' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedParticipants.includes(participant.id)}
                    onChange={() => toggleParticipantSelection(participant.id)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <div>
                    <p className="font-medium">{participant.name}</p>
                    {participant.email && (
                      <p className="text-sm text-gray-600">{participant.email}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-500">
                        Waiting {formatWaitingTime(participant.waiting_time)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => admitParticipant(participant.id)}
                    className="flex items-center gap-1"
                  >
                    <CheckCircle className="h-3 w-3" />
                    Admit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => denyParticipant(participant.id)}
                    className="flex items-center gap-1 text-red-600 hover:text-red-700"
                  >
                    <XCircle className="h-3 w-3" />
                    Deny
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}