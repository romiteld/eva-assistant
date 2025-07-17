'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { 
  Users, 
  Plus, 
  Phone, 
  PhoneCall,
  Clock,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  UserPlus,
  UserMinus,
  Play,
  Square,
  Trash2,
  Copy,
  Settings
} from 'lucide-react'
import type { ConferenceCall } from '@/hooks/useTwilio'

interface ConferenceManagerProps {
  conferences: ConferenceCall[]
  onCreateConference: (options: {
    conferenceName: string
    participants: Array<{
      phone: string
      name: string
      role: 'interviewer' | 'candidate'
    }>
    record?: boolean
  }) => Promise<ConferenceCall>
  loading?: boolean
}

export function ConferenceManager({ 
  conferences, 
  onCreateConference,
  loading = false 
}: ConferenceManagerProps) {
  const [newConference, setNewConference] = useState({
    name: '',
    participants: [] as Array<{
      phone: string
      name: string
      role: 'interviewer' | 'candidate'
    }>,
    record: false
  })
  
  const [newParticipant, setNewParticipant] = useState({
    phone: '',
    name: '',
    role: 'candidate' as 'interviewer' | 'candidate'
  })

  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const [selectedConference, setSelectedConference] = useState<ConferenceCall | null>(null)

  const handleAddParticipant = () => {
    if (!newParticipant.phone || !newParticipant.name) {
      alert('Please enter both phone number and name')
      return
    }

    setNewConference(prev => ({
      ...prev,
      participants: [...prev.participants, newParticipant]
    }))

    setNewParticipant({ phone: '', name: '', role: 'candidate' })
    setShowAddParticipant(false)
  }

  const handleRemoveParticipant = (index: number) => {
    setNewConference(prev => ({
      ...prev,
      participants: prev.participants.filter((_, i) => i !== index)
    }))
  }

  const handleCreateConference = async () => {
    if (!newConference.name || newConference.participants.length === 0) {
      alert('Please provide a conference name and at least one participant')
      return
    }

    try {
      await onCreateConference({
        conferenceName: newConference.name,
        participants: newConference.participants,
        record: newConference.record
      })
      
      setNewConference({
        name: '',
        participants: [],
        record: false
      })
    } catch (error) {
      console.error('Error creating conference:', error)
    }
  }

  const formatPhoneNumber = (phone: string) => {
    // Simple phone number formatting
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
    }
    return phone
  }

  const getParticipantStatusColor = (status: string) => {
    switch (status) {
      case 'ringing':
        return 'bg-yellow-100 text-yellow-800'
      case 'answered':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-gray-100 text-gray-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  const renderParticipantModal = () => {
    if (!showAddParticipant) return null

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Add Participant</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddParticipant(false)}
            >
              ×
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="participantName">Name</Label>
              <Input
                id="participantName"
                value={newParticipant.name}
                onChange={(e) => setNewParticipant(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter participant name..."
              />
            </div>

            <div>
              <Label htmlFor="participantPhone">Phone Number</Label>
              <Input
                id="participantPhone"
                type="tel"
                value={newParticipant.phone}
                onChange={(e) => setNewParticipant(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+1234567890"
              />
            </div>

            <div>
              <Label htmlFor="participantRole">Role</Label>
              <select
                id="participantRole"
                value={newParticipant.role}
                onChange={(e) => setNewParticipant(prev => ({ 
                  ...prev, 
                  role: e.target.value as 'interviewer' | 'candidate' 
                }))}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="candidate">Candidate</option>
                <option value="interviewer">Interviewer</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowAddParticipant(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddParticipant}>
              Add Participant
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {renderParticipantModal()}
      
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">Active Conferences</TabsTrigger>
          <TabsTrigger value="create">Create Conference</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {conferences.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">No active conferences</p>
                  <p className="text-sm">Create a conference call to get started</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {conferences.map((conference) => (
                <Card key={conference.conferenceName}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          {conference.conferenceName}
                        </CardTitle>
                        <CardDescription>
                          {conference.participants.length} participants
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(conference.conferenceName)
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm font-medium text-gray-700">Participants</div>
                      {conference.participants.map((participant, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <Phone className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium">{participant.phone}</div>
                              <div className="text-sm text-gray-600">
                                Call ID: {participant.callSid}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getParticipantStatusColor(participant.status)}>
                              {participant.status}
                            </Badge>
                            <Button variant="ghost" size="sm">
                              <Mic className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Volume2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create Conference Call</CardTitle>
              <CardDescription>
                Set up a new conference call for interviews or meetings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <Label htmlFor="conferenceName">Conference Name</Label>
                  <Input
                    id="conferenceName"
                    value={newConference.name}
                    onChange={(e) => setNewConference(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter conference name..."
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="recordConference"
                    checked={newConference.record}
                    onCheckedChange={(checked) => setNewConference(prev => ({ ...prev, record: checked }))}
                  />
                  <Label htmlFor="recordConference">Record conference call</Label>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <Label>Participants</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddParticipant(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Participant
                    </Button>
                  </div>

                  {newConference.participants.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                      <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p>No participants added yet</p>
                      <p className="text-sm">Click &quot;Add Participant&quot; to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {newConference.participants.map((participant, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              participant.role === 'interviewer' ? 'bg-blue-100' : 'bg-green-100'
                            }`}>
                              {participant.role === 'interviewer' ? (
                                <Phone className="h-4 w-4 text-blue-600" />
                              ) : (
                                <Users className="h-4 w-4 text-green-600" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{participant.name}</div>
                              <div className="text-sm text-gray-600">
                                {formatPhoneNumber(participant.phone)} • {participant.role}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveParticipant(index)}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={handleCreateConference}
                    disabled={loading || !newConference.name || newConference.participants.length === 0}
                  >
                    <PhoneCall className="h-4 w-4 mr-2" />
                    Start Conference Call
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {newConference.participants.length > 0 && (
            <Alert>
              <Phone className="h-4 w-4" />
              <AlertDescription>
                Conference calls will automatically dial all participants when started. 
                Make sure all participants are ready to receive the call.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}