'use client'

import { useState } from 'react'
import { useStorageSetup } from '@/hooks/useStorageSetup'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  HardDrive,
  Settings,
  Trash2,
  Upload
} from 'lucide-react'

export function StorageSetupPanel() {
  const {
    storageStatus,
    isConfigured,
    loading,
    error,
    stats,
    missingBuckets,
    checkStorageStatus,
    initializeStorage,
    cleanupTempFiles
  } = useStorageSetup()

  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<string | null>(null)

  const handleInitializeStorage = async () => {
    try {
      setActionLoading('initialize')
      setActionResult(null)
      
      const result = await initializeStorage()
      
      if (result.success) {
        setActionResult(`Successfully initialized ${result.buckets?.length || 0} buckets`)
      } else {
        setActionResult(`Setup failed: ${result.error}`)
      }
    } catch (err) {
      setActionResult(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCleanupTempFiles = async () => {
    try {
      setActionLoading('cleanup')
      setActionResult(null)
      
      const result = await cleanupTempFiles()
      
      if (result.success) {
        setActionResult(result.message || 'Cleanup completed')
      } else {
        setActionResult(`Cleanup failed: ${result.error}`)
      }
    } catch (err) {
      setActionResult(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRefresh = async () => {
    try {
      setActionLoading('refresh')
      setActionResult(null)
      await checkStorageStatus()
      setActionResult('Storage status refreshed')
    } catch (err) {
      setActionResult(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setActionLoading(null)
    }
  }

  const getBucketIcon = (bucket: string) => {
    switch (bucket) {
      case 'documents':
        return '📄'
      case 'resumes':
        return '📝'
      case 'avatars':
        return '👤'
      case 'temp-uploads':
        return '⏱️'
      case 'ai-generated':
        return '🤖'
      default:
        return '📁'
    }
  }

  const getBucketDescription = (bucket: string) => {
    switch (bucket) {
      case 'documents':
        return 'Business documents, PDFs, Office files'
      case 'resumes':
        return 'Candidate resumes and portfolios'
      case 'avatars':
        return 'User profile pictures and avatars'
      case 'temp-uploads':
        return 'Temporary uploads (auto-cleanup after 24h)'
      case 'ai-generated':
        return 'AI-generated content and assets'
      default:
        return 'File storage bucket'
    }
  }

  if (loading && !storageStatus) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage Setup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading storage status...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Storage Setup
          {isConfigured && <Badge variant="success">Configured</Badge>}
          {!isConfigured && <Badge variant="destructive">Not Configured</Badge>}
        </CardTitle>
        <CardDescription>
          Manage Supabase storage buckets and file system configuration
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Action Result */}
        {actionResult && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{actionResult}</AlertDescription>
          </Alert>
        )}

        {/* Storage Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Buckets</span>
                  <span className="text-2xl font-bold">{stats.total}</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Configured</span>
                  <span className="text-2xl font-bold text-green-600">{stats.existing}</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Missing</span>
                  <span className="text-2xl font-bold text-red-600">{stats.missing}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Configuration Progress */}
        {stats && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Configuration Progress</span>
              <span>{stats.existing}/{stats.total} buckets</span>
            </div>
            <Progress value={(stats.existing / stats.total) * 100} className="h-2" />
          </div>
        )}

        {/* Bucket Status */}
        {storageStatus?.buckets && (
          <div className="space-y-3">
            <h3 className="font-medium">Bucket Status</h3>
            <div className="grid gap-2">
              {storageStatus.buckets.map((bucket) => (
                <div key={bucket.bucket} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{getBucketIcon(bucket.bucket)}</span>
                    <div>
                      <div className="font-medium">{bucket.bucket}</div>
                      <div className="text-sm text-muted-foreground">
                        {getBucketDescription(bucket.bucket)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {bucket.exists ? (
                      <Badge variant="success" className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Configured
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        Missing
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missing Buckets Warning */}
        {missingBuckets.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Missing buckets: {missingBuckets.join(', ')}. 
              These buckets need to be created for full functionality.
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleInitializeStorage}
            disabled={actionLoading === 'initialize'}
            className="flex items-center gap-2"
          >
            {actionLoading === 'initialize' ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Settings className="h-4 w-4" />
            )}
            {isConfigured ? 'Reconfigure Storage' : 'Initialize Storage'}
          </Button>

          <Button
            onClick={handleCleanupTempFiles}
            disabled={actionLoading === 'cleanup'}
            variant="outline"
            className="flex items-center gap-2"
          >
            {actionLoading === 'cleanup' ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Cleanup Temp Files
          </Button>

          <Button
            onClick={handleRefresh}
            disabled={actionLoading === 'refresh'}
            variant="outline"
            className="flex items-center gap-2"
          >
            {actionLoading === 'refresh' ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh Status
          </Button>
        </div>

        {/* Storage Configuration Info */}
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Upload className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="space-y-1">
                <div className="font-medium">File Upload Capabilities</div>
                <div className="text-sm text-muted-foreground">
                  Once configured, you can upload files to different buckets with appropriate size limits:
                </div>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li>• <strong>Documents:</strong> 25MB limit - PDFs, Word docs, Excel files</li>
                  <li>• <strong>Resumes:</strong> 10MB limit - PDF and Word documents</li>
                  <li>• <strong>Avatars:</strong> 5MB limit - Images with auto-resize</li>
                  <li>• <strong>Temp Uploads:</strong> 50MB limit - Any file type</li>
                  <li>• <strong>AI Generated:</strong> 10MB limit - AI-created content</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  )
}