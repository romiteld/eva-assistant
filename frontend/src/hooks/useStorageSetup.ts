import { useState, useEffect, useCallback } from 'react'
import { StorageSetupService, StorageSetupResult, StorageStatus } from '@/lib/services/storage-setup'
import { useAuth } from '@/lib/auth/auth-service'

export function useStorageSetup() {
  const { user } = useAuth()
  const [setupService] = useState(() => new StorageSetupService())
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null)
  const [isConfigured, setIsConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check storage configuration status
  const checkStorageStatus = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const status = await setupService.getStorageStatus()
      setStorageStatus(status)

      const configured = await setupService.isStorageConfigured()
      setIsConfigured(configured)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check storage status')
    } finally {
      setLoading(false)
    }
  }, [user, setupService])

  // Initialize storage buckets
  const initializeStorage = useCallback(async (buckets?: string[]): Promise<StorageSetupResult> => {
    if (!user) {
      throw new Error('User not authenticated')
    }

    try {
      setLoading(true)
      setError(null)

      const result = await setupService.setupStorageBuckets(buckets)
      
      if (result.success) {
        // Refresh status after successful setup
        await checkStorageStatus()
      }

      return result
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to initialize storage'
      setError(error)
      throw new Error(error)
    } finally {
      setLoading(false)
    }
  }, [user, setupService, checkStorageStatus])

  // Ensure storage is configured
  const ensureStorageConfigured = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      await setupService.ensureStorageConfigured()
      await checkStorageStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ensure storage configuration')
      throw err
    } finally {
      setLoading(false)
    }
  }, [user, setupService, checkStorageStatus])

  // Cleanup temporary files
  const cleanupTempFiles = useCallback(async (): Promise<StorageSetupResult> => {
    if (!user) {
      throw new Error('User not authenticated')
    }

    try {
      setLoading(true)
      setError(null)

      const result = await setupService.cleanupTempFiles()
      return result
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to cleanup temp files'
      setError(error)
      throw new Error(error)
    } finally {
      setLoading(false)
    }
  }, [user, setupService])

  // Validate file for bucket
  const validateFileForBucket = useCallback((file: File, bucket: string) => {
    return setupService.validateFileForBucket(file, bucket)
  }, [setupService])

  // Get bucket configuration
  const getBucketConfig = useCallback((bucket: string) => {
    return setupService.getBucketConfig(bucket)
  }, [setupService])

  // Get missing buckets
  const getMissingBuckets = useCallback(() => {
    if (!storageStatus?.buckets) return []
    
    const requiredBuckets = ['documents', 'resumes', 'avatars', 'temp-uploads', 'ai-generated']
    const existingBuckets = storageStatus.buckets.filter(b => b.exists).map(b => b.bucket)
    
    return requiredBuckets.filter(bucket => !existingBuckets.includes(bucket))
  }, [storageStatus])

  // Get storage statistics
  const getStorageStats = useCallback(() => {
    if (!storageStatus?.buckets) return null

    const total = storageStatus.buckets.length
    const existing = storageStatus.buckets.filter(b => b.exists).length
    const missing = total - existing

    return {
      total,
      existing,
      missing,
      configured: missing === 0,
      buckets: storageStatus.buckets
    }
  }, [storageStatus])

  // Load storage status on mount
  useEffect(() => {
    checkStorageStatus()
  }, [checkStorageStatus])

  // Auto-configure storage if needed
  useEffect(() => {
    if (user && !loading && !isConfigured && !error) {
      ensureStorageConfigured().catch(console.error)
    }
  }, [user, loading, isConfigured, error, ensureStorageConfigured])

  return {
    // State
    storageStatus,
    isConfigured,
    loading,
    error,

    // Actions
    checkStorageStatus,
    initializeStorage,
    ensureStorageConfigured,
    cleanupTempFiles,

    // Utilities
    validateFileForBucket,
    getBucketConfig,
    getMissingBuckets,
    getStorageStats,
    
    // Computed
    stats: getStorageStats(),
    missingBuckets: getMissingBuckets()
  }
}