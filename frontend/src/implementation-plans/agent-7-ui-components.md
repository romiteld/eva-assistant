# Agent 7: UI Components & Integration Developer Implementation Plan

## Overview
Focus on implementing missing CRUD interfaces and real-time update capabilities for core features.

## 1. Candidates CRUD Interface

### Database Schema Review
```sql
-- Already exists in 001_initial_schema.sql
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  resume_url TEXT,
  status TEXT DEFAULT 'active',
  skills TEXT[],
  experience_years INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Implementation Files

#### `/app/api/candidates/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const candidateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  resume_url: z.string().url().optional(),
  skills: z.array(z.string()).optional(),
  experience_years: z.number().int().min(0).optional(),
  status: z.enum(['active', 'inactive', 'hired']).default('active')
});

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || 'all';

  let query = supabase
    .from('candidates')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query
    .range((page - 1) * limit, page * limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    candidates: data,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit)
    }
  });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validated = candidateSchema.parse(body);

    const { data, error } = await supabase
      .from('candidates')
      .insert({
        ...validated,
        user_id: user.id
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
```

#### `/app/api/candidates/[id]/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  resume_url: z.string().url().optional(),
  skills: z.array(z.string()).optional(),
  experience_years: z.number().int().min(0).optional(),
  status: z.enum(['active', 'inactive', 'hired']).optional()
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('candidates')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validated = updateSchema.parse(body);

    const { data, error } = await supabase
      .from('candidates')
      .update(validated)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('candidates')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

#### `/components/candidates/CandidateForm.tsx`
```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface CandidateFormProps {
  candidate?: any;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

export function CandidateForm({ candidate, onSubmit, onCancel }: CandidateFormProps) {
  const [formData, setFormData] = useState({
    name: candidate?.name || '',
    email: candidate?.email || '',
    phone: candidate?.phone || '',
    resume_url: candidate?.resume_url || '',
    experience_years: candidate?.experience_years || 0,
    status: candidate?.status || 'active',
    skills: candidate?.skills || []
  });
  const [newSkill, setNewSkill] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setLoading(false);
    }
  };

  const addSkill = () => {
    if (newSkill.trim()) {
      setFormData({
        ...formData,
        skills: [...formData.skills, newSkill.trim()]
      });
      setNewSkill('');
    }
  };

  const removeSkill = (index: number) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((_, i) => i !== index)
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="resume_url">Resume URL</Label>
        <Input
          id="resume_url"
          type="url"
          value={formData.resume_url}
          onChange={(e) => setFormData({ ...formData, resume_url: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="experience_years">Years of Experience</Label>
        <Input
          id="experience_years"
          type="number"
          min="0"
          value={formData.experience_years}
          onChange={(e) => setFormData({ ...formData, experience_years: parseInt(e.target.value) })}
        />
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select
          value={formData.status}
          onValueChange={(value) => setFormData({ ...formData, status: value })}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="hired">Hired</option>
        </Select>
      </div>

      <div>
        <Label>Skills</Label>
        <div className="flex gap-2 mb-2">
          <Input
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            placeholder="Add a skill"
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
          />
          <Button type="button" onClick={addSkill}>Add</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.skills.map((skill, index) => (
            <Badge key={index} variant="secondary">
              {skill}
              <X
                className="ml-1 h-3 w-3 cursor-pointer"
                onClick={() => removeSkill(index)}
              />
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : candidate ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}
```

#### `/components/candidates/CandidatesTable.tsx`
```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Edit, Trash, Eye, Search } from 'lucide-react';
import { CandidateForm } from './CandidateForm';
import { useCandidates } from '@/hooks/useCandidates';

export function CandidatesTable() {
  const [search, setSearch] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  const {
    candidates,
    loading,
    pagination,
    createCandidate,
    updateCandidate,
    deleteCandidate,
    refreshCandidates
  } = useCandidates({ search });

  const handleCreate = async (data: any) => {
    await createCandidate(data);
    setShowForm(false);
    refreshCandidates();
  };

  const handleUpdate = async (data: any) => {
    if (selectedCandidate) {
      await updateCandidate(selectedCandidate.id, data);
      setShowForm(false);
      setSelectedCandidate(null);
      refreshCandidates();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this candidate?')) {
      await deleteCandidate(id);
      refreshCandidates();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search candidates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
        </div>
        <Button onClick={() => setShowForm(true)}>
          Add Candidate
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Experience</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Skills</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center">
                Loading...
              </TableCell>
            </TableRow>
          ) : candidates.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center">
                No candidates found
              </TableCell>
            </TableRow>
          ) : (
            candidates.map((candidate) => (
              <TableRow key={candidate.id}>
                <TableCell className="font-medium">{candidate.name}</TableCell>
                <TableCell>{candidate.email || '-'}</TableCell>
                <TableCell>{candidate.phone || '-'}</TableCell>
                <TableCell>{candidate.experience_years || 0} years</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      candidate.status === 'hired'
                        ? 'default'
                        : candidate.status === 'active'
                        ? 'secondary'
                        : 'outline'
                    }
                  >
                    {candidate.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {candidate.skills?.slice(0, 3).map((skill, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {candidate.skills?.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{candidate.skills.length - 3}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedCandidate(candidate);
                        setShowDetails(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedCandidate(candidate);
                        setShowForm(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(candidate.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCandidate ? 'Edit Candidate' : 'Add New Candidate'}
            </DialogTitle>
          </DialogHeader>
          <CandidateForm
            candidate={selectedCandidate}
            onSubmit={selectedCandidate ? handleUpdate : handleCreate}
            onCancel={() => {
              setShowForm(false);
              setSelectedCandidate(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

## 2. Unified Messages UI

### Implementation Files

#### `/hooks/useMessages.ts`
```typescript
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { RealtimeChannel } from '@supabase/supabase-js';

interface Message {
  id: string;
  channel: 'email' | 'sms' | 'teams' | 'linkedin';
  sender: string;
  recipient: string;
  subject?: string;
  content: string;
  attachments?: any[];
  timestamp: string;
  read: boolean;
  thread_id?: string;
}

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadMessages();
    subscribeToMessages();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load from unified_messages table
      const { data, error } = await supabase
        .from('unified_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setMessages(data || []);

      // Group into threads
      const threadMap = new Map();
      (data || []).forEach(msg => {
        const threadId = msg.thread_id || msg.id;
        if (!threadMap.has(threadId)) {
          threadMap.set(threadId, {
            id: threadId,
            lastMessage: msg,
            messages: [],
            unreadCount: 0
          });
        }
        threadMap.get(threadId).messages.push(msg);
        if (!msg.read) {
          threadMap.get(threadId).unreadCount++;
        }
      });
      setThreads(Array.from(threadMap.values()));
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    const newChannel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'unified_messages'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages(prev => [payload.new as Message, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === payload.new.id ? payload.new as Message : msg
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    setChannel(newChannel);
  };

  const sendMessage = async (data: Partial<Message>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: message, error } = await supabase
      .from('unified_messages')
      .insert({
        ...data,
        user_id: user.id,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return message;
  };

  const markAsRead = async (messageId: string) => {
    const { error } = await supabase
      .from('unified_messages')
      .update({ read: true })
      .eq('id', messageId);

    if (error) throw error;
  };

  return {
    messages,
    threads,
    loading,
    sendMessage,
    markAsRead,
    refreshMessages: loadMessages
  };
}
```

#### `/components/messages/UnifiedMessagesUI.tsx`
```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';
import {
  Mail,
  MessageSquare,
  Users,
  Linkedin,
  Send,
  Paperclip,
  Search
} from 'lucide-react';
import { useMessages } from '@/hooks/useMessages';
import { MessageComposer } from './MessageComposer';
import { ThreadView } from './ThreadView';

const channelIcons = {
  email: Mail,
  sms: MessageSquare,
  teams: Users,
  linkedin: Linkedin
};

export function UnifiedMessagesUI() {
  const [selectedThread, setSelectedThread] = useState(null);
  const [activeChannel, setActiveChannel] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [composing, setComposing] = useState(false);
  
  const { threads, loading, sendMessage, markAsRead } = useMessages();

  const filteredThreads = threads.filter(thread => {
    const matchesChannel = activeChannel === 'all' || 
      thread.lastMessage.channel === activeChannel;
    const matchesSearch = searchQuery === '' ||
      thread.lastMessage.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      thread.lastMessage.sender.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesChannel && matchesSearch;
  });

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Messages</h2>
            <Button size="sm" onClick={() => setComposing(true)}>
              Compose
            </Button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs value={activeChannel} onValueChange={setActiveChannel} className="flex-1">
          <TabsList className="w-full rounded-none border-b">
            <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
            <TabsTrigger value="email" className="flex-1">
              <Mail className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="sms" className="flex-1">
              <MessageSquare className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="teams" className="flex-1">
              <Users className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="linkedin" className="flex-1">
              <Linkedin className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No messages</div>
            ) : (
              <div className="divide-y">
                {filteredThreads.map(thread => {
                  const Icon = channelIcons[thread.lastMessage.channel];
                  return (
                    <div
                      key={thread.id}
                      className={`p-4 hover:bg-gray-50 cursor-pointer ${
                        selectedThread?.id === thread.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => {
                        setSelectedThread(thread);
                        thread.messages.forEach(msg => {
                          if (!msg.read) markAsRead(msg.id);
                        });
                      }}
                    >
                      <div className="flex items-start space-x-3">
                        <Avatar className="h-10 w-10">
                          <div className="bg-gray-200 h-full w-full flex items-center justify-center">
                            {thread.lastMessage.sender[0].toUpperCase()}
                          </div>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {thread.lastMessage.sender}
                            </p>
                            <div className="flex items-center space-x-1">
                              <Icon className="h-4 w-4 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                {new Date(thread.lastMessage.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 truncate">
                            {thread.lastMessage.subject || thread.lastMessage.content}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {thread.lastMessage.content}
                          </p>
                          {thread.unreadCount > 0 && (
                            <Badge variant="secondary" className="mt-1">
                              {thread.unreadCount} new
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </Tabs>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col">
        {composing ? (
          <MessageComposer
            onSend={async (data) => {
              await sendMessage(data);
              setComposing(false);
            }}
            onCancel={() => setComposing(false)}
          />
        ) : selectedThread ? (
          <ThreadView
            thread={selectedThread}
            onReply={async (content) => {
              await sendMessage({
                ...selectedThread.lastMessage,
                content,
                thread_id: selectedThread.id,
                sender: 'You',
                recipient: selectedThread.lastMessage.sender
              });
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a message to view
          </div>
        )}
      </div>
    </div>
  );
}
```

## 3. Task Management Database Connection

### Implementation Files

#### `/lib/services/task-service.ts`
```typescript
import { createClient } from '@/lib/supabase/browser';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  assigned_to?: string;
  created_by: string;
  tags: string[];
  ai_suggestions?: any;
  created_at: string;
  updated_at: string;
}

class TaskService {
  private supabase = createClient();
  private channel: RealtimeChannel | null = null;

  async getTasks(filters?: {
    status?: string;
    priority?: string;
    assigned_to?: string;
    search?: string;
  }) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let query = this.supabase
      .from('tasks')
      .select('*')
      .eq('created_by', user.id);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters?.assigned_to) {
      query = query.eq('assigned_to', filters.assigned_to);
    }
    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async createTask(task: Partial<Task>) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get AI suggestions for priority and tags
    const aiSuggestions = await this.getAIPrioritization(task);

    const { data, error } = await this.supabase
      .from('tasks')
      .insert({
        ...task,
        created_by: user.id,
        ai_suggestions: aiSuggestions
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateTask(id: string, updates: Partial<Task>) {
    const { data, error } = await this.supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteTask(id: string) {
    const { error } = await this.supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async bulkUpdateTasks(ids: string[], updates: Partial<Task>) {
    const { data, error } = await this.supabase
      .from('tasks')
      .update(updates)
      .in('id', ids)
      .select();

    if (error) throw error;
    return data;
  }

  subscribeToUpdates(callback: (payload: any) => void) {
    this.channel = this.supabase
      .channel('tasks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        callback
      )
      .subscribe();

    return () => {
      if (this.channel) {
        this.supabase.removeChannel(this.channel);
      }
    };
  }

  private async getAIPrioritization(task: Partial<Task>) {
    try {
      const response = await fetch('/api/ai/prioritize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task })
      });

      if (!response.ok) throw new Error('AI prioritization failed');
      return await response.json();
    } catch (error) {
      console.error('AI prioritization error:', error);
      return null;
    }
  }
}

export const taskService = new TaskService();
```

#### `/components/tasks/TaskBoard.tsx`
```tsx
import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Clock, AlertCircle } from 'lucide-react';
import { taskService, Task } from '@/lib/services/task-service';
import { TaskForm } from './TaskForm';
import { useToast } from '@/hooks/use-toast';

const columns = {
  todo: { title: 'To Do', color: 'bg-gray-100' },
  in_progress: { title: 'In Progress', color: 'bg-blue-100' },
  done: { title: 'Done', color: 'bg-green-100' }
};

const priorityColors = {
  low: 'bg-gray-200',
  medium: 'bg-yellow-200',
  high: 'bg-orange-200',
  urgent: 'bg-red-200'
};

export function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadTasks();
    const unsubscribe = taskService.subscribeToUpdates(handleRealtimeUpdate);
    return unsubscribe;
  }, []);

  const loadTasks = async () => {
    try {
      const data = await taskService.getTasks();
      setTasks(data || []);
    } catch (error) {
      toast({
        title: 'Error loading tasks',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRealtimeUpdate = (payload: any) => {
    if (payload.eventType === 'INSERT') {
      setTasks(prev => [...prev, payload.new]);
    } else if (payload.eventType === 'UPDATE') {
      setTasks(prev => prev.map(task => 
        task.id === payload.new.id ? payload.new : task
      ));
    } else if (payload.eventType === 'DELETE') {
      setTasks(prev => prev.filter(task => task.id !== payload.old.id));
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    const task = tasks.find(t => t.id === draggableId);
    if (!task) return;

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === draggableId
        ? { ...t, status: destination.droppableId as Task['status'] }
        : t
    ));

    try {
      await taskService.updateTask(draggableId, {
        status: destination.droppableId as Task['status']
      });
    } catch (error) {
      // Revert on error
      setTasks(prev => prev.map(t =>
        t.id === draggableId
          ? { ...t, status: source.droppableId as Task['status'] }
          : t
      ));
      toast({
        title: 'Error updating task',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleCreateTask = async (data: Partial<Task>) => {
    try {
      await taskService.createTask(data);
      setShowForm(false);
      toast({
        title: 'Task created',
        description: 'Your task has been created successfully'
      });
    } catch (error) {
      toast({
        title: 'Error creating task',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const getTasksByStatus = (status: Task['status']) => 
    tasks.filter(task => task.status === status);

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading tasks...</div>;
  }

  return (
    <div className="h-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Task Board</h2>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-3 gap-6 h-full">
          {Object.entries(columns).map(([columnId, column]) => (
            <div key={columnId} className={`${column.color} rounded-lg p-4`}>
              <h3 className="font-semibold mb-4">{column.title}</h3>
              <Droppable droppableId={columnId}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-3 min-h-[400px]"
                  >
                    {getTasksByStatus(columnId as Task['status']).map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`p-4 cursor-move ${
                              snapshot.isDragging ? 'shadow-lg' : ''
                            }`}
                            onClick={() => {
                              setSelectedTask(task);
                              setShowForm(true);
                            }}
                          >
                            <h4 className="font-medium mb-2">{task.title}</h4>
                            {task.description && (
                              <p className="text-sm text-gray-600 mb-2">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <Badge className={priorityColors[task.priority]}>
                                {task.priority}
                              </Badge>
                              <div className="flex items-center space-x-2 text-xs text-gray-500">
                                {task.due_date && (
                                  <div className="flex items-center">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {new Date(task.due_date).toLocaleDateString()}
                                  </div>
                                )}
                                {task.ai_suggestions?.confidence && (
                                  <div className="flex items-center">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    AI: {Math.round(task.ai_suggestions.confidence * 100)}%
                                  </div>
                                )}
                              </div>
                            </div>
                            {task.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {task.tags.map((tag, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {showForm && (
        <TaskForm
          task={selectedTask}
          onSubmit={handleCreateTask}
          onClose={() => {
            setShowForm(false);
            setSelectedTask(null);
          }}
        />
      )}
    </div>
  );
}
```

## 4. Real-time Updates Implementation

### Implementation Files

#### `/lib/services/realtime-service.ts`
```typescript
import { createClient } from '@/lib/supabase/browser';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type ChangeHandler<T> = (payload: RealtimePostgresChangesPayload<T>) => void;

class RealtimeService {
  private supabase = createClient();
  private channels: Map<string, RealtimeChannel> = new Map();

  subscribe<T = any>(
    table: string,
    handler: ChangeHandler<T>,
    filter?: { column: string; value: string }
  ): () => void {
    const channelName = filter 
      ? `${table}_${filter.column}_${filter.value}`
      : table;

    if (this.channels.has(channelName)) {
      console.warn(`Already subscribed to ${channelName}`);
      return () => {};
    }

    const channel = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: filter ? `${filter.column}=eq.${filter.value}` : undefined
        },
        handler
      )
      .subscribe();

    this.channels.set(channelName, channel);

    return () => {
      const ch = this.channels.get(channelName);
      if (ch) {
        this.supabase.removeChannel(ch);
        this.channels.delete(channelName);
      }
    };
  }

  subscribeToPresence(
    roomId: string,
    handlers: {
      onSync?: () => void;
      onJoin?: (event: any) => void;
      onLeave?: (event: any) => void;
    }
  ): () => void {
    const channel = this.supabase.channel(roomId);

    if (handlers.onSync) {
      channel.on('presence', { event: 'sync' }, handlers.onSync);
    }
    if (handlers.onJoin) {
      channel.on('presence', { event: 'join' }, handlers.onJoin);
    }
    if (handlers.onLeave) {
      channel.on('presence', { event: 'leave' }, handlers.onLeave);
    }

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (user) {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString()
          });
        }
      }
    });

    this.channels.set(`presence_${roomId}`, channel);

    return () => {
      const ch = this.channels.get(`presence_${roomId}`);
      if (ch) {
        ch.untrack();
        this.supabase.removeChannel(ch);
        this.channels.delete(`presence_${roomId}`);
      }
    };
  }

  broadcast(
    channel: string,
    event: string,
    payload: any
  ) {
    return this.supabase
      .channel(channel)
      .send({
        type: 'broadcast',
        event,
        payload
      });
  }

  cleanup() {
    this.channels.forEach(channel => {
      this.supabase.removeChannel(channel);
    });
    this.channels.clear();
  }
}

export const realtimeService = new RealtimeService();
```

#### `/hooks/useRealtimeSubscription.ts`
```typescript
import { useEffect, useRef } from 'react';
import { realtimeService } from '@/lib/services/realtime-service';

export function useRealtimeSubscription<T = any>(
  table: string,
  handler: (payload: any) => void,
  filter?: { column: string; value: string }
) {
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubscribeRef.current = realtimeService.subscribe<T>(
      table,
      handler,
      filter
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [table, filter?.column, filter?.value]);
}

export function usePresence(
  roomId: string,
  handlers: {
    onSync?: () => void;
    onJoin?: (event: any) => void;
    onLeave?: (event: any) => void;
  }
) {
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubscribeRef.current = realtimeService.subscribeToPresence(
      roomId,
      handlers
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [roomId]);
}
```

## Implementation Timeline

### Day 1: Candidates CRUD
- Morning: Implement API routes (4h)
- Afternoon: Build UI components and forms (4h)

### Day 2: Messages UI
- Morning: Create unified message service and hooks (4h)
- Afternoon: Build message UI with real-time updates (4h)

### Day 3: Task Management
- Morning: Connect to database with real-time (4h)
- Afternoon: Implement drag-and-drop and AI prioritization (4h)

### Day 4: Real-time Infrastructure
- Morning: Build realtime service layer (4h)
- Afternoon: Integration testing and debugging (4h)

## Testing Strategy

1. **Unit Tests**: Services and hooks
2. **Integration Tests**: API routes with database
3. **E2E Tests**: User flows with Playwright
4. **Real-time Tests**: WebSocket connections and updates

## Performance Considerations

1. **Virtual Scrolling**: For large lists (candidates, messages)
2. **Debouncing**: Search inputs and real-time updates
3. **Optimistic Updates**: Immediate UI feedback
4. **Connection Pooling**: Manage WebSocket connections
5. **Caching**: Use React Query for data fetching