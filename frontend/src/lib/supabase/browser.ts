import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

// Create the singleton client instance immediately
const supabaseClient = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
)

// Export the singleton instance directly
export const supabase = supabaseClient

// Keep createClient for backwards compatibility but it always returns the same instance
export function createClient() {
  return supabaseClient
}

// Realtime subscriptions
export const subscribeToChannel = (
  channel: string,
  callback: (payload: any) => void
) => {
  return supabase
    .channel(channel)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public' 
    }, callback)
    .subscribe()
}

// Helper functions for common operations
export const realtimeHelpers = {
  // Subscribe to conversations
  subscribeToConversations: (userId: string, callback: (payload: any) => void) => {
    return supabase
      .channel('conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe()
  },

  // Subscribe to tasks
  subscribeToTasks: (userId: string, callback: (payload: any) => void) => {
    return supabase
      .channel('tasks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe()
  },

  // Subscribe to workflows
  subscribeToWorkflows: (userId: string, callback: (payload: any) => void) => {
    return supabase
      .channel('workflows')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflows',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe()
  },

  // Broadcast presence
  trackPresence: (userId: string, userInfo: any) => {
    const channel = supabase.channel('presence')
    
    channel
      .on('presence', { event: 'sync' }, () => {
        console.log('Online users:', channel.presenceState())
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
            ...userInfo
          })
        }
      })

    return channel
  }
}

// File upload helper
export const uploadFile = async (
  file: File,
  bucket: string = 'documents',
  path?: string
) => {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Math.random()}.${fileExt}`
  const filePath = path ? `${path}/${fileName}` : fileName

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) throw error

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath)

  return { filePath, publicUrl }
}

// Vector search helper for semantic search
export const vectorSearch = async (
  embedding: number[],
  table: string,
  matchCount: number = 10,
  threshold: number = 0.7
) => {
  const { data, error } = await supabase.rpc('vector_search', {
    query_embedding: embedding,
    match_count: matchCount,
    match_threshold: threshold,
    table_name: table
  })

  if (error) throw error
  return data
}

// Export the Database type for convenience
export type { Database } from '@/types/database'
