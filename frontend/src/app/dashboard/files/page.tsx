'use client';

import React, { useState } from 'react';
import { FileUploader } from '@/components/files/FileUploader';
import { FileList } from '@/components/files/FileList';
import { FilePreview } from '@/components/files/FilePreview';
import { FileUploadResult, FileMetadata } from '@/lib/services/file-upload';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FolderOpen, Upload, Clock, Share2 } from 'lucide-react';

export default function FilesPage() {
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);
  const [refreshList, setRefreshList] = useState(0);

  const handleUploadComplete = (results: FileUploadResult[]) => {
    console.log('Files uploaded:', results);
    // Refresh the file list
    setRefreshList((prev) => prev + 1);
  };

  const handleUploadError = (errors: Array<{ file: string; error: string }>) => {
    console.error('Upload errors:', errors);
    // TODO: Show error notifications
  };

  const handleFileSelect = (file: FileMetadata) => {
    setSelectedFile(file);
  };

  const handleFileDelete = (fileId: string) => {
    if (selectedFile?.id === fileId) {
      setSelectedFile(null);
    }
  };

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold text-white mb-2">File Management</h1>
          <p className="text-gray-400">Upload, organize, and manage your files</p>
        </div>

        <div className="flex-1 p-6 overflow-auto">
          <Tabs defaultValue="all" className="h-full flex flex-col">
            <TabsList className="grid w-full max-w-md grid-cols-4 mb-6">
              <TabsTrigger value="all" className="flex items-center space-x-2">
                <FolderOpen className="h-4 w-4" />
                <span>All Files</span>
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex items-center space-x-2">
                <Upload className="h-4 w-4" />
                <span>Upload</span>
              </TabsTrigger>
              <TabsTrigger value="recent" className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Recent</span>
              </TabsTrigger>
              <TabsTrigger value="shared" className="flex items-center space-x-2">
                <Share2 className="h-4 w-4" />
                <span>Shared</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="flex-1">
              <FileList
                key={refreshList}
                onFileSelect={handleFileSelect}
                onFileDelete={handleFileDelete}
              />
            </TabsContent>

            <TabsContent value="upload" className="flex-1">
              <div className="max-w-2xl mx-auto">
                <h2 className="text-lg font-semibold text-white mb-4">Upload Files</h2>
                <FileUploader
                  onUploadComplete={handleUploadComplete}
                  onUploadError={handleUploadError}
                  options={{
                    bucket: 'documents',
                    maxSize: 25 * 1024 * 1024, // 25MB
                  }}
                />
                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <h3 className="text-sm font-medium text-blue-400 mb-2">Supported Formats</h3>
                  <div className="text-xs text-gray-400 space-y-1">
                    <p>• Images: JPG, PNG, GIF, WebP, SVG</p>
                    <p>• Documents: PDF, DOC, DOCX, TXT, MD, RTF</p>
                    <p>• Spreadsheets: XLS, XLSX, CSV</p>
                    <p>• Maximum file size: 25MB</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="recent" className="flex-1">
              <FileList
                key={`recent-${refreshList}`}
                onFileSelect={handleFileSelect}
                onFileDelete={handleFileDelete}
                bucket="documents"
              />
            </TabsContent>

            <TabsContent value="shared" className="flex-1">
              <div className="flex items-center justify-center h-64 text-gray-400">
                <p>Shared files feature coming soon</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* File preview sidebar */}
      {selectedFile && (
        <div className="w-96 border-l border-gray-800 bg-gray-900 overflow-auto">
          <FilePreview
            fileId={selectedFile.id}
            onClose={() => setSelectedFile(null)}
            onDownload={(file) => console.log('Download:', file)}
            onShare={(file) => console.log('Share:', file)}
          />
        </div>
      )}
    </div>
  );
}