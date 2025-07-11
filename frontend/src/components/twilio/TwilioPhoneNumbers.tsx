'use client'

import React, { useState, useEffect } from 'react'
import { createTwilioService, PhoneNumberDetails } from '@/lib/services/twilio'
import { supabase } from '@/lib/supabase/browser'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Phone, 
  Plus, 
  Trash2, 
  Settings, 
  AlertTriangle,
  MessageSquare,
  PhoneCall,
  Smartphone,
  Mail,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react'

interface PhoneNumber {
  id: string
  sid: string
  phone_number: string
  friendly_name: string
  capabilities: {
    voice: boolean
    sms: boolean
    mms: boolean
    fax: boolean
  }
  status: string
  voice_url?: string
  sms_url?: string
  purchased_at: string
  released_at?: string
}

export default function TwilioPhoneNumbers() {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [twilioNumbers, setTwilioNumbers] = useState<PhoneNumberDetails[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [selectedNumber, setSelectedNumber] = useState<PhoneNumber | null>(null)
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false)
  const { toast } = useToast()

  // Purchase form
  const [purchaseForm, setPurchaseForm] = useState({
    searchType: 'areaCode',
    areaCode: '',
    contains: '',
    smsEnabled: true,
    voiceEnabled: true,
    mmsEnabled: false,
  })

  // Update form
  const [updateForm, setUpdateForm] = useState({
    friendlyName: '',
    voiceUrl: '',
    smsUrl: '',
  })

  // Load phone numbers from database
  const loadPhoneNumbers = async () => {
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      const { data, error } = await supabase
        .from('twilio_phone_numbers')
        .select('*')
        .eq('user_id', user.user.id)
        .is('released_at', null)
        .order('purchased_at', { ascending: false })

      if (error) throw error
      setPhoneNumbers(data || [])
    } catch (error) {
      console.error('Error loading phone numbers:', error)
      toast({
        title: 'Error',
        description: 'Failed to load phone numbers',
        variant: 'destructive',
      })
    }
  }

  // Sync with Twilio
  const syncPhoneNumbers = async () => {
    setSyncing(true)
    try {
      const twilioService = createTwilioService()
      const numbers = await twilioService.listPhoneNumbers()
      setTwilioNumbers(numbers)

      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      // Update database with Twilio data
      for (const number of numbers) {
        await supabase
          .from('twilio_phone_numbers')
          .upsert({
            sid: number.sid,
            user_id: user.user.id,
            phone_number: number.phoneNumber,
            friendly_name: number.friendlyName,
            capabilities: number.capabilities,
            status: 'active',
            voice_url: number.voiceUrl,
            voice_method: number.voiceMethod,
            sms_url: number.smsUrl,
            sms_method: number.smsMethod,
            status_callback_url: number.statusCallback,
            status_callback_method: number.statusCallbackMethod,
          })
      }

      await loadPhoneNumbers()
      toast({
        title: 'Success',
        description: 'Phone numbers synced successfully',
      })
    } catch (error) {
      console.error('Error syncing phone numbers:', error)
      toast({
        title: 'Error',
        description: 'Failed to sync phone numbers',
        variant: 'destructive',
      })
    } finally {
      setSyncing(false)
    }
  }

  // Purchase phone number
  const purchasePhoneNumber = async () => {
    setLoading(true)
    try {
      const twilioService = createTwilioService()
      
      const options: any = {
        smsEnabled: purchaseForm.smsEnabled,
        voiceEnabled: purchaseForm.voiceEnabled,
        mmsEnabled: purchaseForm.mmsEnabled,
      }

      if (purchaseForm.searchType === 'areaCode' && purchaseForm.areaCode) {
        options.areaCode = purchaseForm.areaCode
      } else if (purchaseForm.searchType === 'contains' && purchaseForm.contains) {
        options.contains = purchaseForm.contains
      }

      const result = await twilioService.purchasePhoneNumber(options)

      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      // Save to database
      await supabase.from('twilio_phone_numbers').insert({
        sid: result.sid,
        user_id: user.user.id,
        phone_number: result.phoneNumber,
        friendly_name: result.friendlyName,
        capabilities: result.capabilities,
        status: 'active',
        voice_url: result.voiceUrl,
        sms_url: result.smsUrl,
      })

      await loadPhoneNumbers()
      setPurchaseDialogOpen(false)
      setPurchaseForm({
        searchType: 'areaCode',
        areaCode: '',
        contains: '',
        smsEnabled: true,
        voiceEnabled: true,
        mmsEnabled: false,
      })
      
      toast({
        title: 'Success',
        description: `Phone number ${result.phoneNumber} purchased successfully`,
      })
    } catch (error) {
      console.error('Error purchasing phone number:', error)
      toast({
        title: 'Error',
        description: 'Failed to purchase phone number',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Release phone number
  const releasePhoneNumber = async (number: PhoneNumber) => {
    if (!confirm(`Are you sure you want to release ${number.phone_number}? This action cannot be undone.`)) {
      return
    }

    setLoading(true)
    try {
      const twilioService = createTwilioService()
      await twilioService.releasePhoneNumber(number.sid)

      // Mark as released in database
      await supabase
        .from('twilio_phone_numbers')
        .update({
          status: 'released',
          released_at: new Date().toISOString(),
        })
        .eq('id', number.id)

      await loadPhoneNumbers()
      
      toast({
        title: 'Success',
        description: `Phone number ${number.phone_number} released successfully`,
      })
    } catch (error) {
      console.error('Error releasing phone number:', error)
      toast({
        title: 'Error',
        description: 'Failed to release phone number',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Update phone number settings
  const updatePhoneNumber = async () => {
    if (!selectedNumber) return

    setLoading(true)
    try {
      const twilioService = createTwilioService()
      const result = await twilioService.updatePhoneNumber(selectedNumber.sid, {
        friendlyName: updateForm.friendlyName || undefined,
        voiceUrl: updateForm.voiceUrl || undefined,
        smsUrl: updateForm.smsUrl || undefined,
      })

      // Update database
      await supabase
        .from('twilio_phone_numbers')
        .update({
          friendly_name: result.friendlyName,
          voice_url: result.voiceUrl,
          sms_url: result.smsUrl,
        })
        .eq('id', selectedNumber.id)

      await loadPhoneNumbers()
      setSelectedNumber(null)
      
      toast({
        title: 'Success',
        description: 'Phone number settings updated successfully',
      })
    } catch (error) {
      console.error('Error updating phone number:', error)
      toast({
        title: 'Error',
        description: 'Failed to update phone number settings',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPhoneNumbers()
    syncPhoneNumbers()
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Phone Numbers</CardTitle>
              <CardDescription>
                Manage your Twilio phone numbers for SMS and voice calls
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={syncPhoneNumbers}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Sync
              </Button>
              <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Purchase Number
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Purchase Phone Number</DialogTitle>
                    <DialogDescription>
                      Search for and purchase a new phone number
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Search Type</Label>
                      <Select
                        value={purchaseForm.searchType}
                        onValueChange={(value) => setPurchaseForm({ ...purchaseForm, searchType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="areaCode">By Area Code</SelectItem>
                          <SelectItem value="contains">Contains Digits</SelectItem>
                          <SelectItem value="any">Any Available</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {purchaseForm.searchType === 'areaCode' && (
                      <div className="space-y-2">
                        <Label>Area Code</Label>
                        <Input
                          placeholder="212"
                          value={purchaseForm.areaCode}
                          onChange={(e) => setPurchaseForm({ ...purchaseForm, areaCode: e.target.value })}
                        />
                      </div>
                    )}
                    
                    {purchaseForm.searchType === 'contains' && (
                      <div className="space-y-2">
                        <Label>Contains Digits</Label>
                        <Input
                          placeholder="1234"
                          value={purchaseForm.contains}
                          onChange={(e) => setPurchaseForm({ ...purchaseForm, contains: e.target.value })}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Capabilities</Label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="voice-enabled"
                            checked={purchaseForm.voiceEnabled}
                            onCheckedChange={(checked) => setPurchaseForm({ ...purchaseForm, voiceEnabled: checked })}
                          />
                          <Label htmlFor="voice-enabled">Voice Calls</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="sms-enabled"
                            checked={purchaseForm.smsEnabled}
                            onCheckedChange={(checked) => setPurchaseForm({ ...purchaseForm, smsEnabled: checked })}
                          />
                          <Label htmlFor="sms-enabled">SMS Messages</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="mms-enabled"
                            checked={purchaseForm.mmsEnabled}
                            onCheckedChange={(checked) => setPurchaseForm({ ...purchaseForm, mmsEnabled: checked })}
                          />
                          <Label htmlFor="mms-enabled">MMS Messages</Label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setPurchaseDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={purchasePhoneNumber} disabled={loading}>
                      Purchase Number
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Phone Numbers List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {phoneNumbers.map((number) => (
          <Card key={number.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  <CardTitle className="text-lg">{number.phone_number}</CardTitle>
                </div>
                <Badge variant={number.status === 'active' ? 'default' : 'secondary'}>
                  {number.status}
                </Badge>
              </div>
              <CardDescription>{number.friendly_name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Capabilities</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1">
                    {number.capabilities.voice ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">Voice</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {number.capabilities.sms ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">SMS</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {number.capabilities.mms ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">MMS</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {number.capabilities.fax ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">Fax</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1 text-sm">
                {number.voice_url && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <PhoneCall className="h-3 w-3" />
                    <span className="truncate">{number.voice_url}</span>
                  </div>
                )}
                {number.sms_url && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    <span className="truncate">{number.sms_url}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedNumber(number)
                        setUpdateForm({
                          friendlyName: number.friendly_name,
                          voiceUrl: number.voice_url || '',
                          smsUrl: number.sms_url || '',
                        })
                      }}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Update Phone Number Settings</DialogTitle>
                      <DialogDescription>
                        Configure webhooks and settings for {number.phone_number}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Friendly Name</Label>
                        <Input
                          value={updateForm.friendlyName}
                          onChange={(e) => setUpdateForm({ ...updateForm, friendlyName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Voice Webhook URL</Label>
                        <Input
                          placeholder="https://your-app.com/api/twilio/voice"
                          value={updateForm.voiceUrl}
                          onChange={(e) => setUpdateForm({ ...updateForm, voiceUrl: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>SMS Webhook URL</Label>
                        <Input
                          placeholder="https://your-app.com/api/twilio/sms"
                          value={updateForm.smsUrl}
                          onChange={(e) => setUpdateForm({ ...updateForm, smsUrl: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSelectedNumber(null)}>
                        Cancel
                      </Button>
                      <Button onClick={updatePhoneNumber} disabled={loading}>
                        Update Settings
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => releasePhoneNumber(number)}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {phoneNumbers.length === 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No phone numbers</AlertTitle>
          <AlertDescription>
            Purchase a phone number to start sending messages and making calls.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}