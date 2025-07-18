'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Phone, 
  MessageSquare, 
  PhoneCall, 
  Mic, 
  Users,
  TrendingUp,
  Calendar,
  Clock,
  DollarSign,
  Download,
  Play,
  Pause,
  Square,
  RefreshCw,
  Settings,
  AlertCircle,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Send,
  PhoneIncoming,
  PhoneOutgoing
} from 'lucide-react'
import { format } from 'date-fns'
import { useTwilio } from '@/hooks/useTwilio'
import { IVRDesigner } from './IVRDesigner'
import { ConferenceManager } from './ConferenceManager'
import type { CallDetails, MessageDetails } from '@/lib/services/twilio'
import { toast } from 'sonner'

interface TwilioDashboardProps {
  className?: string
}

export function TwilioDashboard({ className }: TwilioDashboardProps) {
  const {
    loading,
    error,
    phoneNumbers,
    calls,
    messages,
    recordings,
    stats,
    ivrFlows,
    activeConferences,
    purchasePhoneNumber,
    releasePhoneNumber,
    updatePhoneNumber,
    makeCall,
    sendSMS,
    sendBulkSMS,
    createConferenceCall,
    createIVRFlow,
    updateIVRFlow,
    deleteIVRFlow,
    activateIVRFlow,
    loadStats,
    refreshData,
    clearError
  } = useTwilio()

  const [newCall, setNewCall] = useState({
    to: '',
    message: ''
  })

  const [newSMS, setNewSMS] = useState({
    to: '',
    body: ''
  })

  const [bulkSMS, setBulkSMS] = useState({
    recipients: '',
    body: ''
  })

  const [statsDateRange, setStatsDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })

  const [filters, setFilters] = useState({
    callStatus: '',
    messageStatus: '',
    direction: ''
  })

  const handleMakeCall = async () => {
    if (!newCall.to) {
      toast.error('Please enter a phone number')
      return
    }

    try {
      const twiml = `
        <Response>
          <Say>${newCall.message || 'Hello, this is a call from The Well Recruiting Solutions.'}</Say>
          <Pause length="2"/>
          <Say>Please hold while we connect you to our team.</Say>
        </Response>
      `
      
      await makeCall({
        to: newCall.to,
        twiml,
        record: true,
        statusCallback: '/api/twilio/call-status'
      })
      
      toast.success('Call initiated successfully')
      setNewCall({ to: '', message: '' })
    } catch (error) {
      console.error('Error making call:', error)
      toast.error('Failed to make call. Please try again.')
    }
  }

  const handleSendSMS = async () => {
    if (!newSMS.to || !newSMS.body) {
      toast.error('Please enter phone number and message')
      return
    }

    try {
      await sendSMS({
        to: newSMS.to,
        body: newSMS.body,
        statusCallback: '/api/twilio/sms-status'
      })
      
      toast.success('SMS sent successfully')
      setNewSMS({ to: '', body: '' })
    } catch (error) {
      console.error('Error sending SMS:', error)
      toast.error('Failed to send SMS. Please try again.')
    }
  }

  const handleSendBulkSMS = async () => {
    if (!bulkSMS.recipients || !bulkSMS.body) {
      toast.error('Please enter recipients and message')
      return
    }

    try {
      const recipientList = bulkSMS.recipients
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [phone, name] = line.split(',').map(s => s.trim())
          return {
            to: phone,
            body: bulkSMS.body.replace('{{name}}', name || '')
          }
        })

      await sendBulkSMS(recipientList)
      toast.success(`Bulk SMS sent to ${recipientList.length} recipients`)
      setBulkSMS({ recipients: '', body: '' })
    } catch (error) {
      console.error('Error sending bulk SMS:', error)
      toast.error('Failed to send bulk SMS. Please try again.')
    }
  }

  const handleLoadStats = async () => {
    try {
      await loadStats(new Date(statsDateRange.start), new Date(statsDateRange.end))
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const getCallStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600'
      case 'in-progress':
        return 'text-blue-600'
      case 'ringing':
        return 'text-yellow-600'
      case 'failed':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getMessageStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'text-green-600'
      case 'sent':
        return 'text-blue-600'
      case 'failed':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const filteredCalls = calls.filter(call => {
    if (filters.callStatus && call.status !== filters.callStatus) return false
    if (filters.direction && call.direction !== filters.direction) return false
    return true
  })

  const filteredMessages = messages.filter(message => {
    if (filters.messageStatus && message.status !== filters.messageStatus) return false
    if (filters.direction && message.direction !== filters.direction) return false
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading Twilio dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button
            variant="outline"
            size="sm"
            onClick={clearError}
            className="ml-2"
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Twilio Communication</h1>
          <p className="text-gray-600">Manage voice calls, SMS, and communication flows</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Calls</p>
                  <p className="text-2xl font-bold">{stats.calls.total}</p>
                </div>
                <Phone className="h-8 w-8 text-blue-600" />
              </div>
              <div className="mt-2 text-sm text-gray-500">
                {stats.calls.inbound} in • {stats.calls.outbound} out
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Messages</p>
                  <p className="text-2xl font-bold">{stats.messages.total}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-green-600" />
              </div>
              <div className="mt-2 text-sm text-gray-500">
                {stats.messages.sent} sent • {stats.messages.received} received
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Call Duration</p>
                  <p className="text-2xl font-bold">{Math.round(stats.calls.totalDuration / 60)}m</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="mt-2 text-sm text-gray-500">
                {stats.recordings.total} recordings
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Cost</p>
                  <p className="text-2xl font-bold">
                    ${(stats.calls.totalCost + stats.messages.totalCost).toFixed(2)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-red-600" />
              </div>
              <div className="mt-2 text-sm text-gray-500">
                This period
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="calls" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="calls">Calls</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="numbers">Phone Numbers</TabsTrigger>
          <TabsTrigger value="ivr">IVR Designer</TabsTrigger>
          <TabsTrigger value="conferences">Conferences</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="calls" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Recent Calls</CardTitle>
                  <div className="flex gap-2">
                    <Select value={filters.callStatus} onValueChange={(value) => setFilters(prev => ({ ...prev, callStatus: value }))}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Status</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="ringing">Ringing</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filters.direction} onValueChange={(value) => setFilters(prev => ({ ...prev, direction: value }))}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Direction" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Directions</SelectItem>
                        <SelectItem value="inbound">Inbound</SelectItem>
                        <SelectItem value="outbound-api">Outbound</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredCalls.map((call) => (
                    <div key={call.sid} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          {call.direction?.includes('inbound') ? (
                            <PhoneIncoming className="h-5 w-5 text-blue-600" />
                          ) : (
                            <PhoneOutgoing className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">
                            {call.direction?.includes('inbound') ? call.from : call.to}
                          </div>
                          <div className="text-sm text-gray-500">
                            {call.startTime && format(new Date(call.startTime), 'MMM dd, yyyy • h:mm a')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getCallStatusColor(call.status)}>
                          {call.status}
                        </Badge>
                        {call.duration && (
                          <span className="text-sm text-gray-500">
                            {Math.round(call.duration / 60)}m {call.duration % 60}s
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Make Call</CardTitle>
                <CardDescription>
                  Initiate a new outbound call
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="callTo">Phone Number</Label>
                    <Input
                      id="callTo"
                      type="tel"
                      value={newCall.to}
                      onChange={(e) => setNewCall(prev => ({ ...prev, to: e.target.value }))}
                      placeholder="+1234567890"
                    />
                  </div>
                  <div>
                    <Label htmlFor="callMessage">Message (optional)</Label>
                    <Textarea
                      id="callMessage"
                      value={newCall.message}
                      onChange={(e) => setNewCall(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="Enter a custom message..."
                      rows={3}
                    />
                  </div>
                  <Button onClick={handleMakeCall} className="w-full">
                    <PhoneCall className="h-4 w-4 mr-2" />
                    Make Call
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Recent Messages</CardTitle>
                  <Select value={filters.messageStatus} onValueChange={(value) => setFilters(prev => ({ ...prev, messageStatus: value }))}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Status</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredMessages.map((message) => (
                    <div key={message.sid} className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">
                              {message.direction === 'inbound' ? message.from : message.to}
                            </div>
                            <div className="text-sm text-gray-500">
                              {format(new Date(message.dateCreated), 'MMM dd, yyyy • h:mm a')}
                            </div>
                          </div>
                          <Badge variant="outline" className={getMessageStatusColor(message.status)}>
                            {message.status}
                          </Badge>
                        </div>
                        <div className="mt-2 text-sm">{message.body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Send SMS</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="smsTo">Phone Number</Label>
                      <Input
                        id="smsTo"
                        type="tel"
                        value={newSMS.to}
                        onChange={(e) => setNewSMS(prev => ({ ...prev, to: e.target.value }))}
                        placeholder="+1234567890"
                      />
                    </div>
                    <div>
                      <Label htmlFor="smsBody">Message</Label>
                      <Textarea
                        id="smsBody"
                        value={newSMS.body}
                        onChange={(e) => setNewSMS(prev => ({ ...prev, body: e.target.value }))}
                        placeholder="Enter your message..."
                        rows={4}
                      />
                    </div>
                    <Button onClick={handleSendSMS} className="w-full">
                      <Send className="h-4 w-4 mr-2" />
                      Send SMS
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Bulk SMS</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="bulkRecipients">Recipients</Label>
                      <Textarea
                        id="bulkRecipients"
                        value={bulkSMS.recipients}
                        onChange={(e) => setBulkSMS(prev => ({ ...prev, recipients: e.target.value }))}
                        placeholder="+1234567890, John Doe&#10;+1234567891, Jane Smith"
                        rows={3}
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        One per line: phone,name
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="bulkBody">Message</Label>
                      <Textarea
                        id="bulkBody"
                        value={bulkSMS.body}
                        onChange={(e) => setBulkSMS(prev => ({ ...prev, body: e.target.value }))}
                        placeholder="Hi {{name}}, this is a message from The Well Recruiting..."
                        rows={3}
                      />
                    </div>
                    <Button onClick={handleSendBulkSMS} className="w-full">
                      <Send className="h-4 w-4 mr-2" />
                      Send Bulk SMS
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="numbers" className="space-y-4">
          <div className="grid gap-4">
            {phoneNumbers.map((number) => (
              <Card key={number.sid}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{number.phoneNumber}</CardTitle>
                      <CardDescription>{number.friendlyName}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">
                        {number.capabilities.voice ? 'Voice' : ''}
                      </Badge>
                      <Badge variant="outline">
                        {number.capabilities.sms ? 'SMS' : ''}
                      </Badge>
                      <Badge variant="outline">
                        {number.capabilities.mms ? 'MMS' : ''}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Voice URL:</span>
                      <div className="text-gray-600 truncate">{number.voiceUrl || 'Not set'}</div>
                    </div>
                    <div>
                      <span className="font-medium">SMS URL:</span>
                      <div className="text-gray-600 truncate">{number.smsUrl || 'Not set'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ivr" className="space-y-4">
          <IVRDesigner
            flows={ivrFlows}
            onCreateFlow={createIVRFlow}
            onUpdateFlow={updateIVRFlow}
            onDeleteFlow={deleteIVRFlow}
            onActivateFlow={activateIVRFlow}
            phoneNumbers={phoneNumbers}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="conferences" className="space-y-4">
          <ConferenceManager
            conferences={activeConferences}
            onCreateConference={createConferenceCall}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Usage Analytics</CardTitle>
                <CardDescription>
                  View detailed usage statistics for your Twilio account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={statsDateRange.start}
                        onChange={(e) => setStatsDateRange(prev => ({ ...prev, start: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="endDate">End Date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={statsDateRange.end}
                        onChange={(e) => setStatsDateRange(prev => ({ ...prev, end: e.target.value }))}
                      />
                    </div>
                  </div>
                  <Button onClick={handleLoadStats}>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Load Analytics
                  </Button>
                </div>
              </CardContent>
            </Card>

            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Call Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Total Calls:</span>
                        <span className="font-medium">{stats.calls.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Inbound:</span>
                        <span className="font-medium">{stats.calls.inbound}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Outbound:</span>
                        <span className="font-medium">{stats.calls.outbound}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Duration:</span>
                        <span className="font-medium">{Math.round(stats.calls.totalDuration / 60)}m</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Cost:</span>
                        <span className="font-medium">${stats.calls.totalCost.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Message Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Total Messages:</span>
                        <span className="font-medium">{stats.messages.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sent:</span>
                        <span className="font-medium">{stats.messages.sent}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Received:</span>
                        <span className="font-medium">{stats.messages.received}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Cost:</span>
                        <span className="font-medium">${stats.messages.totalCost.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recording Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Total Recordings:</span>
                        <span className="font-medium">{stats.recordings.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Duration:</span>
                        <span className="font-medium">{Math.round(stats.recordings.totalDuration / 60)}m</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Cost:</span>
                        <span className="font-medium">${stats.recordings.totalCost.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}