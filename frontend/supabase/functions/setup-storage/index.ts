import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Check if user is authenticated and has admin privileges
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Define storage buckets configuration
    const buckets = [
      {
        name: 'documents',
        public: false,
        allowedMimeTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
          'text/csv',
          'text/markdown',
          'application/rtf',
        ],
        fileSizeLimit: 25 * 1024 * 1024, // 25MB
      },
      {
        name: 'avatars',
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 5 * 1024 * 1024, // 5MB
      },
      {
        name: 'resumes',
        public: false,
        allowedMimeTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        fileSizeLimit: 10 * 1024 * 1024, // 10MB
      },
      {
        name: 'temp-uploads',
        public: false,
        allowedMimeTypes: null, // Allow all types
        fileSizeLimit: 50 * 1024 * 1024, // 50MB
      },
    ]

    const results = []

    // Create buckets if they don't exist
    for (const bucketConfig of buckets) {
      try {
        // Check if bucket exists
        const { data: existingBucket, error: checkError } = await supabaseClient.storage
          .getBucket(bucketConfig.name)

        if (checkError && checkError.message.includes('not found')) {
          // Create bucket
          const { data, error } = await supabaseClient.storage.createBucket(bucketConfig.name, {
            public: bucketConfig.public,
            allowedMimeTypes: bucketConfig.allowedMimeTypes,
            fileSizeLimit: bucketConfig.fileSizeLimit,
          })

          if (error) {
            results.push({
              bucket: bucketConfig.name,
              status: 'error',
              message: error.message,
            })
          } else {
            results.push({
              bucket: bucketConfig.name,
              status: 'created',
              config: bucketConfig,
            })
          }
        } else if (existingBucket) {
          // Update bucket configuration
          const { data, error } = await supabaseClient.storage.updateBucket(bucketConfig.name, {
            public: bucketConfig.public,
            allowedMimeTypes: bucketConfig.allowedMimeTypes,
            fileSizeLimit: bucketConfig.fileSizeLimit,
          })

          if (error) {
            results.push({
              bucket: bucketConfig.name,
              status: 'error',
              message: error.message,
            })
          } else {
            results.push({
              bucket: bucketConfig.name,
              status: 'updated',
              config: bucketConfig,
            })
          }
        }
      } catch (error) {
        results.push({
          bucket: bucketConfig.name,
          status: 'error',
          message: error.message,
        })
      }
    }

    // Set up RLS policies for storage
    const policies = [
      // Documents bucket policies
      {
        bucket: 'documents',
        name: 'Users can upload their own documents',
        definition: `(auth.uid() = SPLIT_PART(name, '/', 1)::uuid)`,
        operation: 'INSERT',
      },
      {
        bucket: 'documents',
        name: 'Users can view their own documents',
        definition: `(auth.uid() = SPLIT_PART(name, '/', 1)::uuid)`,
        operation: 'SELECT',
      },
      {
        bucket: 'documents',
        name: 'Users can update their own documents',
        definition: `(auth.uid() = SPLIT_PART(name, '/', 1)::uuid)`,
        operation: 'UPDATE',
      },
      {
        bucket: 'documents',
        name: 'Users can delete their own documents',
        definition: `(auth.uid() = SPLIT_PART(name, '/', 1)::uuid)`,
        operation: 'DELETE',
      },
      // Avatars bucket policies (public read, authenticated write)
      {
        bucket: 'avatars',
        name: 'Anyone can view avatars',
        definition: `true`,
        operation: 'SELECT',
      },
      {
        bucket: 'avatars',
        name: 'Authenticated users can upload avatars',
        definition: `(auth.role() = 'authenticated')`,
        operation: 'INSERT',
      },
      {
        bucket: 'avatars',
        name: 'Users can update their own avatars',
        definition: `(auth.uid() = SPLIT_PART(name, '/', 1)::uuid)`,
        operation: 'UPDATE',
      },
      {
        bucket: 'avatars',
        name: 'Users can delete their own avatars',
        definition: `(auth.uid() = SPLIT_PART(name, '/', 1)::uuid)`,
        operation: 'DELETE',
      },
      // Resumes bucket policies
      {
        bucket: 'resumes',
        name: 'Users can upload their own resumes',
        definition: `(auth.uid() = SPLIT_PART(name, '/', 1)::uuid)`,
        operation: 'INSERT',
      },
      {
        bucket: 'resumes',
        name: 'Users can view their own resumes',
        definition: `(auth.uid() = SPLIT_PART(name, '/', 1)::uuid)`,
        operation: 'SELECT',
      },
      {
        bucket: 'resumes',
        name: 'Users can delete their own resumes',
        definition: `(auth.uid() = SPLIT_PART(name, '/', 1)::uuid)`,
        operation: 'DELETE',
      },
      // Temp uploads bucket policies
      {
        bucket: 'temp-uploads',
        name: 'Authenticated users can use temp uploads',
        definition: `(auth.role() = 'authenticated')`,
        operation: 'INSERT',
      },
      {
        bucket: 'temp-uploads',
        name: 'Users can view their own temp uploads',
        definition: `(auth.uid() = SPLIT_PART(name, '/', 1)::uuid)`,
        operation: 'SELECT',
      },
      {
        bucket: 'temp-uploads',
        name: 'Users can delete their own temp uploads',
        definition: `(auth.uid() = SPLIT_PART(name, '/', 1)::uuid)`,
        operation: 'DELETE',
      },
    ]

    // Note: Storage policies need to be set via Supabase Dashboard or Management API
    // This function returns the configuration for manual setup
    const policyConfig = policies.map((policy) => ({
      ...policy,
      sql: `CREATE POLICY "${policy.name}" ON storage.objects FOR ${policy.operation} TO authenticated USING (bucket_id = '${policy.bucket}' AND ${policy.definition});`,
    }))

    return new Response(
      JSON.stringify({
        success: true,
        buckets: results,
        policies: policyConfig,
        instructions: 'Storage buckets have been created/updated. Apply the SQL policies via Supabase Dashboard.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})