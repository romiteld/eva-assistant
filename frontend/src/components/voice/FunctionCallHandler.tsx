'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FunctionCall } from '@/types/voice';
import { Loader2, Code2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FunctionCallHandlerProps {
  functionCalls: FunctionCall[];
}

export function FunctionCallHandler({ functionCalls }: FunctionCallHandlerProps) {
  if (functionCalls.length === 0) return null;

  return (
    <div className="space-y-2">
      {functionCalls.map((call: FunctionCall) => (
        <Card key={call.id} className="border-orange-200 dark:border-orange-800">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <Loader2 className="h-4 w-4 mt-0.5 animate-spin text-orange-500" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Code2 className="h-3 w-3" />
                  <span className="font-semibold text-sm">{call.name}</span>
                  <Badge variant="outline" className="text-xs">
                    Processing
                  </Badge>
                </div>
                <pre className="text-xs bg-orange-50 dark:bg-orange-950 p-2 rounded overflow-x-auto">
                  {JSON.stringify(call.args, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}