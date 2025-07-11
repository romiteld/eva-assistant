# Authentication Files Overview

## Core Authentication Files

### 1. Supabase Client Setup
- **`/frontend/src/lib/supabase/server.ts`** - Server-side Supabase client for Next.js App Router (uses SSR cookies)
- **`/frontend/src/lib/supabase/browser.ts`** - Browser-side Supabase client for client components (uses SSR cookies)
- **`/frontend/src/lib/supabase/client.ts`** - Legacy client using standard Supabase JS (should be migrated to use browser.ts)

### 2. Authentication Logic
- **`/frontend/src/lib/supabase/auth.ts`** - Main authentication helpers including:
  - `sendMagicLink()` - Sends magic link email
  - `signOut()` - Signs out user
  - `getCurrentUser()` - Gets current user with profile
  - `updateProfile()` - Updates user profile
  - `onAuthStateChange()` - Subscribes to auth state changes
  - `isAuthenticated()` - Checks if user is authenticated
  - `refreshSession()` - Refreshes the session

### 3. Authentication Routes
- **`/frontend/src/app/auth/callback/route.ts`** - Server-side route handler for magic link callback
  - Exchanges code for session
  - Logs security events
  - Manages session cookies
  - Redirects to dashboard on success

### 4. Authentication Pages
- **`/frontend/src/app/login/page.tsx`** - Main login page with magic link form
- **`/frontend/src/components/auth/LoginPage.tsx`** - Reusable login component

### 5. Authentication Middleware
- **`/frontend/src/middleware.ts`** - Next.js middleware that:
  - Protects routes requiring authentication
  - Redirects unauthenticated users to login
  - Redirects authenticated users from login to dashboard
  - Manages CSRF tokens
  - Implements rate limiting

### 6. Authentication Hooks
- **`/frontend/src/hooks/useAuth.ts`** - React hook for authentication state management

### 7. Testing & Debug Routes
- **`/frontend/src/app/api/test-auth/route.ts`** - Basic auth testing endpoint
- **`/frontend/src/app/api/auth-status/route.ts`** - Detailed auth status endpoint
- **`/frontend/src/app/api/test-session/route.ts`** - Comprehensive session testing
- **`/frontend/src/app/api/debug-auth/route.ts`** - Debug authentication issues
- **`/frontend/src/app/dashboard/debug/page.tsx`** - Debug page showing auth cookies and session

### 8. Auth-Related Components
- **`/frontend/src/components/error/AuthErrorBoundary.tsx`** - Error boundary for auth errors
- **`/frontend/src/components/SecureFileUpload.tsx`** - Secure file upload with auth

### 9. Database Migrations
- **`/supabase/migrations/002_security_updates.sql`** - Security-related database updates

## Authentication Flow

1. User enters email on login page (`/login`)
2. Magic link is sent via `authHelpers.sendMagicLink()`
3. User clicks magic link in email
4. Browser redirects to `/auth/callback?code=...`
5. Callback route handler exchanges code for session
6. Session cookies are set
7. User is redirected to `/dashboard`
8. Middleware protects routes based on session

## Known Issues & Solutions

### Issue: Magic link redirects to login instead of dashboard
**Cause**: The session might not be properly established after the callback.
**Solution**: 
1. Ensure using SSR-compatible Supabase clients (browser.ts/server.ts)
2. Check that cookies are being properly set in the callback
3. Verify middleware is not blocking the redirect
4. Use debug endpoints to verify session state

## Security Features

- CSRF protection with state parameter
- Rate limiting in middleware
- Security event logging
- Session management with expiry tracking
- Secure cookie settings (httpOnly, secure, sameSite)
- IP address and user agent tracking