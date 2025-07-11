'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Image, FileSpreadsheet, File, CheckCircle, AlertCircle } from 'lucide-react';
import { FileUploadService, FileUploadOptions, FileUploadResult } from '@/lib/services/file-upload';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onUploadComplete?: (results: FileUploadResult[]) => void;
  onUploadError?: (errors: Array<{ file: string; error: string }>) => void;
  options?: FileUploadOptions;
  multiple?: boolean;
  accept?: string;
  className?: string;
}

const FILE_ICONS: Record<string, React.ElementType> = {
  'image/': Image,
  'application/pdf': FileText,
  'application/msword': FileText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileText,
  'application/vnd.ms-excel': FileSpreadsheet,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileSpreadsheet,
  'text/': FileText,
};

interface UploadingFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  result?: FileUploadResult;
}

export function FileUploader({
  onUploadComplete,
  onUploadError,
  options = {},
  multiple = true,
  accept,
  className,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadService = new FileUploadService();

  const getFileIcon = (fileType: string) => {
    for (const [key, Icon] of Object.entries(FILE_ICONS)) {
      if (fileType.startsWith(key)) {
        return Icon;
      }
    }
    return File;
  };

  const handleFiles = useCallback(async (files: File[]) => {
    // Initialize uploading files state
    const newUploadingFiles: UploadingFile[] = files.map((file) => ({
      file,
      progress: 0,
      status: 'pending' as const,
    }));
    setUploadingFiles((prev) => [...prev, ...newUploadingFiles]);

    const results: FileUploadResult[] = [];
    const errors: Array<{ file: string; error: string }> = [];

    // Upload files one by one
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uploadIndex = uploadingFiles.length + i;

      try {
        // Update status to uploading
        setUploadingFiles((prev) =>
          prev.map((f, idx) =>
            idx === uploadIndex ? { ...f, status: 'uploading' } : f
          )
        );

        // Upload file
        const result = await uploadService.uploadFile(file, {
          ...options,
          onProgress: (progress) => {
            setUploadingFiles((prev) =>
              prev.map((f, idx) =>
                idx === uploadIndex ? { ...f, progress } : f
              )
            );
          },
        });

        // Update status to success
        setUploadingFiles((prev) =>
          prev.map((f, idx) =>
            idx === uploadIndex
              ? { ...f, status: 'success', progress: 100, result }
              : f
          )
        );

        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        
        // Update status to error
        setUploadingFiles((prev) =>
          prev.map((f, idx) =>
            idx === uploadIndex
              ? { ...f, status: 'error', error: errorMessage }
              : f
          )
        );

        errors.push({
          file: file.name,
          error: errorMessage,
        });
      }
    }

    // Notify parent component
    if (results.length > 0 && onUploadComplete) {
      onUploadComplete(results);
    }

    if (errors.length > 0 && onUploadError) {
      onUploadError(errors);
    }

    // Clear completed uploads after 3 seconds
    setTimeout(() => {
      setUploadingFiles((prev) =>
        prev.filter((f) => f.status === 'uploading' || f.status === 'pending')
      );
    }, 3000);
  }, [uploadService, options, onUploadComplete, onUploadError, uploadingFiles.length]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFiles(multiple ? files : [files[0]]);
    }
  }, [handleFiles, multiple]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  const removeFile = useCallback((index: number) => {
    setUploadingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg p-6 transition-all duration-200',
          isDragging
            ? 'border-blue-500 bg-blue-50/10 scale-[1.02]'
            : 'border-gray-300/50 hover:border-gray-400/50 bg-white/5'
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple={multiple}
          accept={accept}
          onChange={handleFileSelect}
        />

        <div className="text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-300">
            Drag and drop files here, or{' '}
            <button
              type="button"
              className="text-blue-500 hover:text-blue-400 font-medium"
              onClick={() => fileInputRef.current?.click()}
            >
              browse
            </button>
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {options.maxSize && `Max size: ${uploadService.formatFileSize(options.maxSize)}`}
          </p>
        </div>
      </div>

      {/* Uploading files list */}
      {uploadingFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploadingFiles.map((uploadFile, index) => {
            const Icon = getFileIcon(uploadFile.file.type);
            return (
              <div
                key={`${uploadFile.file.name}-${index}`}
                className="flex items-center p-3 bg-white/5 rounded-lg border border-gray-700"
              >
                <Icon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                <div className="ml-3 flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-200 truncate">
                      {uploadFile.file.name}
                    </p>
                    <div className="flex items-center space-x-2">
                      {uploadFile.status === 'success' && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      {uploadFile.status === 'error' && (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-gray-400 hover:text-gray-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1">
                    <p className="text-xs text-gray-500">
                      {uploadService.formatFileSize(uploadFile.file.size)}
                      {uploadFile.error && (
                        <span className="ml-2 text-red-400">• {uploadFile.error}</span>
                      )}
                    </p>
                    {uploadFile.status === 'uploading' && (
                      <div className="mt-2 w-full bg-gray-700 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadFile.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}