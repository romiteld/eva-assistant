'use client'

import React, { useState, useEffect } from 'react'
import { createTwilioService, CallDetails, RecordingDetails, TranscriptionDetails } from '@/lib/services/twilio'
import { supabase } from '@/lib/supabase/browser'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { 
  Phone, 
  PhoneCall, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Play, 
  Pause, 
  Download,
  Calendar,
  Users,
  FileText,
  Clock,
  DollarSign
} from 'lucide-react'
import { format } from 'date-fns'

interface Call {
  id: string
  sid: string
  from_number: string
  to_number: string
  status: string
  direction: string
  duration?: number
  price?: string
  start_time?: string
  end_time?: string
  recording_sid?: string
  transcription_sid?: string
}

interface Recording {
  id: string
  sid: string
  call_sid: string
  status: string
  duration: number
  uri: string
  date_created: string
}

interface Transcription {
  id: string
  sid: string
  recording_sid: string
  status: string
  transcription_text?: string
  date_created: string
}

export default function TwilioVoice() {
  const [calls, setCalls] = useState<Call[]>([])
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])
  const [activeCall, setActiveCall] = useState<CallDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const { toast } = useToast()

  // Single call form
  const [callForm, setCallForm] = useState({
    to: '',
    record: false,
    machineDetection: false,
  })

  // Conference call form
  const [conferenceForm, setConferenceForm] = useState({
    name: '',
    participants: '',
    record: false,
  })

  // IVR settings
  const [ivrEnabled, setIvrEnabled] = useState(false)

  // Load calls from database
  const loadCalls = async () => {
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      const { data, error } = await supabase
        .from('twilio_calls')
        .select('*')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setCalls(data || [])
    } catch (error) {
      console.error('Error loading calls:', error)
      toast({
        title: 'Error',
        description: 'Failed to load calls',
        variant: 'destructive',
      })
    }
  }

  // Load recordings from database
  const loadRecordings = async () => {
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      const { data, error } = await supabase
        .from('twilio_recordings')
        .select('*')
        .eq('user_id', user.user.id)
        .order('date_created', { ascending: false })
        .limit(50)

      if (error) throw error
      setRecordings(data || [])
    } catch (error) {
      console.error('Error loading recordings:', error)
      toast({
        title: 'Error',
        description: 'Failed to load recordings',
        variant: 'destructive',
      })
    }
  }

  // Load transcriptions from database
  const loadTranscriptions = async () => {
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      const { data, error } = await supabase
        .from('twilio_transcriptions')
        .select('*')
        .eq('user_id', user.user.id)
        .order('date_created', { ascending: false })
        .limit(50)

      if (error) throw error
      setTranscriptions(data || [])
    } catch (error) {
      console.error('Error loading transcriptions:', error)
      toast({
        title: 'Error',
        description: 'Failed to load transcriptions',
        variant: 'destructive',
      })
    }
  }

  // Sync calls from Twilio
  const syncCalls = async () => {
    setSyncing(true)
    try {
      const twilioService = createTwilioService()
      const twilioCalls = await twilioService.listCalls({ limit: 50 })
      
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      // Save calls to database
      for (const call of twilioCalls) {
        await supabase
          .from('twilio_calls')
          .upsert({
            sid: call.sid,
            user_id: user.user.id,
            from_number: call.from,
            to_number: call.to,
            status: call.status,
            direction: call.direction,
            duration: call.duration,
            price: call.price,
            price_unit: call.priceUnit,
            start_time: call.startTime,
            end_time: call.endTime,
          })
      }

      await loadCalls()
      toast({
        title: 'Success',
        description: 'Calls synced successfully',
      })
    } catch (error) {
      console.error('Error syncing calls:', error)
      toast({
        title: 'Error',
        description: 'Failed to sync calls',
        variant: 'destructive',
      })
    } finally {
      setSyncing(false)
    }
  }

  // Make a call
  const makeCall = async () => {
    if (!callForm.to) {
      toast({
        title: 'Error',
        description: 'Please enter a phone number',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const twilioService = createTwilioService()
      const result = await twilioService.makeCall({
        to: callForm.to,
        record: callForm.record,
        machineDetection: callForm.machineDetection ? 'Enable' : undefined,
        twiml: twilioService.generateVoiceResponse({
          say: 'Hello from The Well Recruiting Solutions. This is a test call.',
        }),
      })

      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      // Save to database
      await supabase.from('twilio_calls').insert({
        sid: result.sid,
        user_id: user.user.id,
        from_number: result.from,
        to_number: result.to,
        status: result.status,
        direction: result.direction,
        start_time: result.startTime,
      })

      setActiveCall(result)
      await loadCalls()
      
      toast({
        title: 'Success',
        description: 'Call initiated successfully',
      })
    } catch (error) {
      console.error('Error making call:', error)
      toast({
        title: 'Error',
        description: 'Failed to make call',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // End active call
  const endCall = async () => {
    if (!activeCall) return

    setLoading(true)
    try {
      const twilioService = createTwilioService()
      await twilioService.updateCall(activeCall.sid, { status: 'completed' })
      
      setActiveCall(null)
      await loadCalls()
      
      toast({
        title: 'Success',
        description: 'Call ended',
      })
    } catch (error) {
      console.error('Error ending call:', error)
      toast({
        title: 'Error',
        description: 'Failed to end call',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Create conference call
  const createConferenceCall = async () => {
    if (!conferenceForm.name || !conferenceForm.participants) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const twilioService = createTwilioService()
      const participants = conferenceForm.participants
        .split('\n')
        .filter(p => p.trim())
        .map(line => {
          const [phone, name, role = 'participant'] = line.split(',').map(s => s.trim())
          return { phone, name, role: role as 'interviewer' | 'candidate' }
        })

      const result = await twilioService.createConferenceCall({
        conferenceName: conferenceForm.name,
        participants,
        record: conferenceForm.record,
      })

      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      // Save calls to database
      for (const participant of result.participants) {
        if (participant.callSid) {
          await supabase.from('twilio_calls').insert({
            sid: participant.callSid,
            user_id: user.user.id,
            from_number: process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER || '',
            to_number: participant.phone,
            status: participant.status,
            direction: 'outbound-api',
            conference_sid: result.conferenceName,
          })
        }
      }

      await loadCalls()
      setConferenceForm({ name: '', participants: '', record: false })
      
      toast({
        title: 'Success',
        description: 'Conference call created successfully',
      })
    } catch (error) {
      console.error('Error creating conference call:', error)
      toast({
        title: 'Error',
        description: 'Failed to create conference call',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Download recording
  const downloadRecording = async (recordingSid: string) => {
    try {
      const twilioService = createTwilioService()
      const url = await twilioService.getRecordingUrl(recordingSid, 'mp3')
      window.open(url, '_blank')
    } catch (error) {
      console.error('Error downloading recording:', error)
      toast({
        title: 'Error',
        description: 'Failed to download recording',
        variant: 'destructive',
      })
    }
  }

  // Request transcription
  const requestTranscription = async (recordingSid: string) => {
    setLoading(true)
    try {
      const twilioService = createTwilioService()
      await twilioService.transcribeRecording(
        recordingSid,
        `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/transcription-complete`
      )
      
      toast({
        title: 'Success',
        description: 'Transcription requested. Check back in a few minutes.',
      })
    } catch (error) {
      console.error('Error requesting transcription:', error)
      toast({
        title: 'Error',
        description: 'Failed to request transcription',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Toggle IVR
  const toggleIVR = async () => {
    setLoading(true)
    try {
      const twilioService = createTwilioService()
      const phoneNumbers = await twilioService.listPhoneNumbers()
      
      if (phoneNumbers.length > 0) {
        if (!ivrEnabled) {
          await twilioService.setupIVRSystem(phoneNumbers[0].sid)
          setIvrEnabled(true)
          toast({
            title: 'Success',
            description: 'IVR system enabled',
          })
        } else {
          await twilioService.updatePhoneNumber(phoneNumbers[0].sid, {
            voiceUrl: '',
          })
          setIvrEnabled(false)
          toast({
            title: 'Success',
            description: 'IVR system disabled',
          })
        }
      }
    } catch (error) {
      console.error('Error toggling IVR:', error)
      toast({
        title: 'Error',
        description: 'Failed to toggle IVR system',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Calculate call statistics
  const getCallStats = () => {
    const totalCalls = calls.length
    const inboundCalls = calls.filter(c => c.direction.includes('inbound')).length
    const outboundCalls = calls.filter(c => c.direction.includes('outbound')).length
    const totalDuration = calls.reduce((sum, c) => sum + (c.duration || 0), 0)
    const totalCost = calls.reduce((sum, c) => sum + parseFloat(c.price || '0'), 0)
    const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0

    return {
      totalCalls,
      inboundCalls,
      outboundCalls,
      totalDuration,
      totalCost,
      avgDuration,
    }
  }

  useEffect(() => {
    loadCalls()
    loadRecordings()
    loadTranscriptions()
  }, [])

  const stats = getCallStats()

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCalls}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Inbound</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inboundCalls}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Outbound</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.outboundCalls}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.totalDuration / 60)}m</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.avgDuration)}s</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalCost.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="make-call" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="make-call">Make Call</TabsTrigger>
          <TabsTrigger value="call-history">Call History</TabsTrigger>
          <TabsTrigger value="recordings">Recordings</TabsTrigger>
          <TabsTrigger value="conference">Conference</TabsTrigger>
          <TabsTrigger value="ivr">IVR System</TabsTrigger>
        </TabsList>

        <TabsContent value="make-call">
          <Card>
            <CardHeader>
              <CardTitle>Make a Call</CardTitle>
              <CardDescription>
                Initiate an outbound call with optional recording
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeCall ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center space-y-4">
                      <PhoneCall className="h-16 w-16 mx-auto text-green-500 animate-pulse" />
                      <h3 className="text-xl font-semibold">Call in Progress</h3>
                      <p className="text-muted-foreground">To: {activeCall.to}</p>
                      <p className="text-muted-foreground">Status: {activeCall.status}</p>
                      <Button onClick={endCall} variant="destructive" disabled={loading}>
                        <PhoneOff className="h-4 w-4 mr-2" />
                        End Call
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="phone-number">Phone Number</Label>
                    <Input
                      id="phone-number"
                      placeholder="+1234567890"
                      value={callForm.to}
                      onChange={(e) => setCallForm({ ...callForm, to: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="record-call"
                      checked={callForm.record}
                      onCheckedChange={(checked) => setCallForm({ ...callForm, record: checked })}
                    />
                    <Label htmlFor="record-call">Record this call</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="machine-detection"
                      checked={callForm.machineDetection}
                      onCheckedChange={(checked) => setCallForm({ ...callForm, machineDetection: checked })}
                    />
                    <Label htmlFor="machine-detection">Enable answering machine detection</Label>
                  </div>
                  <Button onClick={makeCall} disabled={loading} className="w-full">
                    <Phone className="h-4 w-4 mr-2" />
                    Make Call
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="call-history">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Call History</CardTitle>
                  <CardDescription>Recent calls and their details</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={syncCalls} disabled={syncing}>
                  Sync Calls
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {calls.map((call) => (
                    <div key={call.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {call.direction.includes('inbound') ? (
                            <Phone className="h-4 w-4 text-blue-500" />
                          ) : (
                            <PhoneCall className="h-4 w-4 text-green-500" />
                          )}
                          <span className="font-medium">
                            {call.direction.includes('inbound') ? call.from_number : call.to_number}
                          </span>
                        </div>
                        <Badge variant={
                          call.status === 'completed' ? 'default' :
                          call.status === 'in-progress' ? 'secondary' :
                          'destructive'
                        }>
                          {call.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div>Direction: {call.direction}</div>
                        <div>Duration: {call.duration ? `${call.duration}s` : 'N/A'}</div>
                        <div>Cost: {call.price ? `$${call.price}` : 'N/A'}</div>
                        <div>
                          Time: {call.start_time ? format(new Date(call.start_time), 'MMM d, h:mm a') : 'N/A'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {call.recording_sid && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadRecording(call.recording_sid!)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Recording
                          </Button>
                        )}
                        {call.transcription_sid && (
                          <Button size="sm" variant="outline">
                            <FileText className="h-3 w-3 mr-1" />
                            Transcript
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recordings">
          <Card>
            <CardHeader>
              <CardTitle>Call Recordings</CardTitle>
              <CardDescription>Manage and transcribe your call recordings</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {recordings.map((recording) => {
                    const transcription = transcriptions.find(t => t.recording_sid === recording.sid)
                    return (
                      <div key={recording.id} className="p-4 border rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Mic className="h-4 w-4" />
                            <span className="font-medium">Recording {recording.sid.slice(-8)}</span>
                          </div>
                          <Badge>{recording.status}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <div>Duration: {recording.duration}s</div>
                          <div>Created: {format(new Date(recording.date_created), 'MMM d, h:mm a')}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadRecording(recording.sid)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                          {!transcription && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => requestTranscription(recording.sid)}
                              disabled={loading}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              Transcribe
                            </Button>
                          )}
                        </div>
                        {transcription && (
                          <div className="mt-2 p-3 bg-muted rounded-md">
                            <p className="text-sm font-medium mb-1">Transcription:</p>
                            <p className="text-sm">{transcription.transcription_text || 'Processing...'}</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conference">
          <Card>
            <CardHeader>
              <CardTitle>Conference Calls</CardTitle>
              <CardDescription>
                Set up multi-party conference calls for group interviews
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="conference-name">Conference Name</Label>
                <Input
                  id="conference-name"
                  placeholder="Team Interview - John Doe"
                  value={conferenceForm.name}
                  onChange={(e) => setConferenceForm({ ...conferenceForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="participants">
                  Participants (phone,name,role)
                </Label>
                <Textarea
                  id="participants"
                  placeholder="+1234567890,John Doe,candidate&#10;+0987654321,Jane Smith,interviewer&#10;+1122334455,Bob Johnson,interviewer"
                  rows={5}
                  value={conferenceForm.participants}
                  onChange={(e) => setConferenceForm({ ...conferenceForm, participants: e.target.value })}
                />
                <p className="text-sm text-muted-foreground">
                  One participant per line. Role can be &apos;interviewer&apos; or &apos;candidate&apos;
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="record-conference"
                  checked={conferenceForm.record}
                  onCheckedChange={(checked) => setConferenceForm({ ...conferenceForm, record: checked })}
                />
                <Label htmlFor="record-conference">Record conference call</Label>
              </div>
              <Button onClick={createConferenceCall} disabled={loading} className="w-full">
                <Users className="h-4 w-4 mr-2" />
                Start Conference Call
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ivr">
          <Card>
            <CardHeader>
              <CardTitle>IVR System</CardTitle>
              <CardDescription>
                Interactive Voice Response for automated candidate screening
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium">IVR Status</h3>
                  <p className="text-sm text-muted-foreground">
                    {ivrEnabled ? 'Active - Callers will hear automated menu' : 'Inactive - Calls will ring through'}
                  </p>
                </div>
                <Switch
                  checked={ivrEnabled}
                  onCheckedChange={toggleIVR}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">IVR Menu Structure</h3>
                <div className="pl-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs">1</div>
                    <span>Check application status</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs">2</div>
                    <span>Schedule an interview</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs">3</div>
                    <span>Leave a message</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs">0</div>
                    <span>Speak with a recruiter</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Welcome Message</h4>
                <p className="text-sm text-muted-foreground">
                  &quot;Welcome to The Well Recruiting Solutions. Press 1 to check your application status. 
                  Press 2 to schedule an interview. Press 3 to leave a message. Press 0 to speak with a recruiter.&quot;
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}