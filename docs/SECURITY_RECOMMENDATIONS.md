# EVA Platform Security Recommendations

## Priority 1: Critical Security Fixes (Implement Immediately)

### 1. Authentication Enforcement

**Problem**: Multiple API endpoints lack authentication, exposing sensitive operations.

**Solution**:
```typescript
// Update all unprotected routes to use requireAuth middleware
import { requireAuth } from '@/middleware/auth';

// Example: Fix agent routes
export const GET = (request: NextRequest) => 
  requireAuth(request, handleGetAgents);

export const POST = (request: NextRequest) => 
  requireAuth(request, handleAssignAgent);
```

**Affected Routes**:
- `/api/agents/*` - All agent management endpoints
- `/api/deals/*` - Deal creation endpoints
- `/api/upload` - File upload endpoint
- `/api/zoho/queue` - Queue management

### 2. File Upload Security

**Problem**: File upload endpoint has no security measures.

**Solution**: Replace current upload route with the secure version created in `/api/upload/secure-route.ts` which includes:
- Authentication requirement
- File type validation
- Size limits
- Virus scanning
- Secure filename generation
- Supabase Storage integration

### 3. Input Validation

**Problem**: Many endpoints accept user input without validation.

**Solution**: Use Zod schemas for all endpoints:
```typescript
import { validateRequest, schemas } from '@/middleware/validation';

export async function POST(request: NextRequest) {
  const { data, error } = await validateRequest(request, schemas.dealCreation);
  if (error) return error;
  
  // Process validated data
}
```

## Priority 2: High Priority (Complete within 48 hours)

### 1. Rate Limiting Implementation

**Problem**: No rate limiting allows abuse and DDoS attacks.

**Solution**: Apply rate limiting middleware to all routes:
```typescript
import { withRateLimit } from '@/middleware/rate-limit';

// Wrap route handlers
export const POST = withRateLimit(handler, 'auth'); // For auth endpoints
export const GET = withRateLimit(handler, 'api'); // For API endpoints
```

### 2. Webhook Security

**Problem**: Webhook endpoints lack signature validation.

**Solution**:
```typescript
// Zoom webhook validation
const isValid = validateWebhookSignature(
  body,
  request.headers.get('x-zoom-signature')!,
  process.env.ZOOM_WEBHOOK_SECRET!
);

// Zoho webhook validation
const isValid = validateWebhookSignature(
  body,
  request.headers.get('x-zoho-signature')!,
  process.env.ZOHO_WEBHOOK_SECRET!
);
```

### 3. Error Message Sanitization

**Problem**: Stack traces and sensitive data exposed in errors.

**Solution**: Create standardized error handler:
```typescript
export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error); // Log full error server-side
  
  // Return sanitized error to client
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'Validation failed', details: error.errors },
      { status: 400 }
    );
  }
  
  // Generic error for production
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

## Priority 3: Medium Priority (Complete within 1 week)

### 1. Role-Based Access Control (RBAC)

**Implementation**:
```typescript
// Add to auth middleware
export async function requireRole(
  request: AuthenticatedRequest,
  roles: string[]
): Promise<NextResponse | null> {
  if (!roles.includes(request.user?.role || 'user')) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }
  return null;
}

// Usage in routes
export const POST = (request: NextRequest) =>
  requireAuth(request, async (req) => {
    const roleCheck = await requireRole(req, ['admin', 'recruiter']);
    if (roleCheck) return roleCheck;
    // Handle request
  });
```

### 2. Database Query Security

**Add Row Level Security (RLS) policies**:
```sql
-- Example: Users can only see their own data
CREATE POLICY "Users can view own data" ON uploaded_files
  FOR SELECT USING (auth.uid() = user_id);

-- Recruiters can see all candidate data
CREATE POLICY "Recruiters view all candidates" ON candidates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('recruiter', 'admin')
    )
  );
```

### 3. API Documentation & Versioning

**Create OpenAPI specification**:
```yaml
openapi: 3.0.0
info:
  title: EVA Platform API
  version: 1.0.0
  description: Recruitment platform API
servers:
  - url: https://api.eva.thewell.solutions/v1
paths:
  /agents/monitor:
    get:
      security:
        - bearerAuth: []
      responses:
        200:
          description: Agent monitoring data
```

## Implementation Checklist

### Immediate Actions (24 hours)
- [ ] Add authentication to all unprotected routes
- [ ] Replace file upload with secure version
- [ ] Enable CORS with proper configuration
- [ ] Add input validation to POST/PUT endpoints

### Short-term Actions (48-72 hours)
- [ ] Implement rate limiting on all endpoints
- [ ] Add webhook signature validation
- [ ] Sanitize all error messages
- [ ] Set up monitoring and alerting

### Medium-term Actions (1 week)
- [ ] Implement RBAC system
- [ ] Add RLS policies to all tables
- [ ] Create API documentation
- [ ] Set up security headers middleware

### Long-term Actions (2-4 weeks)
- [ ] Implement audit logging
- [ ] Add request/response encryption
- [ ] Set up WAF (Web Application Firewall)
- [ ] Conduct penetration testing

## Security Headers Configuration

Add to `next.config.js`:
```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
```

## Monitoring & Alerting

### Set up monitoring for:
1. Failed authentication attempts
2. Rate limit violations
3. 500 errors spike
4. Unusual traffic patterns
5. File upload attempts
6. Webhook validation failures

### Recommended Tools:
- Sentry for error tracking
- DataDog/New Relic for APM
- CloudFlare for DDoS protection
- LogRocket for session replay

## Security Testing

### Automated Testing:
```bash
# Add security tests to CI/CD
npm install --save-dev @security/eslint-plugin-security
npm install --save-dev npm-audit-resolver

# Run security audit
npm audit
npm run lint:security
```

### Manual Testing Checklist:
- [ ] Test authentication bypass attempts
- [ ] Test SQL injection on all inputs
- [ ] Test XSS on all text fields
- [ ] Test file upload with malicious files
- [ ] Test rate limiting effectiveness
- [ ] Test CORS policy enforcement

## Compliance Considerations

### GDPR Compliance:
1. Add data retention policies
2. Implement right to be forgotten
3. Add consent management
4. Create privacy policy endpoint

### SOC 2 Requirements:
1. Implement audit logging
2. Add encryption at rest
3. Set up access controls
4. Document security procedures

## Emergency Response Plan

### If Security Breach Detected:
1. **Immediate**: Disable affected endpoints
2. **5 minutes**: Alert security team
3. **15 minutes**: Begin incident response
4. **30 minutes**: Patch vulnerability
5. **1 hour**: Deploy fix and monitor
6. **24 hours**: Complete incident report

### Contact Information:
- Security Lead: [Add contact]
- DevOps Lead: [Add contact]
- CTO: [Add contact]
- External Security: [Add vendor]

---

**Document Version**: 1.0  
**Last Updated**: January 17, 2025  
**Next Review**: February 1, 2025  
**Owner**: Security Team