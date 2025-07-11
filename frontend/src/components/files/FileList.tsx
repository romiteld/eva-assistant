'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Image,
  FileSpreadsheet,
  File,
  Download,
  Trash2,
  Share2,
  Tag,
  MoreVertical,
  Search,
  Filter,
  Grid,
  List,
} from 'lucide-react';
import { FileUploadService, FileMetadata, FileListOptions } from '@/lib/services/file-upload';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface FileListProps {
  bucket?: string;
  onFileSelect?: (file: FileMetadata) => void;
  onFileDelete?: (fileId: string) => void;
  showActions?: boolean;
  viewMode?: 'grid' | 'list';
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

export function FileList({
  bucket,
  onFileSelect,
  onFileDelete,
  showActions = true,
  viewMode: initialViewMode = 'list',
  className,
}: FileListProps) {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(initialViewMode);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [sortBy, setSortBy] = useState<FileListOptions['sortBy']>('created_at');
  const [sortOrder, setSortOrder] = useState<FileListOptions['sortOrder']>('desc');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);

  const uploadService = new FileUploadService();
  const itemsPerPage = 20;

  useEffect(() => {
    loadFiles();
  }, [bucket, searchQuery, selectedType, sortBy, sortOrder, currentPage]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const { files: fetchedFiles, total } = await uploadService.listFiles({
        bucket,
        search: searchQuery,
        fileType: selectedType,
        sortBy,
        sortOrder,
        limit: itemsPerPage,
        offset: currentPage * itemsPerPage,
      });
      setFiles(fetchedFiles);
      setTotalFiles(total);
    } catch (error) {
      console.error('Failed to load files:', error);
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

  const handleDownload = async (file: FileMetadata) => {
    try {
      const downloadUrl = await uploadService.getDownloadUrl(file.id);
      window.open(downloadUrl, '_blank');
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      await uploadService.deleteFile(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      setTotalFiles((prev) => prev - 1);
      onFileDelete?.(fileId);
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  const handleShare = (file: FileMetadata) => {
    // TODO: Implement share modal
    console.log('Share file:', file);
  };

  const handleAddTag = (file: FileMetadata) => {
    // TODO: Implement tag modal
    console.log('Add tag to file:', file);
  };

  const totalPages = Math.ceil(totalFiles / itemsPerPage);

  const renderGridView = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {files.map((file) => {
        const Icon = getFileIcon(file.file_type);
        return (
          <div
            key={file.id}
            className="group relative bg-white/5 rounded-lg border border-gray-700 hover:border-gray-600 transition-all cursor-pointer"
            onClick={() => onFileSelect?.(file)}
          >
            <div className="aspect-square p-4 flex flex-col items-center justify-center">
              <Icon className="h-12 w-12 text-gray-400 mb-2" />
              <p className="text-xs text-gray-300 text-center truncate w-full px-2">
                {file.filename}
              </p>
            </div>
            {showActions && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="p-1 bg-gray-800 rounded hover:bg-gray-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown(activeDropdown === file.id ? null : file.id);
                  }}
                >
                  <MoreVertical className="h-4 w-4 text-gray-400" />
                </button>
                {activeDropdown === file.id && (
                  <div className="absolute right-0 mt-1 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-10">
                    <button
                      className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center space-x-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(file);
                        setActiveDropdown(null);
                      }}
                    >
                      <Download className="h-4 w-4" />
                      <span>Download</span>
                    </button>
                    <button
                      className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center space-x-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShare(file);
                        setActiveDropdown(null);
                      }}
                    >
                      <Share2 className="h-4 w-4" />
                      <span>Share</span>
                    </button>
                    <button
                      className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center space-x-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddTag(file);
                        setActiveDropdown(null);
                      }}
                    >
                      <Tag className="h-4 w-4" />
                      <span>Add Tag</span>
                    </button>
                    <button
                      className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-700 flex items-center space-x-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(file.id);
                        setActiveDropdown(null);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderListView = () => (
    <div className="overflow-hidden rounded-lg border border-gray-700">
      <table className="w-full">
        <thead className="bg-gray-800/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Size
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Modified
            </th>
            {showActions && (
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {files.map((file) => {
            const Icon = getFileIcon(file.file_type);
            return (
              <tr
                key={file.id}
                className="hover:bg-white/5 cursor-pointer transition-colors"
                onClick={() => onFileSelect?.(file)}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center">
                    <Icon className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-sm text-gray-200">{file.filename}</span>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-sm text-gray-400">
                    {uploadService.getFileCategory(file.file_type)}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-sm text-gray-400">
                    {uploadService.formatFileSize(file.file_size)}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-sm text-gray-400">
                    {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
                  </span>
                </td>
                {showActions && (
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        className="p-1 text-gray-400 hover:text-gray-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(file);
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        className="p-1 text-gray-400 hover:text-gray-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShare(file);
                        }}
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                      <button
                        className="p-1 text-gray-400 hover:text-red-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(file.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Types</option>
            <option value="image/jpeg">Images</option>
            <option value="application/pdf">PDFs</option>
            <option value="application/msword">Documents</option>
            <option value="application/vnd.ms-excel">Spreadsheets</option>
          </select>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split('-') as [FileListOptions['sortBy'], FileListOptions['sortOrder']];
              setSortBy(newSortBy);
              setSortOrder(newSortOrder);
            }}
            className="px-3 py-2 bg-white/5 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-blue-500"
          >
            <option value="created_at-desc">Newest First</option>
            <option value="created_at-asc">Oldest First</option>
            <option value="filename-asc">Name (A-Z)</option>
            <option value="filename-desc">Name (Z-A)</option>
            <option value="file_size-desc">Largest First</option>
            <option value="file_size-asc">Smallest First</option>
          </select>
          <div className="flex bg-white/5 rounded-lg border border-gray-700">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-l-lg',
                viewMode === 'list' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400'
              )}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded-r-lg',
                viewMode === 'grid' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400'
              )}
            >
              <Grid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* File list/grid */}
      {files.length === 0 ? (
        <div className="text-center py-12">
          <File className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-400">No files found</p>
        </div>
      ) : viewMode === 'grid' ? (
        renderGridView()
      ) : (
        renderListView()
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Showing {currentPage * itemsPerPage + 1} to{' '}
            {Math.min((currentPage + 1) * itemsPerPage, totalFiles)} of {totalFiles} files
          </p>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="px-3 py-1 bg-white/5 border border-gray-700 rounded text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
              disabled={currentPage === totalPages - 1}
              className="px-3 py-1 bg-white/5 border border-gray-700 rounded text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}