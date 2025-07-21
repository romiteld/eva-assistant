// Hook for managing voice session tracking (temporarily disabled - tables removed)
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';

export interface VoiceSessionData {
  id: string;
  userId: string;
  sessionId: string;
  startedAt: Date;
  modelUsed: string;
  voiceType: string;
}

export function useVoiceSession(sessionId: string) {
  const { user } = useAuth();
  const [sessionData, setSessionData] = useState<VoiceSessionData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const sessionRef = useRef<string | null>(null);

  // Create mock session data (database tables removed)
  useEffect(() => {
    if (!user || !sessionId || sessionRef.current === sessionId) return;

    const createSession = async () => {
      setIsCreating(true);
      
      try {
        // Create mock session data without database
        const mockSession: VoiceSessionData = {
          id: `mock-${sessionId}`,
          userId: user.id,
          sessionId: sessionId,
          startedAt: new Date(),
          modelUsed: 'gemini-2.5-flash',
          voiceType: 'elevenlabs'
        };
        
        setSessionData(mockSession);
        sessionRef.current = sessionId;
      } catch (error) {
        console.error('Failed to create voice session:', error);
      } finally {
        setIsCreating(false);
      }
    };

    createSession();
  }, [user, sessionId]);

  // Mock update session metrics (database tables removed)
  const updateSession = async (updates: Partial<{
    endedAt: string;
    durationSeconds: number;
    totalTurns: number;
    userTurns: number;
    assistantTurns: number;
    functionCallsCount: number;
    errorCount: number;
    averageResponseTimeMs: number;
    toolsUsed: any[];
    pagesVisited: string[];
    commandsExecuted: any[];
  }>) => {
    // No-op: database tables removed
    console.log('Mock updateSession:', updates);
  };

  // Mock end session
  const endSession = async () => {
    if (!sessionData) return;

    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - sessionData.startedAt.getTime()) / 1000);

    console.log('Mock endSession:', { duration });
  };

  // Mock track command execution
  const trackCommand = async (
    commandType: string,
    commandData: any,
    status: 'pending' | 'running' | 'completed' | 'failed' = 'pending'
  ) => {
    if (!sessionData) return null;

    // Return mock command data
    const mockCommand = {
      id: `mock-cmd-${Date.now()}`,
      session_id: sessionData.id,
      command_type: commandType,
      command_data: commandData,
      status,
      created_at: new Date().toISOString()
    };
    
    console.log('Mock trackCommand:', mockCommand);
    return mockCommand;
  };

  // Mock update command status
  const updateCommand = async (
    commandId: string,
    updates: {
      status?: 'pending' | 'running' | 'completed' | 'failed';
      result?: any;
      errorMessage?: string;
    }
  ) => {
    console.log('Mock updateCommand:', { commandId, updates });
  };

  // Mock track tool usage
  const trackToolUsage = async (toolName: string, toolData: any) => {
    console.log('Mock trackToolUsage:', { toolName, toolData });
  };

  // Mock track page visit
  const trackPageVisit = async (page: string) => {
    console.log('Mock trackPageVisit:', page);
  };

  // Mock get current session tools
  const getSessionTools = async (): Promise<any[]> => {
    return [];
  };

  return {
    sessionData,
    isCreating,
    updateSession,
    endSession,
    trackCommand,
    updateCommand,
    trackToolUsage,
    trackPageVisit
  };
}