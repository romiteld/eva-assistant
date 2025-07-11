'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useSecureAPI } from '@/hooks/useSecureAPI';
import { Upload, X, FileText, Image, FileSpreadsheet, File } from 'lucide-react';

interface SecureFileUploadProps {
  onUploadSuccess?: (data: any) => void;
  onUploadError?: (error: string) => void;
  acceptedFileTypes?: string[];
  maxFileSize?: number;
  bucket?: string;
  path?: string;
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

export function SecureFileUpload({
  onUploadSuccess,
  onUploadError,
  acceptedFileTypes,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  bucket = 'documents',
  path = '',
}: SecureFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, loading } = useSecureAPI();

  const getFileIcon = (fileType: string) => {
    for (const [key, Icon] of Object.entries(FILE_ICONS)) {
      if (fileType.startsWith(key)) {
        return Icon;
      }
    }
    return File;
  };

  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > maxFileSize) {
      return `File size exceeds ${maxFileSize / 1024 / 1024}MB limit`;
    }

    // Check file type if restrictions are specified
    if (acceptedFileTypes && acceptedFileTypes.length > 0) {
      const isAccepted = acceptedFileTypes.some(type => {
        if (type.includes('*')) {
          const [mainType] = type.split('/');
          return file.type.startsWith(mainType);
        }
        return file.type === type;
      });

      if (!isAccepted) {
        return 'File type not accepted';
      }
    }

    return null;
  }, [maxFileSize, acceptedFileTypes]);

  const handleFileSelect = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      onUploadError?.(validationError);
      return;
    }

    setError(null);
    setSelectedFile(file);
  }, [validateFile, onUploadError]);

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadProgress(0);
    setError(null);

    try {
      const result = await uploadFile(selectedFile, { bucket, path });

      if (result.error) {
        setError(result.error);
        onUploadError?.(result.error);
      } else {
        setUploadProgress(100);
        onUploadSuccess?.(result.data);
        // Reset after successful upload
        setTimeout(() => {
          setSelectedFile(null);
          setUploadProgress(0);
        }, 1000);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      onUploadError?.(errorMessage);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
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
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={acceptedFileTypes?.join(',')}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
          }}
        />

        {!selectedFile ? (
          <div className="text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              Drop a file here, or{' '}
              <button
                type="button"
                className="text-blue-600 hover:text-blue-500"
                onClick={() => fileInputRef.current?.click()}
              >
                browse
              </button>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Maximum file size: {formatFileSize(maxFileSize)}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {React.createElement(getFileIcon(selectedFile.type), {
                  className: 'h-8 w-8 text-gray-400',
                })}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="ml-4 text-gray-400 hover:text-gray-500"
                onClick={() => {
                  setSelectedFile(null);
                  setError(null);
                  setUploadProgress(0);
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {uploadProgress > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            <button
              type="button"
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              onClick={handleUpload}
              disabled={loading || uploadProgress > 0}
            >
              {loading ? 'Uploading...' : 'Upload File'}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}