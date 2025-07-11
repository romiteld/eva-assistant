'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Share2,
  Tag,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
  ExternalLink,
  Calendar,
  HardDrive,
  Hash,
  Loader2,
} from 'lucide-react';
import { FileUploadService, FileMetadata } from '@/lib/services/file-upload';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import Image from 'next/image';

interface FilePreviewProps {
  fileId: string;
  onClose?: () => void;
  onDownload?: (file: FileMetadata) => void;
  onShare?: (file: FileMetadata) => void;
  showActions?: boolean;
  className?: string;
}

const FILE_ICONS: Record<string, React.ElementType> = {
  'image/': ImageIcon,
  'application/pdf': FileText,
  'application/msword': FileText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileText,
  'application/vnd.ms-excel': FileSpreadsheet,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileSpreadsheet,
  'text/': FileText,
};

export function FilePreview({
  fileId,
  onClose,
  onDownload,
  onShare,
  showActions = true,
  className,
}: FilePreviewProps) {
  const [file, setFile] = useState<FileMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  const uploadService = new FileUploadService();

  useEffect(() => {
    loadFile();
  }, [fileId]);

  const loadFile = async () => {
    setLoading(true);
    try {
      const fileData = await uploadService.getFile(fileId);
      setFile(fileData);

      // Generate preview URL for images
      if (fileData.file_type.startsWith('image/')) {
        const url = await uploadService.getDownloadUrl(fileId);
        setPreviewUrl(url);
      }
    } catch (error) {
      console.error('Failed to load file:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (fileType: string) => {
    for (const [key, Icon] of Object.entries(FILE_ICONS)) {
      if (fileType.startsWith(key)) {
        return Icon;
      }
    }
    return File;
  };

  const handleDownload = async () => {
    if (!file) return;
    try {
      const downloadUrl = await uploadService.getDownloadUrl(file.id);
      window.open(downloadUrl, '_blank');
      onDownload?.(file);
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  };

  const handleAddTag = async () => {
    if (!file || !tagInput.trim()) return;
    try {
      await uploadService.addTags(file.id, [tagInput.trim()]);
      // Reload file to get updated tags
      await loadFile();
      setTagInput('');
      setShowTagInput(false);
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!file) return;
    try {
      await uploadService.removeTag(file.id, tag);
      // Reload file to get updated tags
      await loadFile();
    } catch (error) {
      console.error('Failed to remove tag:', error);
    }
  };

  if (loading || !file) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const Icon = getFileIcon(file.file_type);
  const isImage = file.file_type.startsWith('image/');
  const isPDF = file.file_type === 'application/pdf';

  return (
    <div className={cn('bg-gray-900 rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <Icon className="h-6 w-6 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-200 truncate max-w-xs">
            {file.filename}
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          {showActions && (
            <>
              <button
                onClick={handleDownload}
                className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded"
                title="Download"
              >
                <Download className="h-5 w-5" />
              </button>
              <button
                onClick={() => onShare?.(file)}
                className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded"
                title="Share"
              >
                <Share2 className="h-5 w-5" />
              </button>
            </>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="p-4">
        {isImage && previewUrl ? (
          <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
            <Image
              src={previewUrl}
              alt={file.filename}
              fill
              className="object-contain"
            />
          </div>
        ) : isPDF ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">PDF Preview not available</p>
            <button
              onClick={handleDownload}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Open in new tab</span>
            </button>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <Icon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">Preview not available for this file type</p>
          </div>
        )}
      </div>

      {/* File Details */}
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 mb-1">Type</p>
            <p className="text-gray-300">{uploadService.getFileCategory(file.file_type)}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">Size</p>
            <p className="text-gray-300">{uploadService.formatFileSize(file.file_size)}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">Created</p>
            <p className="text-gray-300">
              {format(new Date(file.created_at), 'MMM d, yyyy')}
            </p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">Modified</p>
            <p className="text-gray-300">
              {format(new Date(file.updated_at), 'MMM d, yyyy')}
            </p>
          </div>
        </div>

        {/* Tags */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm">Tags</p>
            <button
              onClick={() => setShowTagInput(!showTagInput)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              + Add tag
            </button>
          </div>
          {showTagInput && (
            <div className="flex items-center space-x-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="Enter tag name"
                className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAddTag}
                className="px-2 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                Add
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {file.tags?.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded group"
              >
                <Hash className="h-3 w-3 mr-1" />
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {(!file.tags || file.tags.length === 0) && !showTagInput && (
              <span className="text-gray-500 text-sm">No tags</span>
            )}
          </div>
        </div>

        {/* Additional Metadata */}
        {file.metadata && Object.keys(file.metadata).length > 0 && (
          <div>
            <p className="text-gray-500 text-sm mb-2">Additional Information</p>
            <div className="bg-gray-800 rounded p-3 text-xs text-gray-400 font-mono">
              <pre>{JSON.stringify(file.metadata, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}