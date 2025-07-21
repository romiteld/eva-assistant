// Chat-specific file upload service for Eva multimodal interactions
import { FileUploadService } from './file-upload';
import { supabase } from '@/lib/supabase/browser';

export interface ChatUploadedFile {
  id: string;
  fileName: string;
  filePath: string;
  fileType: 'image' | 'document';
  fileSize: number;
  mimeType: string;
  url: string;
  content?: string; // For text files
  base64?: string; // For images
}

export class ChatFileUploadService extends FileUploadService {
  private readonly chatBucket = 'chat-uploads';
  private readonly maxChatFileSize = 10 * 1024 * 1024; // 10MB
  private readonly chatAllowedTypes = [
    // Images
    'image/png', 'image/jpeg', 'image/jpg', 'image/webp',
    // Documents
    'application/pdf', 'text/plain', 'text/markdown'
  ];

  async uploadChatFile(
    file: File,
    sessionId: string,
    onProgress?: (progress: number) => void
  ): Promise<ChatUploadedFile> {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Authentication required');
    }

    // Validate chat-specific constraints
    this.validateFile(file, {
      maxSize: this.maxChatFileSize,
      allowedTypes: this.chatAllowedTypes
    });

    // Upload file
    const uploadResult = await this.uploadFile(file, {
      bucket: this.chatBucket,
      path: sessionId,
      maxSize: this.maxChatFileSize,
      allowedTypes: this.chatAllowedTypes,
      generateUniqueName: true,
      metadata: {
        sessionId,
        uploadedFor: 'chat'
      },
      onProgress
    });

    // Process file content for multimodal use
    let content: string | undefined;
    let base64: string | undefined;

    if (this.isTextFile(file)) {
      content = await this.readTextFile(file);
    } else if (this.isImageFile(file)) {
      base64 = await this.readFileAsBase64(file);
    }

    return {
      id: uploadResult.id,
      fileName: uploadResult.fileName,
      filePath: uploadResult.filePath,
      fileType: this.getChatFileType(file),
      fileSize: uploadResult.size,
      mimeType: uploadResult.type,
      url: uploadResult.publicUrl,
      content,
      base64
    };
  }

  async deleteChatFile(fileId: string): Promise<void> {
    await this.deleteFile(fileId);
  }

  async getChatFileContent(filePath: string): Promise<string | ArrayBuffer> {
    const { data, error } = await supabase.storage
      .from(this.chatBucket)
      .download(filePath);

    if (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }

    // Convert blob to text or base64
    const mimeType = data.type;
    if (mimeType.startsWith('text/') || mimeType === 'application/pdf') {
      return await data.text();
    } else {
      return await this.blobToBase64(data);
    }
  }

  private async readTextFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  private async readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get pure base64
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get pure base64
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to convert blob'));
      reader.readAsDataURL(blob);
    });
  }

  private isTextFile(file: File): boolean {
    return file.type === 'text/plain' || file.type === 'text/markdown';
  }

  private isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }

  private getChatFileType(file: File): 'image' | 'document' {
    return this.isImageFile(file) ? 'image' : 'document';
  }

  validateChatFile(file: File): { valid: boolean; error?: string } {
    // Check file size
    if (file.size > this.maxChatFileSize) {
      return {
        valid: false,
        error: `File size exceeds ${this.maxChatFileSize / 1024 / 1024}MB limit`
      };
    }

    // Check file type
    if (!this.chatAllowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'File type not supported. Please upload images (PNG, JPG, WEBP) or documents (PDF, TXT, MD)'
      };
    }

    return { valid: true };
  }
}

export const chatFileUploadService = new ChatFileUploadService();