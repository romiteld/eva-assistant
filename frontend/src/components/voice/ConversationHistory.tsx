'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConversationTurn } from '@/types/voice';
import { User, Bot, Code2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ConversationHistoryProps {
  turns: ConversationTurn[];
  maxHeight?: number;
}

export function ConversationHistory({ turns, maxHeight = 400 }: ConversationHistoryProps) {
  const getRoleIcon = (role: ConversationTurn['role']) => {
    switch (role) {
      case 'user':
        return <User className="h-4 w-4" />;
      case 'assistant':
        return <Bot className="h-4 w-4" />;
      case 'function':
        return <Code2 className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: ConversationTurn['role']) => {
    switch (role) {
      case 'user':
        return 'bg-blue-100 dark:bg-blue-900';
      case 'assistant':
        return 'bg-green-100 dark:bg-green-900';
      case 'function':
        return 'bg-purple-100 dark:bg-purple-900';
    }
  };

  if (turns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversation History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No conversation yet. Start speaking to begin.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversation History</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="pr-4" style={{ maxHeight }}>
          <div className="space-y-4">
            {turns.map((turn: ConversationTurn) => (
              <div
                key={turn.id}
                className={cn(
                  'rounded-lg p-3',
                  getRoleColor(turn.role)
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-1">{getRoleIcon(turn.role)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm capitalize">
                        {turn.role}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(turn.timestamp, 'HH:mm:ss')}
                      </span>
                    </div>
                    
                    {/* Content */}
                    {turn.content && (
                      <p className="text-sm">{turn.content}</p>
                    )}
                    
                    {/* Function Call */}
                    {turn.functionCall && (
                      <div className="text-sm">
                        <p className="font-medium">Function: {turn.functionCall.name}</p>
                        <pre className="mt-1 text-xs bg-black/10 dark:bg-white/10 p-2 rounded overflow-x-auto">
                          {JSON.stringify(turn.functionCall.args, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {/* Function Result */}
                    {turn.functionResult && (
                      <div className="text-sm">
                        <p className="font-medium">Result:</p>
                        <pre className="mt-1 text-xs bg-black/10 dark:bg-white/10 p-2 rounded overflow-x-auto">
                          {JSON.stringify(turn.functionResult.response, null, 2)}
                        </pre>
                        {turn.functionResult.error && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            Error: {turn.functionResult.error}
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* Metadata */}
                    {turn.metadata && Object.keys(turn.metadata).length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {Object.entries(turn.metadata).map(([key, value]) => (
                          <p key={key}>
                            {key}: {JSON.stringify(value)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}