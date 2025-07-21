import { supabase } from '@/lib/supabase/browser'

export interface StorageSetupResult {
  success: boolean
  message?: string
  buckets?: Array<{
    bucket: string
    status: 'created' | 'exists'
    config: any
  }>
  error?: string
}

export interface StorageStatus {
  success: boolean
  buckets?: Array<{
    bucket: string
    exists: boolean
    config: any
  }>
  error?: string
}

export class StorageSetupService {
  private supabase = supabase

  /**
   * Initialize all storage buckets
   */
  async setupStorageBuckets(buckets?: string[]): Promise<StorageSetupResult> {
    try {
      const { data, error } = await this.supabase.functions.invoke('setup-storage', {
        body: {
          action: 'setup',
          buckets
        }
      })

      if (error) {
        throw error
      }

      return data
    } catch (error) {
      console.error('Storage setup error:', error)
      throw new Error(`Failed to setup storage: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get storage bucket status
   */
  async getStorageStatus(): Promise<StorageStatus> {
    try {
      const { data, error } = await this.supabase.functions.invoke('setup-storage', {
        body: {
          action: 'status'
        }
      })

      if (error) {
        throw error
      }

      return data
    } catch (error) {
      console.error('Storage status error:', error)
      throw new Error(`Failed to get storage status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Cleanup temporary files
   */
  async cleanupTempFiles(): Promise<StorageSetupResult> {
    try {
      const { data, error } = await this.supabase.functions.invoke('setup-storage', {
        body: {
          action: 'cleanup'
        }
      })

      if (error) {
        throw error
      }

      return data
    } catch (error) {
      console.error('Storage cleanup error:', error)
      throw new Error(`Failed to cleanup temp files: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Check if storage is properly configured
   */
  async isStorageConfigured(): Promise<boolean> {
    try {
      const status = await this.getStorageStatus()
      
      if (!status.success || !status.buckets) {
        return false
      }

      // Check if all required buckets exist
      const requiredBuckets = ['documents', 'resumes', 'avatars', 'temp-uploads', 'ai-generated']
      const existingBuckets = status.buckets.filter(b => b.exists).map(b => b.bucket)
      
      return requiredBuckets.every(bucket => existingBuckets.includes(bucket))
    } catch (error) {
      console.error('Storage configuration check failed:', error)
      return false
    }
  }

  /**
   * Initialize storage if not already configured
   */
  async ensureStorageConfigured(): Promise<void> {
    const isConfigured = await this.isStorageConfigured()
    
    if (!isConfigured) {
      const result = await this.setupStorageBuckets()
      
      if (!result.success) {
        throw new Error(`Storage setup failed: ${result.error}`)
      }
    }
  }

  /**
   * Get bucket configuration
   */
  getBucketConfig(bucket: string) {
    const configs = {
      documents: {
        maxSize: 25 * 1024 * 1024, // 25MB
        allowedTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'text/markdown',
          'application/rtf',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/csv',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ],
        public: false
      },
      resumes: {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
        ],
        public: false
      },
      avatars: {
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/svg+xml',
        ],
        public: true
      },
      'temp-uploads': {
        maxSize: 50 * 1024 * 1024, // 50MB
        allowedTypes: ['*'],
        public: false
      },
      'ai-generated': {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: [
          'image/jpeg',
          'image/png',
          'image/webp',
          'application/pdf',
          'text/plain',
          'text/markdown',
        ],
        public: false
      }
    }

    return configs[bucket as keyof typeof configs] || null
  }

  /**
   * Validate file against bucket configuration
   */
  validateFileForBucket(file: File, bucket: string): { valid: boolean; error?: string } {
    const config = this.getBucketConfig(bucket)
    
    if (!config) {
      return { valid: false, error: `Unknown bucket: ${bucket}` }
    }

    // Check file size
    if (file.size > config.maxSize) {
      return { 
        valid: false, 
        error: `File size (${this.formatFileSize(file.size)}) exceeds limit (${this.formatFileSize(config.maxSize)})`
      }
    }

    // Check file type
    if (!config.allowedTypes.includes('*') && !config.allowedTypes.includes(file.type)) {
      return { 
        valid: false, 
        error: `File type "${file.type}" is not allowed for bucket "${bucket}"`
      }
    }

    return { valid: true }
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}