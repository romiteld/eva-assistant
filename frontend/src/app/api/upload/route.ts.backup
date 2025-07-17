import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateRandomToken } from '@/lib/crypto-utils';

// File upload configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
};

// Rate limiting for file uploads
const uploadRateLimitMap = new Map<string, { count: number; lastReset: number }>();
const UPLOAD_RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const UPLOAD_RATE_LIMIT_MAX_REQUESTS = 20;

// CSRF token validation
function validateCSRFToken(request: NextRequest): boolean {
  const token = request.headers.get('x-csrf-token');
  const cookieToken = request.cookies.get('csrf-token')?.value;
  return token === cookieToken && !!token;
}

// Rate limiting middleware for uploads
function checkUploadRateLimit(identifier: string): boolean {
  const now = Date.now();
  const userLimit = uploadRateLimitMap.get(identifier);

  if (!userLimit || now - userLimit.lastReset > UPLOAD_RATE_LIMIT_WINDOW) {
    uploadRateLimitMap.set(identifier, { count: 1, lastReset: now });
    return true;
  }

  if (userLimit.count >= UPLOAD_RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  userLimit.count++;
  return true;
}

// Validate file type and size
function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` };
  }

  // Check file type
  if (!ALLOWED_FILE_TYPES[file.type as keyof typeof ALLOWED_FILE_TYPES]) {
    return { valid: false, error: 'Invalid file type' };
  }

  // Check file extension
  const fileName = file.name.toLowerCase();
  const allowedExtensions = ALLOWED_FILE_TYPES[file.type as keyof typeof ALLOWED_FILE_TYPES];
  const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
  
  if (!hasValidExtension) {
    return { valid: false, error: 'File extension does not match file type' };
  }

  return { valid: true };
}

// Sanitize filename
function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts
  const name = filename.replace(/\.\./g, '').replace(/[\/\\]/g, '');
  // Keep only alphanumeric, dash, underscore, and dot
  return name.replace(/[^a-zA-Z0-9\-_.]/g, '_');
}

export async function POST(request: NextRequest) {
  try {
    // CSRF Protection
    if (!validateCSRFToken(request)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    // Authentication check
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimitKey = session.user.id;
    if (!checkUploadRateLimit(rateLimitKey)) {
      return NextResponse.json(
        { error: 'Upload rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const bucket = formData.get('bucket') as string || 'documents';
    const path = formData.get('path') as string || '';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Generate secure filename
    const fileExt = file.name.split('.').pop() || '';
    const sanitizedName = sanitizeFilename(file.name.split('.')[0]);
    const uniqueId = generateRandomToken(16);
    const fileName = `${sanitizedName}_${uniqueId}.${fileExt}`;
    const filePath = path ? `${path}/${fileName}` : fileName;

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Additional content validation for certain file types
    if (file.type.startsWith('image/')) {
      // Basic image validation - check for valid image headers
      const header = fileBuffer.slice(0, 4).toString('hex');
      const validImageHeaders = ['ffd8ff', '89504e47', '47494638', '52494646']; // JPEG, PNG, GIF, WEBP
      
      if (!validImageHeaders.some(h => header.startsWith(h))) {
        return NextResponse.json(
          { error: 'Invalid image file' },
          { status: 400 }
        );
      }
    }

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    // Save file metadata to database
    const { error: dbError } = await supabase.from('documents').insert({
      user_id: session.user.id,
      filename: file.name,
      file_path: filePath,
      file_type: file.type,
      file_size: file.size,
      processed: false,
      embeddings_generated: false,
      metadata: {
        original_name: file.name,
        upload_timestamp: new Date().toISOString(),
        bucket,
      },
    });

    if (dbError) {
      // If database insert fails, delete the uploaded file
      await supabase.storage.from(bucket).remove([filePath]);
      throw dbError;
    }

    // Log the upload for audit trail
    await supabase.from('api_logs').insert({
      user_id: session.user.id,
      action: 'file_upload',
      metadata: {
        filename: file.name,
        file_size: file.size,
        file_type: file.type,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        filePath,
        publicUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      },
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve upload configuration
export async function GET(request: NextRequest) {
  return NextResponse.json({
    maxFileSize: MAX_FILE_SIZE,
    allowedFileTypes: Object.keys(ALLOWED_FILE_TYPES),
    allowedExtensions: Object.values(ALLOWED_FILE_TYPES).flat(),
  });
}