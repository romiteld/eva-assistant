import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { corsHeaders } from '../_shared/cors.ts'

// Storage bucket configurations
const STORAGE_BUCKETS = {
  'documents': {
    name: 'documents',
    public: false,
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'application/rtf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    fileSizeLimit: 25 * 1024 * 1024, // 25MB
    transformations: [],
  },
  'resumes': {
    name: 'resumes',
    public: false,
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ],
    fileSizeLimit: 10 * 1024 * 1024, // 10MB
    transformations: [],
  },
  'avatars': {
    name: 'avatars',
    public: true,
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ],
    fileSizeLimit: 5 * 1024 * 1024, // 5MB
    transformations: [
      {
        id: 'avatar-small',
        transformation: {
          width: 64,
          height: 64,
          resize: 'cover',
          format: 'webp',
        },
      },
      {
        id: 'avatar-medium',
        transformation: {
          width: 128,
          height: 128,
          resize: 'cover',
          format: 'webp',
        },
      },
      {
        id: 'avatar-large',
        transformation: {
          width: 256,
          height: 256,
          resize: 'cover',
          format: 'webp',
        },
      },
    ],
  },
  'temp-uploads': {
    name: 'temp-uploads',
    public: false,
    allowedMimeTypes: ['*'],
    fileSizeLimit: 50 * 1024 * 1024, // 50MB
    transformations: [],
  },
  'ai-generated': {
    name: 'ai-generated',
    public: false,
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/markdown',
    ],
    fileSizeLimit: 10 * 1024 * 1024, // 10MB
    transformations: [],
  },
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface SetupStorageRequest {
  action: 'setup' | 'status' | 'cleanup'
  buckets?: string[]
}

interface SetupStorageResponse {
  success: boolean
  message?: string
  buckets?: any[]
  error?: string
}

async function setupBuckets(bucketNames?: string[]): Promise<SetupStorageResponse> {
  const results = []
  const errors = []

  // Get buckets to create
  const bucketsToCreate = bucketNames 
    ? bucketNames.filter(name => STORAGE_BUCKETS[name])
    : Object.keys(STORAGE_BUCKETS)

  for (const bucketName of bucketsToCreate) {
    const config = STORAGE_BUCKETS[bucketName]
    
    try {
      // Check if bucket exists
      const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets()
      
      if (listError) {
        throw new Error(`Failed to list buckets: ${listError.message}`)
      }

      const bucketExists = existingBuckets?.some(b => b.name === bucketName)

      if (!bucketExists) {
        // Create bucket
        const { data: bucketData, error: createError } = await supabase.storage.createBucket(bucketName, {
          public: config.public,
          allowedMimeTypes: config.allowedMimeTypes,
          fileSizeLimit: config.fileSizeLimit,
        })

        if (createError) {
          throw new Error(`Failed to create bucket ${bucketName}: ${createError.message}`)
        }

        results.push({
          bucket: bucketName,
          status: 'created',
          config: config,
        })
      } else {
        // Update bucket configuration if needed
        const { data: bucketData, error: updateError } = await supabase.storage.updateBucket(bucketName, {
          public: config.public,
          allowedMimeTypes: config.allowedMimeTypes,
          fileSizeLimit: config.fileSizeLimit,
        })

        if (updateError) {
          console.warn(`Failed to update bucket ${bucketName}: ${updateError.message}`)
        }

        results.push({
          bucket: bucketName,
          status: 'exists',
          config: config,
        })
      }
    } catch (error) {
      errors.push({
        bucket: bucketName,
        error: error.message,
      })
    }
  }

  return {
    success: errors.length === 0,
    message: errors.length > 0 
      ? `Setup completed with ${errors.length} errors`
      : `Successfully set up ${results.length} buckets`,
    buckets: results,
    error: errors.length > 0 ? JSON.stringify(errors) : undefined,
  }
}

async function getBucketStatus(): Promise<SetupStorageResponse> {
  try {
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      throw new Error(`Failed to list buckets: ${listError.message}`)
    }

    const bucketStatus = Object.keys(STORAGE_BUCKETS).map(bucketName => {
      const exists = existingBuckets?.some(b => b.name === bucketName)
      const config = STORAGE_BUCKETS[bucketName]
      
      return {
        bucket: bucketName,
        exists,
        config,
      }
    })

    return {
      success: true,
      buckets: bucketStatus,
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    }
  }
}

async function cleanupTempFiles(): Promise<SetupStorageResponse> {
  try {
    // Get files older than 24 hours from temp-uploads bucket
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
    
    const { data: files, error: listError } = await supabase.storage
      .from('temp-uploads')
      .list()

    if (listError) {
      throw new Error(`Failed to list temp files: ${listError.message}`)
    }

    const filesToDelete = files?.filter(file => {
      const createdAt = new Date(file.created_at)
      return createdAt < cutoffTime
    }) || []

    if (filesToDelete.length === 0) {
      return {
        success: true,
        message: 'No temp files to cleanup',
      }
    }

    // Delete old files
    const filePaths = filesToDelete.map(file => file.name)
    const { data: deleteData, error: deleteError } = await supabase.storage
      .from('temp-uploads')
      .remove(filePaths)

    if (deleteError) {
      throw new Error(`Failed to delete temp files: ${deleteError.message}`)
    }

    // Also cleanup database records
    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('bucket', 'temp-uploads')
      .lt('created_at', cutoffTime.toISOString())

    if (dbError) {
      console.warn(`Failed to cleanup database records: ${dbError.message}`)
    }

    return {
      success: true,
      message: `Cleaned up ${filesToDelete.length} temp files`,
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    }
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, buckets } = await req.json() as SetupStorageRequest

    let response: SetupStorageResponse

    switch (action) {
      case 'setup':
        response = await setupBuckets(buckets)
        break
      
      case 'status':
        response = await getBucketStatus()
        break
      
      case 'cleanup':
        response = await cleanupTempFiles()
        break
      
      default:
        response = {
          success: false,
          error: `Unknown action: ${action}`,
        }
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Setup Storage Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})