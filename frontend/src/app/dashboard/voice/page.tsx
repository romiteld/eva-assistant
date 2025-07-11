'use client';

import React, { useState, useEffect } from 'react';
import { VoiceAgent } from '@/components/voice/VoiceAgent';
import { VoiceAgentWithScreenShare } from '@/components/voice/VoiceAgentWithScreenShare';
import { Tool, FunctionCall, VoiceType } from '@/types/voice';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { chatHistory, ChatSession } from '@/lib/services/chatHistory';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Code, 
  Calendar, 
  Mail, 
  Calculator, 
  Cloud, 
  Search,
  History,
  Plus,
  Trash2,
  MessageSquare,
  Clock,
  Mic,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { useRequireAuth } from '@/hooks/useAuth';

// Example tools for demonstration
const exampleTools: Tool[] = [
  {
    name: 'get_current_time',
    description: 'Get the current date and time',
    parameters: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description: 'The timezone to get the time for (e.g., "America/New_York")',
        },
      },
    },
  },
  {
    name: 'calculate',
    description: 'Perform mathematical calculations',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'The mathematical expression to evaluate',
        },
      },
      required: ['expression'],
    },
  },
  {
    name: 'get_weather',
    description: 'Get the current weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city and state/country',
        },
      },
      required: ['location'],
    },
  },
];

// Example queries
const exampleQueries = [
  "What's the weather like in San Francisco?",
  "Calculate 25% of 180",
  "What time is it in Tokyo?",
  "How much is 15 euros in dollars?",
  "Tell me a joke",
  "Explain quantum computing",
];

// Tool handlers
const handleFunctionCall = async (functionCall: FunctionCall): Promise<any> => {
  switch (functionCall.name) {
    case 'get_current_time':
      const timezone = functionCall.args.timezone || 'UTC';
      const date = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        dateStyle: 'full',
        timeStyle: 'long',
      });
      return { time: formatter.format(date), timezone };

    case 'calculate':
      try {
        // Note: In production, use a proper math expression parser
        const result = eval(functionCall.args.expression);
        return { result, expression: functionCall.args.expression };
      } catch (error) {
        return { error: 'Invalid expression' };
      }

    case 'get_weather':
      // Mock weather data
      const weather = {
        location: functionCall.args.location,
        temperature: Math.floor(Math.random() * 30) + 10,
        condition: ['sunny', 'cloudy', 'rainy', 'partly cloudy'][Math.floor(Math.random() * 4)],
        humidity: Math.floor(Math.random() * 40) + 40,
      };
      return weather;

    default:
      throw new Error(`Unknown function: ${functionCall.name}`);
  }
};

function VoiceAgentPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [selectedVoice, setSelectedVoice] = useState<VoiceType>(VoiceType.PUCK);
  const [enabledTools, setEnabledTools] = useState<string[]>(['get_current_time', 'calculate']);
  const [enableHistory, setEnableHistory] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>();
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Load chat sessions
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const userSessions = await chatHistory.getUserSessions();
      setSessions(userSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const createNewSession = () => {
    setSelectedSessionId(undefined);
  };

  const selectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await chatHistory.deleteSession(sessionId);
      await loadSessions();
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(undefined);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const toggleTool = (toolName: string) => {
    setEnabledTools(prev =>
      prev.includes(toolName)
        ? prev.filter(t => t !== toolName)
        : [...prev, toolName]
    );
  };

  const enabledToolsList = exampleTools.filter(tool => enabledTools.includes(tool.name));

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Mic className="w-8 h-8 text-purple-400" />
              Voice Agent
            </h1>
            <p className="text-gray-400 mt-1">
              Interact with AI using natural voice conversations
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            Powered by Gemini Live API
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Voice Interface */}
          <div className="lg:col-span-2">
            <VoiceAgentWithScreenShare
              voice={selectedVoice}
              tools={enabledToolsList}
              onFunctionCall={handleFunctionCall}
              systemInstructions="You are EVA, a helpful AI assistant. Be concise, friendly, and professional."
              enableHistory={enableHistory}
              sessionId={selectedSessionId}
            />

            {/* Example Queries */}
            <Card className="mt-6 bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Example Queries</CardTitle>
                <CardDescription className="text-gray-400">
                  Try asking these questions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {exampleQueries.map((query, index) => (
                    <div
                      key={index}
                      className="p-3 bg-white/5 rounded-lg text-sm text-gray-300 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      &quot;{query}&quot;
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            {/* Chat History */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Chat History
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={enableHistory}
                      onCheckedChange={setEnableHistory}
                    />
                    <Label className="text-sm text-gray-400">Enable</Label>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <Button
                    onClick={createNewSession}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Chat
                  </Button>
                </div>
                
                <ScrollArea className="h-[300px]">
                  {isLoadingSessions ? (
                    <div className="text-center text-gray-400 py-4">
                      Loading sessions...
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="text-center text-gray-400 py-4">
                      No chat history yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sessions.map((session: ChatSession) => (
                        <div
                          key={session.id}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedSessionId === session.id
                              ? 'bg-purple-600/20 border border-purple-500/30'
                              : 'bg-white/5 hover:bg-white/10'
                          }`}
                          onClick={() => selectSession(session.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm text-white font-medium truncate">
                                {session.title}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {format(new Date(session.created_at), 'MMM d, h:mm a')}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSession(session.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Tools Configuration */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Available Tools</CardTitle>
                <CardDescription className="text-gray-400">
                  Enable tools to extend voice agent capabilities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {exampleTools.map((tool: Tool) => (
                    <div
                      key={tool.name}
                      className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {tool.name === 'get_current_time' && <Clock className="w-5 h-5 text-blue-400" />}
                        {tool.name === 'calculate' && <Calculator className="w-5 h-5 text-green-400" />}
                        {tool.name === 'get_weather' && <Cloud className="w-5 h-5 text-yellow-400" />}
                        <div>
                          <p className="text-sm font-medium text-white">{tool.name}</p>
                          <p className="text-xs text-gray-400">{tool.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={enabledTools.includes(tool.name)}
                        onCheckedChange={() => toggleTool(tool.name)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default VoiceAgentPage;