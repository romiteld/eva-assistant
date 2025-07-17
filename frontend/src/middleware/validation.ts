import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Common validation schemas
export const schemas = {
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
  uuid: z.string().uuid('Invalid UUID'),
  url: z.string().url('Invalid URL'),
  
  // File upload validation
  fileUpload: z.object({
    filename: z.string().max(255),
    mimetype: z.string(),
    size: z.number().max(10 * 1024 * 1024), // 10MB max
  }),
  
  // Deal creation
  dealCreation: z.object({
    dealName: z.string().min(1).max(255),
    contactEmail: z.string().email(),
    amount: z.number().optional(),
    stage: z.string().optional(),
  }),
  
  // Message/SMS
  smsMessage: z.object({
    to: z.string().regex(/^\+?[1-9]\d{1,14}$/),
    body: z.string().min(1).max(1600), // SMS limit
  }),
  
  // Meeting creation
  meetingCreation: z.object({
    topic: z.string().min(1).max(200),
    duration: z.number().min(15).max(480), // 15 min to 8 hours
    startTime: z.string().datetime().optional(),
    attendees: z.array(z.string().email()).optional(),
  }),
};

// Sanitize input to prevent XSS
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove script tags and dangerous HTML
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}

// Validate request body against schema
export async function validateRequest<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<{ data?: T; error?: NextResponse }> {
  try {
    const body = await request.json();
    const sanitized = sanitizeInput(body);
    const validated = schema.parse(sanitized);
    
    return { data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        error: NextResponse.json(
          {
            error: 'Validation failed',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 400 }
        ),
      };
    }
    
    return {
      error: NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      ),
    };
  }
}

// File upload validation
export function validateFileUpload(
  file: File | Blob,
  options: {
    maxSize?: number;
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}
): { valid: boolean; error?: string } {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'],
  } = options;
  
  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${maxSize / 1024 / 1024}MB`,
    };
  }
  
  // Check MIME type
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed`,
    };
  }
  
  // Check file extension if filename is available
  if ('name' in file && file.name) {
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (allowedExtensions.length > 0 && !allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `File extension ${extension} is not allowed`,
      };
    }
  }
  
  return { valid: true };
}

// SQL injection prevention
export function sanitizeSqlInput(input: string): string {
  // Basic SQL injection prevention
  return input
    .replace(/['";\\]/g, '') // Remove quotes and escape characters
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove multi-line comments
    .replace(/\*\//g, '')
    .replace(/\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b/gi, '');
}

// Path traversal prevention
export function sanitizePath(path: string): string {
  // Remove path traversal attempts
  return path
    .replace(/\.\./g, '') // Remove ..
    .replace(/[<>"|?*]/g, '') // Remove invalid characters
    .replace(/\/{2,}/g, '/') // Replace multiple slashes with single
    .replace(/^\//, ''); // Remove leading slash
}

// Webhook signature validation
export function validateWebhookSignature(
  body: string | Buffer,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha1' = 'sha256'
): boolean {
  const crypto = require('crypto');
  const hmac = crypto.createHmac(algorithm, secret);
  hmac.update(body);
  const expectedSignature = hmac.digest('hex');
  
  // Use timingSafeEqual to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Request size validation middleware
export function validateRequestSize(maxSize: number = 1024 * 1024) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const contentLength = request.headers.get('content-length');
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      return NextResponse.json(
        { error: 'Request body too large' },
        { status: 413 }
      );
    }
    
    return null;
  };
}