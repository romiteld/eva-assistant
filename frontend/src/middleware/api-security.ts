import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from './auth';
import { withRateLimit, RATE_LIMIT_CONFIGS } from './rate-limit';

// Combine authentication and rate limiting
export function withAuthAndRateLimit(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>,
  rateLimitType: keyof typeof RATE_LIMIT_CONFIGS = 'api'
) {
  return withRateLimit(
    (request: NextRequest) => requireAuth(request, handler),
    rateLimitType
  );
}

// Export commonly used rate limit types
export const API_SECURITY_TYPES = {
  API: 'api' as const,
  AUTH: 'auth' as const,
  UPLOAD: 'upload' as const,
  WEBHOOK: 'webhook' as const,
  AI: 'ai' as const,
};