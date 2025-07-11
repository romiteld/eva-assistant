import { createClient } from '@/lib/supabase/browser'
import type { ConversationTurn } from '@/types/voice'

export interface ChatSession {
  id: string
  user_id: string
  title: string
  model: string
  created_at: string
  updated_at: string
  metadata?: Record<string, any>
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'function'
  content: string
  function_call?: {
    name: string
    args: Record<string, any>
  }
  function_result?: {
    response: any
    error?: string
  }
  timestamp: string
  metadata?: Record<string, any>
}

export class ChatHistoryService {
  private supabase = createClient()

  // Session Management
  async createSession(title: string, model: string = 'gemini-2.5-flash-preview-native-audio-dialog'): Promise<ChatSession> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) {
      console.warn('User not authenticated, chat history will not be saved')
      // Return a mock session for development
      return {
        id: `local-${Date.now()}`,
        user_id: 'anonymous',
        title,
        model,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          voice_enabled: true,
          created_via: 'voice_agent'
        }
      }
    }

    const { data, error } = await this.supabase
      .from('chat_sessions')
      .insert({
        user_id: user.id,
        title,
        model,
        metadata: {
          voice_enabled: true,
          created_via: 'voice_agent'
        }
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async getUserSessions(limit: number = 20): Promise<ChatSession[]> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) {
      console.warn('User not authenticated, returning empty sessions')
      return []
    }

    const { data, error } = await this.supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    const { data, error } = await this.supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error) {
      console.error('Error fetching session:', error)
      return null
    }
    return data
  }

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    const { error } = await this.supabase
      .from('chat_sessions')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', sessionId)

    if (error) throw error
  }

  async deleteSession(sessionId: string): Promise<void> {
    // Delete all messages first
    await this.supabase
      .from('chat_messages')
      .delete()
      .eq('session_id', sessionId)

    // Then delete the session
    const { error } = await this.supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)

    if (error) throw error
  }

  // Message Management
  async saveMessage(
    sessionId: string,
    turn: ConversationTurn
  ): Promise<ChatMessage> {
    // Check if it's a local session (not saved to DB)
    if (sessionId.startsWith('local-')) {
      console.warn('Local session, message not saved to database')
      return {
        id: `msg-${Date.now()}`,
        session_id: sessionId,
        role: turn.role,
        content: turn.content || '',
        function_call: turn.functionCall,
        function_result: turn.functionResult,
        timestamp: turn.timestamp.toISOString(),
        metadata: turn.metadata
      }
    }
    const message: any = {
      session_id: sessionId,
      role: turn.role,
      content: turn.content || '',
      timestamp: turn.timestamp.toISOString(),
      metadata: turn.metadata
    }

    if (turn.functionCall) {
      message.function_call = turn.functionCall
    }

    if (turn.functionResult) {
      message.function_result = turn.functionResult
    }

    const { data, error } = await this.supabase
      .from('chat_messages')
      .insert(message)
      .select()
      .single()

    if (error) throw error

    // Update session's updated_at
    await this.supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId)

    return data
  }

  async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    const { data, error } = await this.supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true })

    if (error) throw error
    return data || []
  }

  // Search
  async searchMessages(query: string): Promise<{ session: ChatSession; message: ChatMessage }[]> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) {
      console.warn('User not authenticated, returning empty search results')
      return []
    }

    const { data, error } = await this.supabase
      .from('chat_messages')
      .select(`
        *,
        chat_sessions!inner(*)
      `)
      .eq('chat_sessions.user_id', user.id)
      .ilike('content', `%${query}%`)
      .order('timestamp', { ascending: false })
      .limit(50)

    if (error) throw error

    return (data || []).map(item => ({
      session: item.chat_sessions,
      message: {
        id: item.id,
        session_id: item.session_id,
        role: item.role,
        content: item.content,
        function_call: item.function_call,
        function_result: item.function_result,
        timestamp: item.timestamp,
        metadata: item.metadata
      }
    }))
  }

  // Analytics
  async getSessionStats(): Promise<{
    totalSessions: number
    totalMessages: number
    avgMessagesPerSession: number
    mostUsedModel: string
  }> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) {
      console.warn('User not authenticated, returning empty stats')
      return {
        totalSessions: 0,
        totalMessages: 0,
        avgMessagesPerSession: 0,
        mostUsedModel: 'gemini-2.5-flash-preview-native-audio-dialog'
      }
    }

    // Get session count
    const { count: sessionCount } = await this.supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // Get message count
    const { count: messageCount } = await this.supabase
      .from('chat_messages')
      .select(`
        *,
        chat_sessions!inner(user_id)
      `, { count: 'exact', head: true })
      .eq('chat_sessions.user_id', user.id)

    // Get most used model
    const { data: models } = await this.supabase
      .from('chat_sessions')
      .select('model')
      .eq('user_id', user.id)

    const modelCounts = (models || []).reduce((acc, { model }) => {
      acc[model] = (acc[model] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const mostUsedModel = Object.entries(modelCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'gemini-2.5-flash-preview-native-audio-dialog'

    return {
      totalSessions: sessionCount || 0,
      totalMessages: messageCount || 0,
      avgMessagesPerSession: sessionCount ? (messageCount || 0) / sessionCount : 0,
      mostUsedModel
    }
  }

  // Export
  async exportSession(sessionId: string): Promise<{
    session: ChatSession
    messages: ChatMessage[]
  }> {
    const session = await this.getSession(sessionId)
    if (!session) throw new Error('Session not found')

    const messages = await this.getSessionMessages(sessionId)

    return { session, messages }
  }

  async exportAllSessions(): Promise<{
    sessions: ChatSession[]
    messages: Record<string, ChatMessage[]>
  }> {
    const sessions = await this.getUserSessions(1000) // Get all sessions
    const messages: Record<string, ChatMessage[]> = {}

    for (const session of sessions) {
      messages[session.id] = await this.getSessionMessages(session.id)
    }

    return { sessions, messages }
  }
}

// Singleton instance
export const chatHistory = new ChatHistoryService()