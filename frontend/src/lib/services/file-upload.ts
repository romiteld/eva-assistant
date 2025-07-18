import { supabase } from '@/lib/supabase/browser';
import { v4 as uuidv4 } from 'uuid';

export interface FileUploadOptions {
  bucket?: string;
  path?: string;
  maxSize?: number;
  allowedTypes?: string[];
  generateUniqueName?: boolean;
  metadata?: Record<string, any>;
  onProgress?: (progress: number) => void;
}

export interface FileUploadResult {
  id: string;
  fileName: string;
  filePath: string;
  publicUrl: string;
  size: number;
  type: string;
  bucket: string;
}

export interface FileListOptions {
  bucket?: string;
  limit?: number;
  offset?: number;
  search?: string;
  fileType?: string;
  tags?: string[];
  sortBy?: 'created_at' | 'filename' | 'file_size';
  sortOrder?: 'asc' | 'desc';
}

export interface FileMetadata {
  id: string;
  filename: string;
  file_path: string;
  file_type: string;
  file_size: number;
  bucket: string;
  processed: boolean;
  embeddings_generated: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  tags?: string[];
  shared_with?: string[];
  version?: number;
}

// File type configurations
export const FILE_TYPE_CONFIGS = {
  images: {
    types: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  documents: {
    types: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'application/rtf',
    ],
    extensions: ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf'],
    maxSize: 25 * 1024 * 1024, // 25MB
  },
  spreadsheets: {
    types: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ],
    extensions: ['.xls', '.xlsx', '.csv'],
    maxSize: 25 * 1024 * 1024, // 25MB
  },
  presentations: {
    types: [
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    extensions: ['.ppt', '.pptx'],
    maxSize: 50 * 1024 * 1024, // 50MB
  },
  videos: {
    types: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
    extensions: ['.mp4', '.webm', '.ogv', '.mov'],
    maxSize: 100 * 1024 * 1024, // 100MB
  },
  audio: {
    types: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'],
    extensions: ['.mp3', '.wav', '.ogg', '.weba'],
    maxSize: 50 * 1024 * 1024, // 50MB
  },
};

// Default allowed file types (combine all common types)
export const DEFAULT_ALLOWED_TYPES = [
  ...FILE_TYPE_CONFIGS.images.types,
  ...FILE_TYPE_CONFIGS.documents.types,
  ...FILE_TYPE_CONFIGS.spreadsheets.types,
];

export class FileUploadService {
  private supabase = supabase;

  /**
   * Upload a file to Supabase Storage
   */
  async uploadFile(
    file: File,
    options: FileUploadOptions = {}
  ): Promise<FileUploadResult> {
    const {
      bucket = 'documents',
      path = '',
      maxSize = 25 * 1024 * 1024,
      allowedTypes = DEFAULT_ALLOWED_TYPES,
      generateUniqueName = true,
      metadata = {},
      onProgress,
    } = options;

    // Validate file
    this.validateFile(file, { maxSize, allowedTypes });

    // Get current user
    const { data: { user }, error: authError } = await this.supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Authentication required');
    }

    // Generate file path
    const fileName = this.generateFileName(file, generateUniqueName);
    const userPath = `${user.id}/${path ? `${path}/` : ''}${fileName}`;

    // Upload to Supabase Storage
    const { data, error: uploadError } = await this.supabase.storage
      .from(bucket)
      .upload(userPath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = this.supabase.storage
      .from(bucket)
      .getPublicUrl(userPath);

    // Save metadata to database
    const { data: docData, error: dbError } = await this.supabase
      .from('documents')
      .insert({
        user_id: user.id,
        filename: file.name,
        file_path: userPath,
        file_type: file.type,
        file_size: file.size,
        bucket,
        metadata: {
          ...metadata,
          original_name: file.name,
          upload_timestamp: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (dbError) {
      // Rollback: delete uploaded file
      await this.supabase.storage.from(bucket).remove([userPath]);
      throw new Error(`Failed to save metadata: ${dbError.message}`);
    }

    return {
      id: docData.id,
      fileName: file.name,
      filePath: userPath,
      publicUrl,
      size: file.size,
      type: file.type,
      bucket,
    };
  }

  /**
   * Upload multiple files
   */
  async uploadMultiple(
    files: File[],
    options: FileUploadOptions = {}
  ): Promise<FileUploadResult[]> {
    const results: FileUploadResult[] = [];
    const errors: Array<{ file: string; error: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const result = await this.uploadFile(file, {
          ...options,
          onProgress: options.onProgress
            ? (progress) => {
                const totalProgress = ((i + progress / 100) / files.length) * 100;
                options.onProgress!(totalProgress);
              }
            : undefined,
        });
        results.push(result);
      } catch (error) {
        errors.push({
          file: file.name,
          error: error instanceof Error ? error.message : 'Upload failed',
        });
      }
    }

    if (errors.length > 0) {
      console.error('Some files failed to upload:', errors);
    }

    return results;
  }

  /**
   * Delete a file
   */
  async deleteFile(documentId: string): Promise<void> {
    // Get file info
    const { data: doc, error: fetchError } = await this.supabase
      .from('documents')
      .select('file_path, bucket')
      .eq('id', documentId)
      .single();

    if (fetchError || !doc) {
      throw new Error('File not found');
    }

    // Delete from storage
    const { error: storageError } = await this.supabase.storage
      .from(doc.bucket)
      .remove([doc.file_path]);

    if (storageError) {
      throw new Error(`Failed to delete file: ${storageError.message}`);
    }

    // Delete from database
    const { error: dbError } = await this.supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (dbError) {
      throw new Error(`Failed to delete metadata: ${dbError.message}`);
    }
  }

  /**
   * List user files
   */
  async listFiles(options: FileListOptions = {}): Promise<{
    files: FileMetadata[];
    total: number;
  }> {
    const {
      bucket,
      limit = 20,
      offset = 0,
      search,
      fileType,
      tags,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = options;

    let query = this.supabase
      .from('documents')
      .select('*, file_tags(tag_name)', { count: 'exact' });

    // Apply filters
    if (bucket) {
      query = query.eq('bucket', bucket);
    }

    if (search) {
      query = query.ilike('filename', `%${search}%`);
    }

    if (fileType) {
      query = query.eq('file_type', fileType);
    }

    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }

    // Process results to include tags
    const files = data?.map((doc) => ({
      ...doc,
      tags: doc.file_tags?.map((t: any) => t.tag_name) || [],
    })) || [];

    // Filter by tags if specified
    const filteredFiles = tags && tags.length > 0
      ? files.filter((file) =>
          tags.every((tag) => file.tags.includes(tag))
        )
      : files;

    return {
      files: filteredFiles,
      total: count || 0,
    };
  }

  /**
   * Get a single file's metadata
   */
  async getFile(documentId: string): Promise<FileMetadata> {
    const { data, error } = await this.supabase
      .from('documents')
      .select('*, file_tags(tag_name)')
      .eq('id', documentId)
      .single();

    if (error || !data) {
      throw new Error('File not found');
    }

    return {
      ...data,
      tags: data.file_tags?.map((t: any) => t.tag_name) || [],
    };
  }

  /**
   * Generate a secure download URL with expiration
   */
  async getDownloadUrl(
    documentId: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const { data: doc, error: fetchError } = await this.supabase
      .from('documents')
      .select('file_path, bucket')
      .eq('id', documentId)
      .single();

    if (fetchError || !doc) {
      throw new Error('File not found');
    }

    const { data, error } = await this.supabase.storage
      .from(doc.bucket)
      .createSignedUrl(doc.file_path, expiresIn);

    if (error || !data) {
      throw new Error('Failed to generate download URL');
    }

    return data.signedUrl;
  }

  /**
   * Add tags to a file
   */
  async addTags(documentId: string, tags: string[]): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const tagInserts = tags.map((tag) => ({
      document_id: documentId,
      tag_name: tag.toLowerCase().trim(),
      created_by: user.id,
    }));

    const { error } = await this.supabase
      .from('file_tags')
      .insert(tagInserts)
      .select();

    if (error) {
      throw new Error(`Failed to add tags: ${error.message}`);
    }
  }

  /**
   * Remove a tag from a file
   */
  async removeTag(documentId: string, tagName: string): Promise<void> {
    const { error } = await this.supabase
      .from('file_tags')
      .delete()
      .eq('document_id', documentId)
      .eq('tag_name', tagName.toLowerCase().trim());

    if (error) {
      throw new Error(`Failed to remove tag: ${error.message}`);
    }
  }

  /**
   * Share a file with another user
   */
  async shareFile(
    documentId: string,
    shareWithEmail: string,
    permissions: string[] = ['view'],
    expiresAt?: Date
  ): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    // Get the user ID to share with
    const { data: shareUser, error: userError } = await this.supabase
      .from('auth.users')
      .select('id')
      .eq('email', shareWithEmail)
      .single();

    if (userError || !shareUser) {
      throw new Error('User not found');
    }

    const { error } = await this.supabase.from('file_shares').insert({
      document_id: documentId,
      shared_by: user.id,
      shared_with: shareUser.id,
      permissions,
      expires_at: expiresAt?.toISOString(),
    });

    if (error) {
      throw new Error(`Failed to share file: ${error.message}`);
    }
  }

  /**
   * Update file metadata
   */
  async updateMetadata(
    documentId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('documents')
      .update({
        metadata: metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (error) {
      throw new Error(`Failed to update metadata: ${error.message}`);
    }
  }

  /**
   * Validate file before upload
   */
  private validateFile(
    file: File,
    options: { maxSize: number; allowedTypes: string[] }
  ): void {
    // Check file size
    if (file.size > options.maxSize) {
      throw new Error(
        `File size (${this.formatFileSize(file.size)}) exceeds limit (${this.formatFileSize(
          options.maxSize
        )})`
      );
    }

    // Check file type
    if (!options.allowedTypes.includes(file.type)) {
      throw new Error(`File type "${file.type}" is not allowed`);
    }

    // Additional validation for file names
    if (file.name.includes('..') || file.name.includes('/')) {
      throw new Error('Invalid file name');
    }
  }

  /**
   * Generate a safe file name
   */
  private generateFileName(file: File, generateUnique: boolean): string {
    const extension = file.name.split('.').pop() || '';
    const baseName = file.name.replace(`.${extension}`, '');
    const safeName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');

    if (generateUnique) {
      const uniqueId = uuidv4().split('-')[0];
      return `${safeName}_${uniqueId}.${extension}`;
    }

    return `${safeName}.${extension}`;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get file type category
   */
  getFileCategory(mimeType: string): string {
    for (const [category, config] of Object.entries(FILE_TYPE_CONFIGS)) {
      if (config.types.includes(mimeType)) {
        return category;
      }
    }
    return 'other';
  }

  /**
   * Validate file for specific bucket
   */
  validateFileForBucket(file: File, bucket: string): { valid: boolean; error?: string } {
    const bucketConfigs = {
      documents: { maxSize: 25 * 1024 * 1024, allowedTypes: FILE_TYPE_CONFIGS.documents.types },
      resumes: { maxSize: 10 * 1024 * 1024, allowedTypes: FILE_TYPE_CONFIGS.documents.types },
      avatars: { maxSize: 5 * 1024 * 1024, allowedTypes: FILE_TYPE_CONFIGS.images.types },
      'temp-uploads': { maxSize: 50 * 1024 * 1024, allowedTypes: ['*'] },
      'ai-generated': { maxSize: 10 * 1024 * 1024, allowedTypes: [...FILE_TYPE_CONFIGS.images.types, ...FILE_TYPE_CONFIGS.documents.types] }
    }

    const config = bucketConfigs[bucket as keyof typeof bucketConfigs]
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
}