'use client';

import { useState, useCallback, useEffect } from 'react';
import { UnifiedSession, CommunicationMode } from '@/types/communication';
import { supabase } from '@/lib/supabase/browser';
import { useAuth } from '@/hooks/useAuth';

export function useUnifiedCommunication() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<UnifiedSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>();
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Load all sessions from Supabase
  const loadSessions = useCallback(async () => {
    if (!user) return;
    
    setIsLoadingSessions(true);
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select(`
          id,
          user_id,
          title,
          mode,
          created_at,
          updated_at,
          metadata,
          media_metadata
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Get counts for each session
      const sessionsWithCounts = await Promise.all(
        (data || []).map(async (session) => {
          // Get message count
          const { count: messageCount } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', session.id);

          // Get participant count
          const { count: participantCount } = await supabase
            .from('stream_participants')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', session.id);

          // Get recording count
          const { count: recordingCount } = await supabase
            .from('media_recordings')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', session.id);

          return {
            ...session,
            message_count: messageCount || 0,
            participant_count: participantCount || 0,
            recording_count: recordingCount || 0,
          } as UnifiedSession;
        })
      );

      setSessions(sessionsWithCounts);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [user]);

  // Create a new session
  const createNewSession = useCallback(async (mode: CommunicationMode) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          title: `New ${mode} session`,
          mode,
          metadata: {},
          media_metadata: {},
        })
        .select()
        .single();

      if (error) throw error;

      const newSession: UnifiedSession = {
        ...data,
        message_count: 0,
        participant_count: 0,
        recording_count: 0,
      };

      setSessions((prev) => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      
      return newSession;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  }, [user]);

  // Select a session
  const selectSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
  }, []);

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      
      if (currentSessionId === sessionId) {
        setCurrentSessionId(undefined);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      throw error;
    }
  }, [currentSessionId]);

  // Update session metadata
  const updateSession = useCallback(async (
    sessionId: string, 
    updates: Partial<UnifiedSession>
  ) => {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .update({
          title: updates.title,
          metadata: updates.metadata,
          media_metadata: updates.media_metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;

      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, ...data } : s))
      );

      return data;
    } catch (error) {
      console.error('Failed to update session:', error);
      throw error;
    }
  }, []);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`sessions-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_sessions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            loadSessions();
          } else if (payload.eventType === 'UPDATE') {
            setSessions((prev) =>
              prev.map((s) =>
                s.id === payload.new.id
                  ? { ...s, ...payload.new }
                  : s
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setSessions((prev) =>
              prev.filter((s) => s.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadSessions]);

  return {
    sessions,
    currentSessionId,
    isLoadingSessions,
    createNewSession,
    selectSession,
    deleteSession,
    updateSession,
    loadSessions,
  };
}