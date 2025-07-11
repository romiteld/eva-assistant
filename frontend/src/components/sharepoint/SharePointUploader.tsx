'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  Upload, 
  File, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileCode,
  FileSpreadsheet,
  FileArchive
} from 'lucide-react'
import { SharePointService } from '@/lib/services/sharepoint'
import { useDropzone } from 'react-dropzone'

interface SharePointUploaderProps {
  service: SharePointService
  driveId: string
  parentId: string | null
  onClose: () => void
  onUploadComplete: () => void
}

interface UploadFile {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
}

export default function SharePointUploader({
  service,
  driveId,
  parentId,
  onClose,
  onUploadComplete
}: SharePointUploaderProps) {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      status: 'pending' as const,
      progress: 0
    }))
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true
  })

  const uploadFiles = async () => {
    setUploading(true)
    let hasSuccess = false

    for (const uploadFile of files) {
      if (uploadFile.status !== 'pending') continue

      try {
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'uploading', progress: 0 }
            : f
        ))

        // Use large file upload for files over 4MB
        if (uploadFile.file.size > 4 * 1024 * 1024) {
          await service.uploadLargeFile(
            driveId,
            parentId,
            uploadFile.file.name,
            uploadFile.file,
            (progress) => {
              setFiles(prev => prev.map(f => 
                f.id === uploadFile.id 
                  ? { ...f, progress: Math.round(progress * 100) }
                  : f
              ))
            }
          )
        } else {
          const arrayBuffer = await uploadFile.file.arrayBuffer()
          await service.uploadFile(
            driveId,
            parentId,
            uploadFile.file.name,
            arrayBuffer
          )
        }

        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'success', progress: 100 }
            : f
        ))
        
        hasSuccess = true
      } catch (error) {
        console.error('Upload error:', error)
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
            : f
        ))
      }
    }

    setUploading(false)
    
    if (hasSuccess) {
      setTimeout(() => {
        onUploadComplete()
      }, 1000)
    }
  }

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const getFileIcon = (file: File) => {
    const type = file.type.toLowerCase()
    
    if (type.includes('image')) return FileImage
    if (type.includes('video')) return FileVideo
    if (type.includes('audio')) return FileAudio
    if (type.includes('sheet') || type.includes('excel')) return FileSpreadsheet
    if (type.includes('zip') || type.includes('archive')) return FileArchive
    if (type.includes('code') || type.includes('javascript') || type.includes('json')) return FileCode
    
    return FileText
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-white/5 backdrop-blur-xl border-b border-white/10 p-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Upload Files</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragActive
                ? 'border-purple-500 bg-purple-600/10'
                : 'border-white/20 hover:border-white/30 hover:bg-white/5'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-white font-medium mb-2">
              {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="text-gray-400 text-sm">or click to select files</p>
          </div>

          {/* Files List */}
          {files.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-white font-medium mb-3">Files to upload</h3>
              
              {files.map((uploadFile) => {
                const Icon = getFileIcon(uploadFile.file)
                
                return (
                  <div
                    key={uploadFile.id}
                    className="bg-white/5 border border-white/10 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-4">
                      <Icon className="w-8 h-8 text-gray-400 flex-shrink-0" />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-white font-medium truncate pr-4">
                            {uploadFile.file.name}
                          </p>
                          <span className="text-gray-400 text-sm">
                            {formatBytes(uploadFile.file.size)}
                          </span>
                        </div>
                        
                        {uploadFile.status === 'uploading' && (
                          <div className="w-full bg-white/10 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${uploadFile.progress}%` }}
                            />
                          </div>
                        )}
                        
                        {uploadFile.error && (
                          <p className="text-red-400 text-sm mt-1">{uploadFile.error}</p>
                        )}
                      </div>
                      
                      <div className="flex-shrink-0">
                        {uploadFile.status === 'pending' && (
                          <button
                            onClick={() => removeFile(uploadFile.id)}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                          >
                            <X className="w-4 h-4 text-gray-400" />
                          </button>
                        )}
                        
                        {uploadFile.status === 'uploading' && (
                          <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                        )}
                        
                        {uploadFile.status === 'success' && (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        )}
                        
                        {uploadFile.status === 'error' && (
                          <AlertCircle className="w-5 h-5 text-red-400" />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white/5 backdrop-blur-xl border-t border-white/10 p-6">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            
            <button
              onClick={uploadFiles}
              disabled={files.length === 0 || uploading}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
              Upload {files.length > 0 && `(${files.length})`}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}