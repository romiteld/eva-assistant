import { describe, it, expect, beforeEach } from 'vitest'
import { FileUploadService } from './file-upload'
import { createMockFile } from '@/test/test-utils'

describe('FileUploadService', () => {
  let service: FileUploadService

  beforeEach(() => {
    service = new FileUploadService()
  })

  describe('validateFileForBucket', () => {
    it('should validate PDF files for documents bucket', () => {
      const pdfFile = createMockFile('test.pdf', 'application/pdf', 1024 * 1024) // 1MB
      
      const result = service.validateFileForBucket(pdfFile, 'documents')
      expect(result.valid).toBe(true)
    })

    it('should reject oversized files', () => {
      const largeFile = createMockFile('large.pdf', 'application/pdf', 30 * 1024 * 1024) // 30MB
      
      const result = service.validateFileForBucket(largeFile, 'documents')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('exceeds limit')
    })

    it('should reject invalid file types', () => {
      const invalidFile = createMockFile('test.exe', 'application/x-msdownload', 1024)
      
      const result = service.validateFileForBucket(invalidFile, 'documents')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('not allowed')
    })
  })

  describe('getFileCategory', () => {
    it('should categorize files correctly', () => {
      expect(service.getFileCategory('application/pdf')).toBe('documents')
      expect(service.getFileCategory('image/jpeg')).toBe('images')
      expect(service.getFileCategory('video/mp4')).toBe('videos')
      expect(service.getFileCategory('application/unknown')).toBe('other')
    })
  })

  describe('formatFileSize', () => {
    it('should format file sizes correctly', () => {
      expect(service.formatFileSize(0)).toBe('0 Bytes')
      expect(service.formatFileSize(1024)).toBe('1 KB')
      expect(service.formatFileSize(1024 * 1024)).toBe('1 MB')
      expect(service.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB')
    })
  })
})

// Add the validateFileForBucket method to the FileUploadService class
declare module './file-upload' {
  interface FileUploadService {
    validateFileForBucket(file: File, bucket: string): { valid: boolean; error?: string }
  }
}