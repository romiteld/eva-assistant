import { authService } from '@/lib/auth/auth-service';
import { supabase } from './browser';
import { getAuthCallbackURL } from '@/lib/utils/url';

// Auth types
export interface AuthUser {
  id: string;
  email: string;
  profile?: {
    full_name?: string;
    avatar_url?: string;
    company?: string;
    role?: string;
    preferences?: Record<string, any>;
  };
}

// Combined Authentication Helpers (Supabase + Microsoft Entra ID)
export const authHelpers = {
  // Sign up with email and password
  signUp: async (params: {
    email: string;
    password: string;
    options?: {
      data?: Record<string, any>;
    };
  }) => {
    // Use dynamic URL that works with Vercel preview deployments
    const redirectUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/auth/callback`
      : getAuthCallbackURL();
      
    const { data, error } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: params.options?.data,
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) throw error;
    return { data, error };
  },

  // Send magic link to email (Supabase)
  sendMagicLink: async (email: string) => {
    // Use dynamic URL that works with Vercel preview deployments
    const redirectUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/auth/callback`
      : getAuthCallbackURL();
    
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
        shouldCreateUser: true, // Allow new users to sign up
      },
    });
    
    if (error) throw error;
    return data;
  },

  // Sign in with Microsoft (using custom OAuth with PKCE)
  signInWithMicrosoft: async () => {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        throw new Error('Microsoft OAuth can only be used in the browser');
      }
      
      // We'll use a custom OAuth flow that properly handles PKCE
      const module = await import('@/lib/auth/microsoft-oauth');
      
      if (!module.signInWithMicrosoftPKCE) {
        throw new Error('Microsoft OAuth module not loaded properly');
      }
      
      await module.signInWithMicrosoftPKCE();
      
      // The function will redirect, so we return success
      return { url: null, provider: 'azure' };
    } catch (error) {
      console.error('Microsoft sign-in error:', error);
      throw error;
    }
  },

  // Sign in with LinkedIn (using custom OAuth)
  signInWithLinkedIn: async () => {
    try {
      const { signInWithLinkedInPKCE } = await import('@/lib/auth/linkedin-oauth');
      await signInWithLinkedInPKCE();
      
      // The function will redirect, so we return success
      return { url: null, provider: 'linkedin' };
    } catch (error) {
      console.error('LinkedIn sign-in error:', error);
      throw error;
    }
  },

  // Get current user
  getCurrentUser: async (): Promise<AuthUser | null> => {
    const { user, error } = await authService.getUser();
    
    if (error || !user) return null;
    
    // Get profile data
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    return {
      id: user.id,
      email: user.email!,
      profile: profile || undefined,
    };
  },

  // Subscribe to auth state changes
  onAuthStateChange: (callback: (user: AuthUser | null) => void) => {
    return authService.onAuthStateChange((event, session) => {
      // IMPORTANT: Don't make async Supabase calls inside this callback
      // to avoid deadlock issues. Use setTimeout to defer any async operations.
      if (session?.user) {
        // Convert session user to AuthUser without additional DB calls
        const user: AuthUser = {
          id: session.user.id,
          email: session.user.email!,
          profile: session.user.user_metadata as any
        };
        callback(user);
        
        // Fetch profile data asynchronously outside the callback
        setTimeout(async () => {
          try {
            const fullUser = await authHelpers.getCurrentUser();
            if (fullUser) {
              callback(fullUser);
            }
          } catch (error) {
            console.error('Error fetching user profile:', error);
          }
        }, 0);
      } else {
        callback(null);
      }
    });
  },

  // Sign out
  signOut: async () => {
    const { error } = await authService.signOut();
    if (error) throw error;
  }
};

// RAG (Retrieval-Augmented Generation) helpers
export const ragHelpers = {
  // Store embeddings for RAG
  storeEmbedding: async (params: {
    content: string;
    embedding: number[];
    metadata?: Record<string, any>;
    userId: string;
  }) => {
    const { data, error } = await supabase
      .from('embeddings')
      .insert({
        content: params.content,
        embedding: params.embedding,
        metadata: params.metadata || {},
        user_id: params.userId
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Search embeddings using vector similarity
  searchEmbeddings: async (params: {
    embedding: number[];
    threshold?: number;
    limit?: number;
    userId?: string;
  }) => {
    const { data, error } = await supabase.rpc('match_embeddings', {
      query_embedding: params.embedding,
      match_threshold: params.threshold || 0.7,
      match_count: params.limit || 10,
      filter_user_id: params.userId
    });

    if (error) throw error;
    return data;
  },

  // Store conversation for RAG context
  storeConversation: async (params: {
    messages: Array<{ role: string; content: string }>;
    metadata?: Record<string, any>;
    userId: string;
  }) => {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        messages: params.messages,
        metadata: params.metadata || {},
        user_id: params.userId
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get recent conversations for context
  getRecentConversations: async (params: {
    userId: string;
    limit?: number;
  }) => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', params.userId)
      .order('created_at', { ascending: false })
      .limit(params.limit || 10);

    if (error) throw error;
    return data;
  },

  // Upload and process document for RAG
  uploadAndProcessDocument: async (file: File, userId: string) => {
    try {
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Create document record in database
      const { data: documentData, error: documentError } = await supabase
        .from('documents')
        .insert({
          user_id: userId,
          file_name: file.name,
          file_path: fileName,
          file_size: file.size,
          mime_type: file.type,
          status: 'processing'
        })
        .select()
        .single();

      if (documentError) throw documentError;

      // TODO: In production, trigger an Edge Function to process the document
      // For now, we'll just mark it as processed after a delay
      setTimeout(async () => {
        await supabase
          .from('documents')
          .update({ status: 'processed' })
          .eq('id', documentData.id);
      }, 2000);

      return documentData;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  }
};
