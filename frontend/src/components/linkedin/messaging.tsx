'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Send, Search, User, MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface LinkedInConnection {
  id: string;
  firstName: string;
  lastName: string;
  headline?: string;
  profilePicture?: string;
}

export function LinkedInMessaging() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<LinkedInConnection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<LinkedInConnection | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const searchConnections = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/linkedin/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'searchConnections',
          query: searchQuery,
          count: 20
        })
      });

      if (!response.ok) {
        throw new Error('Failed to search connections');
      }

      const data = await response.json();
      setConnections(data.result.elements || []);
    } catch (error) {
      toast.error('Failed to search connections');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!selectedRecipient || !subject || !message) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      setSending(true);
      const response = await fetch('/api/linkedin/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'sendMessage',
          recipientId: selectedRecipient.id,
          subject,
          body: message
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      toast.success('Message sent successfully!');
      
      // Reset form
      setSelectedRecipient(null);
      setSubject('');
      setMessage('');
    } catch (error) {
      toast.error('Failed to send message');
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Connection Search */}
      <Card className="bg-black/40 backdrop-blur-xl border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Connections
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search connections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchConnections()}
              className="bg-zinc-900/50 border-zinc-700"
            />
            <Button onClick={searchConnections} disabled={loading}>
              <Search className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedRecipient?.id === connection.id
                    ? 'bg-blue-500/10 border-blue-500/50'
                    : 'bg-zinc-900/50 border-zinc-700 hover:border-zinc-600'
                }`}
                onClick={() => setSelectedRecipient(connection)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                    {connection.profilePicture ? (
                      <Image
                        src={connection.profilePicture}
                        alt={`${connection.firstName} ${connection.lastName}`}
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-zinc-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">
                      {connection.firstName} {connection.lastName}
                    </p>
                    {connection.headline && (
                      <p className="text-sm text-zinc-400 truncate">
                        {connection.headline}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Message Composer */}
      <Card className="bg-black/40 backdrop-blur-xl border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Compose Message
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedRecipient ? (
            <>
              <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-700">
                <p className="text-sm text-zinc-400">To:</p>
                <p className="font-medium text-white">
                  {selectedRecipient.firstName} {selectedRecipient.lastName}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Enter subject..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="bg-zinc-900/50 border-zinc-700"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Type your message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  className="bg-zinc-900/50 border-zinc-700"
                />
              </div>

              <Button
                onClick={sendMessage}
                disabled={sending || !subject || !message}
                className="w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                {sending ? 'Sending...' : 'Send Message'}
              </Button>
            </>
          ) : (
            <div className="text-center py-12 text-zinc-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select a connection to send a message</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}