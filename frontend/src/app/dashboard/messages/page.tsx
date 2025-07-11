'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Search, Send, Inbox, Archive } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function MessagesPage() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-blue-500" />
              Messages
            </h1>
            <p className="text-zinc-400 mt-2">
              Manage all your communications in one place
            </p>
          </div>
          
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Send className="w-4 h-4 mr-2" />
            Compose
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-zinc-900/50 border-zinc-700 text-white placeholder-zinc-500"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="inbox" className="space-y-6">
          <TabsList className="bg-zinc-900/50 border border-zinc-800">
            <TabsTrigger value="inbox">
              <Inbox className="w-4 h-4 mr-2" />
              Inbox
            </TabsTrigger>
            <TabsTrigger value="sent">
              <Send className="w-4 h-4 mr-2" />
              Sent
            </TabsTrigger>
            <TabsTrigger value="archived">
              <Archive className="w-4 h-4 mr-2" />
              Archived
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="space-y-4">
            <Card className="bg-black/40 backdrop-blur-xl border-zinc-800">
              <CardContent className="p-6">
                <div className="text-center py-12">
                  <Inbox className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Your inbox is empty</h3>
                  <p className="text-zinc-400 mb-6">
                    Messages from candidates and team members will appear here
                  </p>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Send className="w-4 h-4 mr-2" />
                    Send Your First Message
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sent">
            <p className="text-zinc-400 text-center py-8">No sent messages</p>
          </TabsContent>

          <TabsContent value="archived">
            <p className="text-zinc-400 text-center py-8">No archived messages</p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}