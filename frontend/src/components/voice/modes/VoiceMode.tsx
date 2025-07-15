'use client';

import React, { useState, useEffect } from 'react';
import { VoiceAgentWithVisual } from '@/components/voice/VoiceAgentWithVisual';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tool, FunctionCall, VoiceType } from '@/types/voice';
import { 
  Mic, 
  Settings, 
  Clock, 
  Calculator, 
  Cloud,
  HelpCircle,
  Lightbulb,
  Brain
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceModeProps {
  sessionId?: string;
  onNewSession: () => void;
}

// Example tools for the voice agent
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
  { text: "What's the weather like?", icon: Cloud },
  { text: "Calculate 25% of 180", icon: Calculator },
  { text: "What time is it?", icon: Clock },
  { text: "Tell me a joke", icon: Lightbulb },
  { text: "Explain quantum computing", icon: Brain },
  { text: "How can I help you today?", icon: HelpCircle },
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

export function VoiceMode({ sessionId, onNewSession }: VoiceModeProps) {
  const [selectedVoice, setSelectedVoice] = useState<VoiceType>(VoiceType.PUCK);
  const [enabledTools, setEnabledTools] = useState<string[]>(['get_current_time', 'calculate']);
  const [showSettings, setShowSettings] = useState(false);

  const toggleTool = (toolName: string) => {
    setEnabledTools(prev =>
      prev.includes(toolName)
        ? prev.filter(t => t !== toolName)
        : [...prev, toolName]
    );
  };

  const enabledToolsList = exampleTools.filter(tool => enabledTools.includes(tool.name));

  const voiceOptions = [
    { value: VoiceType.PUCK, label: 'Puck (Default)' },
    { value: VoiceType.CHARON, label: 'Charon (Deep)' },
    { value: VoiceType.KORE, label: 'Kore (Warm)' },
    { value: VoiceType.FENRIR, label: 'Fenrir (Bold)' },
    { value: VoiceType.AOEDE, label: 'Aoede (Smooth)' },
  ];

  return (
    <div className="flex h-full">
      {/* Main Voice Interface */}
      <div className="flex-1 flex flex-col p-4">
        {/* Voice Agent */}
        <div className="flex-1 mb-4">
          <VoiceAgentWithVisual
            voice={selectedVoice}
            tools={enabledToolsList}
            onFunctionCall={handleFunctionCall}
            systemInstructions="You are EVA, a helpful AI assistant. Be concise, friendly, and professional."
            enableHistory={true}
            sessionId={sessionId}
          />
        </div>

        {/* Example Queries */}
        <Card className="bg-white/5 border-white/10">
          <div className="p-4">
            <h3 className="text-sm font-medium text-white mb-3">Try asking:</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {exampleQueries.map((query, index) => {
                const Icon = query.icon;
                return (
                  <button
                    key={index}
                    className="flex items-center gap-2 p-2 bg-white/5 rounded-lg text-xs text-gray-300 hover:bg-white/10 transition-colors text-left"
                  >
                    <Icon className="w-4 h-4 flex-shrink-0 text-purple-400" />
                    <span className="truncate">{query.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Settings Panel */}
      <div className={cn(
        "transition-all duration-300",
        showSettings ? "w-80" : "w-0 overflow-hidden"
      )}>
        <Card className="h-full bg-white/5 border-white/10 border-l-0 rounded-l-none">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Settings</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </Button>
            </div>

            {/* Voice Selection */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Voice Type</label>
              <Select value={selectedVoice} onValueChange={(value) => setSelectedVoice(value as VoiceType)}>
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {voiceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tools Configuration */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Available Tools</label>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {exampleTools.map((tool) => (
                    <label
                      key={tool.name}
                      className="flex items-center justify-between p-2 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={enabledTools.includes(tool.name)}
                          onChange={() => toggleTool(tool.name)}
                          className="rounded border-gray-600 text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <p className="text-sm text-white">{tool.name}</p>
                          <p className="text-xs text-gray-400">{tool.description}</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </Card>
      </div>

      {/* Settings Toggle */}
      {!showSettings && (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setShowSettings(true)}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <Settings className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
}