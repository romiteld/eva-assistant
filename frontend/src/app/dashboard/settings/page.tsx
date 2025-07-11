'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, User, Bell, Shield, Palette, Key } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

export default function SettingsPage() {
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    sms: true,
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Settings className="w-8 h-8 text-zinc-400" />
            Settings
          </h1>
          <p className="text-zinc-400 mt-2">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-zinc-900/50 border border-zinc-800">
            <TabsTrigger value="profile">
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="w-4 h-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="w-4 h-4 mr-2" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="integrations">
              <Key className="w-4 h-4 mr-2" />
              Integrations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card className="bg-black/40 backdrop-blur-xl border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Profile Information</CardTitle>
                <CardDescription className="text-zinc-400">
                  Update your personal information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-zinc-300">First Name</Label>
                    <Input
                      id="firstName"
                      placeholder="Daniel"
                      className="bg-zinc-900/50 border-zinc-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-zinc-300">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Romitelli"
                      className="bg-zinc-900/50 border-zinc-700 text-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-zinc-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="daniel.romitelli@emailthewell.com"
                    className="bg-zinc-900/50 border-zinc-700 text-white"
                  />
                </div>
                <Button className="bg-purple-600 hover:bg-purple-700">
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card className="bg-black/40 backdrop-blur-xl border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Notification Preferences</CardTitle>
                <CardDescription className="text-zinc-400">
                  Choose how you want to be notified
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-notif" className="text-zinc-300">Email Notifications</Label>
                    <p className="text-sm text-zinc-500">Receive updates via email</p>
                  </div>
                  <Switch
                    id="email-notif"
                    checked={notifications.email}
                    onCheckedChange={(checked) => 
                      setNotifications({ ...notifications, email: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="push-notif" className="text-zinc-300">Push Notifications</Label>
                    <p className="text-sm text-zinc-500">Browser push notifications</p>
                  </div>
                  <Switch
                    id="push-notif"
                    checked={notifications.push}
                    onCheckedChange={(checked) => 
                      setNotifications({ ...notifications, push: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="sms-notif" className="text-zinc-300">SMS Notifications</Label>
                    <p className="text-sm text-zinc-500">Text message alerts</p>
                  </div>
                  <Switch
                    id="sms-notif"
                    checked={notifications.sms}
                    onCheckedChange={(checked) => 
                      setNotifications({ ...notifications, sms: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="bg-black/40 backdrop-blur-xl border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Security Settings</CardTitle>
                <CardDescription className="text-zinc-400">
                  Manage your account security
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  Change Password
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Enable Two-Factor Authentication
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  View Login History
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <Card className="bg-black/40 backdrop-blur-xl border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Appearance</CardTitle>
                <CardDescription className="text-zinc-400">
                  Customize the look and feel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-400">Theme customization coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations">
            <Card className="bg-black/40 backdrop-blur-xl border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Connected Integrations</CardTitle>
                <CardDescription className="text-zinc-400">
                  Manage your third-party connections
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg">
                  <div>
                    <h4 className="text-white font-medium">Microsoft 365</h4>
                    <p className="text-sm text-zinc-400">Connected</p>
                  </div>
                  <Button variant="outline" size="sm">Disconnect</Button>
                </div>
                <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg">
                  <div>
                    <h4 className="text-white font-medium">LinkedIn</h4>
                    <p className="text-sm text-zinc-400">Not connected</p>
                  </div>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">Connect</Button>
                </div>
                <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg">
                  <div>
                    <h4 className="text-white font-medium">Zoom</h4>
                    <p className="text-sm text-zinc-400">Not connected</p>
                  </div>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">Connect</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}