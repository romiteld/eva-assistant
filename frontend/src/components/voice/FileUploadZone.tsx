'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { chatFileUploadService, ChatUploadedFile } from '@/lib/services/chat-file-upload';
import { cn } from '@/lib/utils';

interface FileUploadZoneProps {
  sessionId: string;
  onFilesUploaded: (files: ChatUploadedFile[]) => void;
  onFileRemove: (fileId: string) => void;
  uploadedFiles: ChatUploadedFile[];
  disabled?: boolean;
  className?: string;
}

export function FileUploadZone({
  sessionId,
  onFilesUploaded,
  onFileRemove,
  uploadedFiles,
  disabled = false,
  className
}: FileUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (disabled || acceptedFiles.length === 0) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    const uploadedFilesList: ChatUploadedFile[] = [];

    try {
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        
        // Validate file
        const validation = chatFileUploadService.validateChatFile(file);
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        // Upload file
        const uploadedFile = await chatFileUploadService.uploadChatFile(
          file,
          sessionId,
          (progress) => {
            const totalProgress = ((i + progress / 100) / acceptedFiles.length) * 100;
            setUploadProgress(totalProgress);
          }
        );

        uploadedFilesList.push(uploadedFile);
      }

      onFilesUploaded(uploadedFilesList);
    } catch (err) {
      console.error('File upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload files');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [sessionId, onFilesUploaded, disabled]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      'application/pdf': ['.pdf'],
      'text/*': ['.txt', '.md']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: disabled || uploading,
    multiple: true
  });

  const handleRemove = async (file: ChatUploadedFile) => {
    try {
      await chatFileUploadService.deleteChatFile(file.id);
      onFileRemove(file.id);
    } catch (err) {
      console.error('Failed to remove file:', err);
    }
  };

  return (
    <div className={className}>
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-gray-400',
          disabled && 'opacity-50 cursor-not-allowed',
          uploading && 'pointer-events-none'
        )}
      >
        <input {...getInputProps()} />
        
        {uploading ? (
          <div className="space-y-2">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-purple-600" />
            <p className="text-sm text-gray-600">Uploading...</p>
            <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
          </div>
        ) : isDragActive ? (
          <>
            <Upload className="w-8 h-8 mx-auto text-purple-600 mb-2" />
            <p className="text-sm text-gray-600">Drop files here</p>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">
              Drag & drop files or click to browse
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Images (PNG, JPG, WEBP) or Documents (PDF, TXT, MD) • Max 10MB
            </p>
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Uploaded files preview */}
      {uploadedFiles.length > 0 && (
        <div className="mt-3 space-y-2">
          {uploadedFiles.map(file => (
            <div
              key={file.id}
              className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
            >
              {file.fileType === 'image' ? (
                <ImageIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-orange-600 flex-shrink-0" />
              )}
              <span className="text-sm text-gray-700 truncate flex-1">
                {file.fileName}
              </span>
              <span className="text-xs text-gray-500 flex-shrink-0">
                {chatFileUploadService.formatFileSize(file.fileSize)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(file)}
                disabled={disabled}
                className="flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}