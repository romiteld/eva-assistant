'use client'

import React, { useState, useEffect } from 'react'
import { createTwilioService, SendSMSOptions, MessageDetails } from '@/lib/services/twilio'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Phone, Send, MessageSquare, Users, Calendar, RefreshCw, Search, Filter } from 'lucide-react'
import { format } from 'date-fns'

interface Message {
  id: string
  sid: string
  from_number: string
  to_number: string
  body: string
  status: string
  direction: string
  date_created: string
  date_sent?: string
  error_message?: string
}

interface Campaign {
  id: string
  name: string
  template: string
  recipients: any[]
  status: string
  total_recipients: number
  sent_count: number
  failed_count: number
  delivered_count: number
  scheduled_time?: string
  created_at: string
}

export default function TwilioMessaging() {
  const [messages, setMessages] = useState<Message[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const { toast } = useToast()

  // Single message form
  const [singleMessage, setSingleMessage] = useState({
    to: '',
    body: '',
  })

  // Bulk message form
  const [bulkMessage, setBulkMessage] = useState({
    recipients: '',
    body: '',
  })

  // Campaign form
  const [campaign, setCampaign] = useState({
    name: '',
    template: '',
    recipients: '',
    scheduledTime: '',
  })

  // Load messages from database
  const loadMessages = async () => {
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      const { data, error } = await supabase
        .from('twilio_messages')
        .select('*')
        .eq('user_id', user.user.id)
        .order('date_created', { ascending: false })
        .limit(100)

      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      console.error('Error loading messages:', error)
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive',
      })
    }
  }

  // Load campaigns from database
  const loadCampaigns = async () => {
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      const { data, error } = await supabase
        .from('twilio_campaigns')
        .select('*')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCampaigns(data || [])
    } catch (error) {
      console.error('Error loading campaigns:', error)
      toast({
        title: 'Error',
        description: 'Failed to load campaigns',
        variant: 'destructive',
      })
    }
  }

  // Sync messages from Twilio
  const syncMessages = async () => {
    setSyncing(true)
    try {
      const twilioService = createTwilioService()
      const twilioMessages = await twilioService.getMessages({ limit: 50 })
      
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      // Save messages to database
      for (const msg of twilioMessages) {
        await supabase
          .from('twilio_messages')
          .upsert({
            sid: msg.sid,
            user_id: user.user.id,
            from_number: msg.from,
            to_number: msg.to,
            body: msg.body,
            status: msg.status,
            direction: msg.direction,
            date_created: msg.dateCreated,
            date_sent: msg.dateSent,
          })
      }

      await loadMessages()
      toast({
        title: 'Success',
        description: 'Messages synced successfully',
      })
    } catch (error) {
      console.error('Error syncing messages:', error)
      toast({
        title: 'Error',
        description: 'Failed to sync messages',
        variant: 'destructive',
      })
    } finally {
      setSyncing(false)
    }
  }

  // Send single SMS
  const sendSingleSMS = async () => {
    if (!singleMessage.to || !singleMessage.body) {
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
      const result = await twilioService.sendSMSEnhanced({
        to: singleMessage.to,
        body: singleMessage.body,
      })

      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      // Save to database
      await supabase.from('twilio_messages').insert({
        sid: result.sid,
        user_id: user.user.id,
        from_number: result.from,
        to_number: result.to,
        body: result.body,
        status: result.status,
        direction: result.direction,
        date_created: result.dateCreated,
        date_sent: result.dateSent,
      })

      await loadMessages()
      setSingleMessage({ to: '', body: '' })
      
      toast({
        title: 'Success',
        description: 'Message sent successfully',
      })
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Send bulk SMS
  const sendBulkSMS = async () => {
    if (!bulkMessage.recipients || !bulkMessage.body) {
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
      const recipients = bulkMessage.recipients
        .split('\n')
        .filter(r => r.trim())
        .map(to => ({ to: to.trim(), body: bulkMessage.body }))

      const results = await twilioService.sendBulkSMS(recipients)

      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      // Save successful messages to database
      for (const result of results) {
        if (result.success && 'messageId' in result) {
          await supabase.from('twilio_messages').insert({
            sid: result.messageId,
            user_id: user.user.id,
            from_number: process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER || '',
            to_number: result.to,
            body: bulkMessage.body,
            status: result.status,
            direction: 'outbound-api',
            date_created: result.dateCreated,
          })
        }
      }

      await loadMessages()
      setBulkMessage({ recipients: '', body: '' })
      
      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length
      
      toast({
        title: 'Bulk SMS Complete',
        description: `${successCount} sent successfully, ${failCount} failed`,
      })
    } catch (error) {
      console.error('Error sending bulk messages:', error)
      toast({
        title: 'Error',
        description: 'Failed to send bulk messages',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Create campaign
  const createCampaign = async () => {
    if (!campaign.name || !campaign.template || !campaign.recipients) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      const recipients = campaign.recipients
        .split('\n')
        .filter(r => r.trim())
        .map(line => {
          const [phone, name, ...customFields] = line.split(',').map(s => s.trim())
          const fields: Record<string, string> = {}
          customFields.forEach((field, index) => {
            const [key, value] = field.split('=')
            if (key && value) {
              fields[key] = value
            }
          })
          return { phone, name, customFields: fields }
        })

      const { data, error } = await supabase.from('twilio_campaigns').insert({
        user_id: user.user.id,
        name: campaign.name,
        template: campaign.template,
        recipients,
        total_recipients: recipients.length,
        scheduled_time: campaign.scheduledTime || null,
        status: campaign.scheduledTime ? 'scheduled' : 'draft',
      }).select().single()

      if (error) throw error

      // If no scheduled time, send immediately
      if (!campaign.scheduledTime && data) {
        const twilioService = createTwilioService()
        const result = await twilioService.createSMSCampaign({
          name: campaign.name,
          recipients,
          template: campaign.template,
        })

        // Update campaign with results
        await supabase
          .from('twilio_campaigns')
          .update({
            status: 'completed',
            results: result.results,
            sent_count: result.results.filter((r: any) => r.success).length,
            failed_count: result.results.filter((r: any) => !r.success).length,
            completed_at: new Date().toISOString(),
          })
          .eq('id', data.id)
      }

      await loadCampaigns()
      setCampaign({ name: '', template: '', recipients: '', scheduledTime: '' })
      
      toast({
        title: 'Success',
        description: campaign.scheduledTime ? 'Campaign scheduled successfully' : 'Campaign sent successfully',
      })
    } catch (error) {
      console.error('Error creating campaign:', error)
      toast({
        title: 'Error',
        description: 'Failed to create campaign',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Get unique conversations
  const getConversations = () => {
    const conversations = new Map<string, Message[]>()
    
    messages.forEach(msg => {
      const otherNumber = msg.direction === 'inbound' ? msg.from_number : msg.to_number
      if (!conversations.has(otherNumber)) {
        conversations.set(otherNumber, [])
      }
      conversations.get(otherNumber)?.push(msg)
    })
    
    return Array.from(conversations.entries()).map(([number, msgs]) => ({
      number,
      messages: msgs.sort((a, b) => new Date(a.date_created).getTime() - new Date(b.date_created).getTime()),
      lastMessage: msgs[msgs.length - 1],
    }))
  }

  useEffect(() => {
    loadMessages()
    loadCampaigns()
  }, [])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Conversations List */}
      <div className="lg:col-span-1">
        <Card className="h-[calc(100vh-200px)]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conversations
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={syncMessages}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-2">
                {getConversations().map(({ number, messages, lastMessage }) => (
                  <div
                    key={number}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedConversation === number
                        ? 'bg-primary/10 border border-primary'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedConversation(number)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{number}</span>
                      <Badge variant={lastMessage.direction === 'inbound' ? 'secondary' : 'default'}>
                        {lastMessage.direction}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {lastMessage.body}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(lastMessage.date_created), 'MMM d, h:mm a')}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Message Details / Compose */}
      <div className="lg:col-span-2">
        <Tabs defaultValue="conversation" className="h-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="conversation">Conversation</TabsTrigger>
            <TabsTrigger value="compose">Compose</TabsTrigger>
            <TabsTrigger value="bulk">Bulk SMS</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          </TabsList>

          <TabsContent value="conversation" className="h-[calc(100vh-250px)]">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>
                  {selectedConversation || 'Select a conversation'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedConversation && (
                  <>
                    <ScrollArea className="h-[calc(100vh-450px)] mb-4">
                      <div className="space-y-4">
                        {messages
                          .filter(msg => 
                            msg.from_number === selectedConversation || 
                            msg.to_number === selectedConversation
                          )
                          .sort((a, b) => new Date(a.date_created).getTime() - new Date(b.date_created).getTime())
                          .map(msg => (
                            <div
                              key={msg.id}
                              className={`flex ${
                                msg.direction === 'inbound' ? 'justify-start' : 'justify-end'
                              }`}
                            >
                              <div
                                className={`max-w-[70%] rounded-lg p-3 ${
                                  msg.direction === 'inbound'
                                    ? 'bg-muted'
                                    : 'bg-primary text-primary-foreground'
                                }`}
                              >
                                <p className="text-sm">{msg.body}</p>
                                <p className="text-xs opacity-70 mt-1">
                                  {format(new Date(msg.date_created), 'h:mm a')}
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type a message..."
                        value={singleMessage.body}
                        onChange={(e) => setSingleMessage({ 
                          ...singleMessage, 
                          body: e.target.value,
                          to: selectedConversation 
                        })}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            sendSingleSMS()
                          }
                        }}
                      />
                      <Button onClick={sendSingleSMS} disabled={loading}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compose">
            <Card>
              <CardHeader>
                <CardTitle>Send Single SMS</CardTitle>
                <CardDescription>
                  Send a message to a single recipient
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="to">To (Phone Number)</Label>
                  <Input
                    id="to"
                    placeholder="+1234567890"
                    value={singleMessage.to}
                    onChange={(e) => setSingleMessage({ ...singleMessage, to: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Type your message..."
                    rows={4}
                    value={singleMessage.body}
                    onChange={(e) => setSingleMessage({ ...singleMessage, body: e.target.value })}
                  />
                  <p className="text-sm text-muted-foreground">
                    {singleMessage.body.length}/160 characters
                  </p>
                </div>
                <Button onClick={sendSingleSMS} disabled={loading} className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bulk">
            <Card>
              <CardHeader>
                <CardTitle>Send Bulk SMS</CardTitle>
                <CardDescription>
                  Send the same message to multiple recipients
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recipients">Recipients (one per line)</Label>
                  <Textarea
                    id="recipients"
                    placeholder="+1234567890&#10;+0987654321&#10;+1122334455"
                    rows={5}
                    value={bulkMessage.recipients}
                    onChange={(e) => setBulkMessage({ ...bulkMessage, recipients: e.target.value })}
                  />
                  <p className="text-sm text-muted-foreground">
                    {bulkMessage.recipients.split('\n').filter(r => r.trim()).length} recipients
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bulk-message">Message</Label>
                  <Textarea
                    id="bulk-message"
                    placeholder="Type your message..."
                    rows={4}
                    value={bulkMessage.body}
                    onChange={(e) => setBulkMessage({ ...bulkMessage, body: e.target.value })}
                  />
                </div>
                <Button onClick={sendBulkSMS} disabled={loading} className="w-full">
                  <Users className="h-4 w-4 mr-2" />
                  Send Bulk Messages
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <CardTitle>SMS Campaigns</CardTitle>
                <CardDescription>
                  Create personalized SMS campaigns with templates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign-name">Campaign Name</Label>
                  <Input
                    id="campaign-name"
                    placeholder="Summer Promotion"
                    value={campaign.name}
                    onChange={(e) => setCampaign({ ...campaign, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template">Message Template</Label>
                  <Textarea
                    id="template"
                    placeholder="Hi {{name}}, check out our summer deals! {{custom_field}}"
                    rows={4}
                    value={campaign.template}
                    onChange={(e) => setCampaign({ ...campaign, template: e.target.value })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Use {`{{name}}`} for recipient name, {`{{field_name}}`} for custom fields
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign-recipients">
                    Recipients (phone,name,field1=value1,field2=value2)
                  </Label>
                  <Textarea
                    id="campaign-recipients"
                    placeholder="+1234567890,John Doe,discount=20%&#10;+0987654321,Jane Smith,discount=15%"
                    rows={5}
                    value={campaign.recipients}
                    onChange={(e) => setCampaign({ ...campaign, recipients: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule">Schedule (optional)</Label>
                  <Input
                    id="schedule"
                    type="datetime-local"
                    value={campaign.scheduledTime}
                    onChange={(e) => setCampaign({ ...campaign, scheduledTime: e.target.value })}
                  />
                </div>
                <Button onClick={createCampaign} disabled={loading} className="w-full">
                  <Calendar className="h-4 w-4 mr-2" />
                  {campaign.scheduledTime ? 'Schedule Campaign' : 'Send Campaign Now'}
                </Button>

                {/* Campaign List */}
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">Recent Campaigns</h3>
                  <div className="space-y-2">
                    {campaigns.map(camp => (
                      <div key={camp.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{camp.name}</h4>
                          <Badge>{camp.status}</Badge>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-sm text-muted-foreground">
                          <div>Total: {camp.total_recipients}</div>
                          <div>Sent: {camp.sent_count}</div>
                          <div>Delivered: {camp.delivered_count}</div>
                          <div>Failed: {camp.failed_count}</div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Created: {format(new Date(camp.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}