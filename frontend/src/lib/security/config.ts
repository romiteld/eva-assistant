// Security Configuration
export const securityConfig = {
  // Rate limiting configurations
  rateLimits: {
    global: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
    },
    api: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 20,
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
    },
    upload: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 20,
    },
  },

  // File upload restrictions
  fileUpload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ],
    allowedExtensions: [
      '.jpg', '.jpeg', '.png', '.gif', '.webp',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx',
      '.txt', '.csv',
    ],
  },

  // Security headers
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  },

  // Content Security Policy
  csp: {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      'https://apis.google.com',
      'https://www.gstatic.com',
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:', 'blob:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': [
      "'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://generativelanguage.googleapis.com',
      'https://api.firecrawl.dev',
    ],
    'frame-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'upgrade-insecure-requests': [],
  },

  // Session configuration
  session: {
    cookieName: 'eva-session',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
  },

  // CSRF configuration
  csrf: {
    cookieName: 'csrf-token',
    headerName: 'x-csrf-token',
    tokenLength: 32,
  },

  // Password requirements (if using password auth)
  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  },

  // API key requirements
  apiKey: {
    minLength: 32,
    expirationDays: 90,
  },

  // Allowed redirect paths (prevent open redirects)
  allowedRedirectPaths: [
    '/dashboard',
    '/profile',
    '/settings',
    '/login',
    '/',
  ],

  // Suspicious activity thresholds
  suspiciousActivity: {
    maxFailedLogins: 5,
    lockoutDurationMinutes: 30,
    maxPasswordResets: 3,
    passwordResetWindowHours: 24,
  },

  // Data sanitization rules
  sanitization: {
    maxInputLength: 10000,
    allowedHtmlTags: [], // No HTML allowed by default
    stripScripts: true,
    encodeSpecialChars: true,
  },
};

// Helper functions
export function isValidRedirectPath(path: string): boolean {
  return securityConfig.allowedRedirectPaths.includes(path);
}

export function isAllowedFileType(mimeType: string): boolean {
  return securityConfig.fileUpload.allowedMimeTypes.includes(mimeType);
}

export function isAllowedFileExtension(filename: string): boolean {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  return ext ? securityConfig.fileUpload.allowedExtensions.includes(ext) : false;
}

export function generateCSPHeader(): string {
  return Object.entries(securityConfig.csp)
    .map(([key, values]) => {
      if (Array.isArray(values) && values.length > 0) {
        return `${key} ${values.join(' ')}`;
      }
      return key;
    })
    .join('; ');
}

export function sanitizeInput(input: string): string {
  // Basic sanitization
  let sanitized = input.trim();
  
  // Limit length
  if (sanitized.length > securityConfig.sanitization.maxInputLength) {
    sanitized = sanitized.substring(0, securityConfig.sanitization.maxInputLength);
  }
  
  // Remove potential script tags
  if (securityConfig.sanitization.stripScripts) {
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }
  
  // Encode special characters
  if (securityConfig.sanitization.encodeSpecialChars) {
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  
  return sanitized;
}

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const config = securityConfig.password;
  
  if (password.length < config.minLength) {
    errors.push(`Password must be at least ${config.minLength} characters long`);
  }
  
  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (config.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (config.requireSpecialChars) {
    const specialCharsRegex = new RegExp(`[${config.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`);
    if (!specialCharsRegex.test(password)) {
      errors.push('Password must contain at least one special character');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}