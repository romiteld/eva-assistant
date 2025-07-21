import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

export interface VoiceMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  audioCacheKey?: string;
  transcription?: string;
}

export interface ToolExecution {
  toolName: string;
  timestamp: string;
  input: any;
  output: any;
  duration: number;
  status: 'success' | 'error';
  error?: string;
}

export interface VoiceSession {
  id: string;
  userId: string;
  startTime: string;
  endTime?: string;
  messages: VoiceMessage[];
  toolExecutions: ToolExecution[];
  metadata?: {
    totalDuration?: number;
    messageCount?: number;
    toolCount?: number;
    modelUsed?: string;
  };
}

export interface SessionSummary {
  id: string;
  userId: string;
  startTime: string;
  endTime?: string;
  messageCount: number;
  duration?: number;
  fileName: string;
}

export class VoiceHistoryService {
  private static instance: VoiceHistoryService;
  private bucketName = 'voice-history';
  private supabase = createClient();

  private constructor() {}

  static getInstance(): VoiceHistoryService {
    if (!VoiceHistoryService.instance) {
      VoiceHistoryService.instance = new VoiceHistoryService();
    }
    return VoiceHistoryService.instance;
  }

  /**
   * Initialize the voice history bucket if it doesn't exist
   */
  async initializeBucket(): Promise<void> {
    try {
      const { data: buckets } = await this.supabase.storage.listBuckets();
      
      const bucketExists = buckets?.some(bucket => bucket.name === this.bucketName);
      
      if (!bucketExists) {
        const { error } = await this.supabase.storage.createBucket(this.bucketName, {
          public: false,
          fileSizeLimit: 5242880, // 5MB limit per file
          allowedMimeTypes: ['application/json']
        });
        
        if (error) {
          console.error('Error creating voice history bucket:', error);
        }
      }
    } catch (error) {
      console.error('Error initializing bucket:', error);
    }
  }

  /**
   * Save a voice session to storage
   */
  async saveSession(session: VoiceSession): Promise<{ success: boolean; error?: string }> {
    try {
      // Ensure bucket exists
      await this.initializeBucket();

      // Generate file path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filePath = `${session.userId}/${session.id}/${timestamp}.json`;

      // Calculate metadata
      const enrichedSession: VoiceSession = {
        ...session,
        endTime: session.endTime || new Date().toISOString(),
        metadata: {
          totalDuration: session.endTime 
            ? new Date(session.endTime).getTime() - new Date(session.startTime).getTime()
            : undefined,
          messageCount: session.messages.length,
          toolCount: session.toolExecutions.length,
          modelUsed: 'gemini-pro-2.5'
        }
      };

      // Upload to Supabase Storage
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, JSON.stringify(enrichedSession, null, 2), {
          contentType: 'application/json',
          upsert: false
        });

      if (error) {
        console.error('Error saving voice session:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in saveSession:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * List all sessions for a user
   */
  async listUserSessions(userId: string): Promise<SessionSummary[]> {
    try {
      const { data: files, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(userId, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        console.error('Error listing user sessions:', error);
        return [];
      }

      // Process each file to extract session summaries
      const summaries: SessionSummary[] = [];
      
      for (const folder of files || []) {
        if (folder.name && folder.id) {
          // List files in session folder
          const { data: sessionFiles } = await this.supabase.storage
            .from(this.bucketName)
            .list(`${userId}/${folder.name}`, {
              limit: 1,
              sortBy: { column: 'created_at', order: 'desc' }
            });

          if (sessionFiles && sessionFiles.length > 0) {
            const file = sessionFiles[0];
            const filePath = `${userId}/${folder.name}/${file.name}`;
            
            // Download and parse the session file
            const { data: sessionData } = await this.supabase.storage
              .from(this.bucketName)
              .download(filePath);

            if (sessionData) {
              const session: VoiceSession = JSON.parse(await sessionData.text());
              summaries.push({
                id: session.id,
                userId: session.userId,
                startTime: session.startTime,
                endTime: session.endTime,
                messageCount: session.messages.length,
                duration: session.metadata?.totalDuration,
                fileName: filePath
              });
            }
          }
        }
      }

      return summaries;
    } catch (error) {
      console.error('Error listing sessions:', error);
      return [];
    }
  }

  /**
   * Load a specific session
   */
  async loadSession(filePath: string): Promise<VoiceSession | null> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .download(filePath);

      if (error) {
        console.error('Error loading session:', error);
        return null;
      }

      const sessionText = await data.text();
      return JSON.parse(sessionText) as VoiceSession;
    } catch (error) {
      console.error('Error parsing session:', error);
      return null;
    }
  }

  /**
   * Get a signed URL for secure access to a session file
   */
  async getSessionUrl(filePath: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        console.error('Error creating signed URL:', error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error getting session URL:', error);
      return null;
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(filePath: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        console.error('Error deleting session:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteSession:', error);
      return false;
    }
  }

  /**
   * Delete old sessions (older than specified days)
   */
  async deleteOldSessions(userId: string, daysToKeep: number = 30): Promise<number> {
    try {
      const sessions = await this.listUserSessions(userId);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      let deletedCount = 0;

      for (const session of sessions) {
        const sessionDate = new Date(session.startTime);
        if (sessionDate < cutoffDate) {
          const success = await this.deleteSession(session.fileName);
          if (success) {
            deletedCount++;
          }
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Error deleting old sessions:', error);
      return 0;
    }
  }

  /**
   * Get storage usage for a user
   */
  async getUserStorageUsage(userId: string): Promise<{
    totalSessions: number;
    totalSize: number;
    oldestSession?: Date;
    newestSession?: Date;
  }> {
    try {
      const sessions = await this.listUserSessions(userId);
      
      let totalSize = 0;
      let oldestDate: Date | undefined;
      let newestDate: Date | undefined;

      for (const session of sessions) {
        // Get file info to calculate size
        const { data: files } = await this.supabase.storage
          .from(this.bucketName)
          .list(session.fileName.substring(0, session.fileName.lastIndexOf('/')), {
            limit: 100
          });

        if (files) {
          const file = files.find(f => session.fileName.endsWith(f.name));
          if (file && file.metadata?.size) {
            totalSize += file.metadata.size;
          }
        }

        const sessionDate = new Date(session.startTime);
        if (!oldestDate || sessionDate < oldestDate) {
          oldestDate = sessionDate;
        }
        if (!newestDate || sessionDate > newestDate) {
          newestDate = sessionDate;
        }
      }

      return {
        totalSessions: sessions.length,
        totalSize,
        oldestSession: oldestDate,
        newestSession: newestDate
      };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return {
        totalSessions: 0,
        totalSize: 0
      };
    }
  }
}

// Export singleton instance
export const voiceHistoryService = VoiceHistoryService.getInstance();