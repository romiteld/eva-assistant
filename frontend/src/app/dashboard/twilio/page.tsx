'use client'

import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import TwilioMessaging from '@/components/twilio/TwilioMessaging'
import TwilioVoice from '@/components/twilio/TwilioVoice'
import TwilioPhoneNumbers from '@/components/twilio/TwilioPhoneNumbers'
import { MessageSquare, Phone, Smartphone, BarChart3 } from 'lucide-react'

export default function TwilioDashboard() {
  const [activeTab, setActiveTab] = useState('messaging')

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Twilio Communication Center</h1>
        <p className="text-muted-foreground mt-2">
          Manage SMS messaging, voice calls, and phone numbers for candidate communication
        </p>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="messaging" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Messaging
          </TabsTrigger>
          <TabsTrigger value="voice" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Voice Calls
          </TabsTrigger>
          <TabsTrigger value="numbers" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Phone Numbers
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messaging" className="space-y-4">
          <TwilioMessaging />
        </TabsContent>

        <TabsContent value="voice" className="space-y-4">
          <TwilioVoice />
        </TabsContent>

        <TabsContent value="numbers" className="space-y-4">
          <TwilioPhoneNumbers />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Communication Overview</CardTitle>
                <CardDescription>Last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Analytics dashboard coming soon...
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Campaign Performance</CardTitle>
                <CardDescription>SMS campaign metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Campaign analytics coming soon...
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Cost Analysis</CardTitle>
                <CardDescription>Usage and billing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Cost analytics coming soon...
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}