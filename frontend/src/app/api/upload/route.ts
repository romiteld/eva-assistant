import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AuthenticatedRequest } from '@/middleware/auth';
import { withAuthAndRateLimit, API_SECURITY_TYPES } from '@/middleware/api-security';
import { validateFileUpload, sanitizePath } from '@/middleware/validation';
import crypto from 'crypto';
import { promisify } from 'util';
import { pipeline } from 'stream';
import fs from 'fs/promises';
import path from 'path';

const pipelineAsync = promisify(pipeline);

// Virus scanning stub (implement with actual service like ClamAV)
async function scanFileForViruses(filePath: string): Promise<boolean> {
  // TODO: Implement actual virus scanning
  // For now, check for suspicious patterns in file headers
  const buffer = await fs.readFile(filePath, { length: 512 });
  
  // Check for executable file signatures
  const executableSignatures = [
    Buffer.from([0x4D, 0x5A]), // MZ (DOS/Windows executable)
    Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF (Linux executable)
    Buffer.from([0xCF, 0xFA, 0xED, 0xFE]), // Mach-O (macOS executable)
  ];
  
  for (const signature of executableSignatures) {
    if (buffer.subarray(0, signature.length).equals(signature)) {
      return false; // Suspicious file
    }
  }
  
  return true; // File appears safe
}

async function handleSecureUpload(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Validate file
    const validation = validateFileUpload(file, {
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/csv',
      ],
      allowedExtensions: [
        '.jpg', '.jpeg', '.png', '.gif', '.webp',
        '.pdf', '.doc', '.docx', '.txt', '.csv'
      ],
    });
    
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }
    
    // Generate secure filename
    const fileExtension = path.extname(file.name);
    const safeFilename = `${crypto.randomUUID()}${fileExtension}`;
    const uploadPath = sanitizePath(`uploads/${request.user!.id}/${safeFilename}`);
    
    // Create temporary file for virus scanning
    const tempDir = '/tmp/eva-uploads';
    await fs.mkdir(tempDir, { recursive: true });
    const tempPath = path.join(tempDir, safeFilename);
    
    // Write file to temp location
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.writeFile(tempPath, buffer);
    
    // Scan for viruses
    const isSafe = await scanFileForViruses(tempPath);
    if (!isSafe) {
      await fs.unlink(tempPath); // Delete suspicious file
      return NextResponse.json(
        { error: 'File failed security scan' },
        { status: 400 }
      );
    }
    
    // Upload to Supabase Storage
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from('user-uploads')
      .upload(uploadPath, buffer, {
        contentType: file.type,
        upsert: false,
      });
    
    // Clean up temp file
    await fs.unlink(tempPath);
    
    if (error) {
      console.error('Upload error:', error);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }
    
    // Create database record
    const { data: fileRecord, error: dbError } = await supabase
      .from('uploaded_files')
      .insert({
        user_id: request.user!.id,
        filename: file.name,
        safe_filename: safeFilename,
        path: uploadPath,
        size: file.size,
        mime_type: file.type,
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (dbError) {
      // Try to delete the uploaded file
      await supabase.storage.from('user-uploads').remove([uploadPath]);
      
      return NextResponse.json(
        { error: 'Failed to save file record' },
        { status: 500 }
      );
    }
    
    // Get public URL (if needed)
    const { data: { publicUrl } } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(uploadPath);
    
    return NextResponse.json({
      success: true,
      file: {
        id: fileRecord.id,
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        url: publicUrl,
        uploadedAt: fileRecord.uploaded_at,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}

// Export with authentication and rate limiting
export const POST = withAuthAndRateLimit(handleSecureUpload, API_SECURITY_TYPES.API);