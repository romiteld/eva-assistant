# EVA Authentication Flow Test Checklist

## Overview
This document provides a comprehensive checklist for testing the EVA authentication system end-to-end. The authentication uses Supabase's magic link (passwordless) authentication with enhanced security features including CSRF protection, session management, and secure cookie handling.

## Pre-Test Setup

### Environment Requirements
- [ ] Ensure `.env.local` contains valid Supabase credentials
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Verify email configuration in Supabase dashboard
- [ ] Confirm redirect URLs are configured in Supabase Auth settings
- [ ] Check that development server is running on expected port

### Browser Requirements
- [ ] Use a modern browser with developer tools
- [ ] Enable JavaScript console for debugging
- [ ] Clear cookies and cache before testing
- [ ] Open Network tab to monitor requests

## Test Scenarios

### 1. Pre-Authentication State Verification

#### Test Steps:
1. Navigate to root URL (`/`)
2. Check middleware redirect behavior
3. Verify unauthenticated state

#### Expected Results:
- [ ] Automatically redirected to `/login`
- [ ] No session cookies present
- [ ] CSRF token cookie is created
- [ ] Security headers are applied (check Network tab)

#### Verification Commands:
```javascript
// In browser console
document.cookie
// Should show csrf-token but no auth cookies
```

### 2. Magic Link Request

#### Test Steps:
1. Enter valid email address
2. Click "Send Magic Link"
3. Monitor network requests

#### Expected Results:
- [ ] Loading state shown during request
- [ ] Success message displayed
- [ ] Email sent confirmation shown
- [ ] State parameter stored in cookie
- [ ] No console errors

#### Common Issues to Check:
- [ ] Email validation works correctly
- [ ] Rate limiting not triggered (100 requests/minute)
- [ ] CORS headers properly configured

### 3. Email Callback Handling

#### Test Steps:
1. Check email for magic link
2. Click the magic link
3. Observe callback processing

#### Expected Results:
- [ ] Link contains proper callback URL with code and state
- [ ] `/auth/callback` route processes the request
- [ ] State validation passes (CSRF check)
- [ ] Session created successfully
- [ ] Temporary redirect page shown
- [ ] Automatic redirect to dashboard

#### Verification Points:
- [ ] Check for auth cookies after callback
- [ ] Verify session token is present
- [ ] Confirm user data is accessible

### 4. Post-Authentication Redirect

#### Test Steps:
1. Observe redirect after callback
2. Verify landing page

#### Expected Results:
- [ ] Redirected to `/dashboard`
- [ ] Dashboard loads without errors
- [ ] User information displayed
- [ ] No redirect loops

### 5. Session Persistence

#### Test Steps:
1. Refresh the page (F5)
2. Close and reopen browser tab
3. Navigate between protected routes

#### Expected Results:
- [ ] Session remains active after refresh
- [ ] No need to re-authenticate
- [ ] Cookies persist properly
- [ ] Middleware recognizes session

#### Verification Commands:
```javascript
// Check session in console
const supabase = createClient()
const { data: { session } } = await supabase.auth.getSession()
console.log(session)
```

### 6. Protected Route Access

#### Test Steps:
1. Try accessing `/dashboard` while authenticated
2. Try accessing `/api/*` endpoints
3. Test navigation between protected pages

#### Expected Results:
- [ ] All protected routes accessible
- [ ] API endpoints return data (not 401)
- [ ] No unexpected redirects
- [ ] Proper error handling for failed requests

### 7. Logout Functionality

#### Test Steps:
1. Click logout button
2. Observe session cleanup

#### Expected Results:
- [ ] Session cleared from Supabase
- [ ] Auth cookies removed
- [ ] Redirected to login page
- [ ] Cannot access protected routes
- [ ] API endpoints return 401

#### Verification:
- [ ] All auth-related cookies cleared
- [ ] Local storage cleaned up
- [ ] No session data remains

## Security Checks

### CSRF Protection
- [ ] State parameter generated for each auth attempt
- [ ] State validated in callback
- [ ] CSRF token present in cookies
- [ ] Token rotated after authentication

### Cookie Security
- [ ] HttpOnly flag set on auth cookies
- [ ] Secure flag set in production
- [ ] SameSite=lax for auth compatibility
- [ ] Proper expiration times

### Headers Security
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] X-XSS-Protection enabled
- [ ] CSP headers properly configured
- [ ] HSTS enabled

## Error Scenarios

### 1. Invalid Magic Link
- [ ] Use expired link
- [ ] Modify code parameter
- [ ] Expected: Error message shown

### 2. Network Failures
- [ ] Disconnect network during auth
- [ ] Expected: Proper error handling

### 3. Rate Limiting
- [ ] Exceed 100 requests/minute
- [ ] Expected: 429 error response

### 4. Cookie Disabled
- [ ] Disable cookies in browser
- [ ] Expected: Clear error message

## Performance Checks

- [ ] Login page loads < 2 seconds
- [ ] Magic link request < 3 seconds
- [ ] Callback processing < 2 seconds
- [ ] Dashboard initial load < 3 seconds

## Debugging Tools

### Console Commands
```javascript
// Check current session
const checkSession = async () => {
  const supabase = createClient()
  const { data: { session }, error } = await supabase.auth.getSession()
  console.log('Session:', session)
  console.log('Error:', error)
}

// Check cookies
console.log('All cookies:', document.cookie)

// Check auth state
const checkAuthState = async () => {
  const response = await fetch('/api/auth-status')
  const data = await response.json()
  console.log('Auth Status:', data)
}
```

### Useful API Endpoints
- `/api/auth-status` - Check authentication status
- `/api/debug-auth` - Detailed auth debugging info
- `/api/verify-session` - Verify session validity

## Common Issues and Solutions

### Issue: Redirect Loop
- **Cause**: Session not properly set in cookies
- **Solution**: Check cookie settings, ensure SameSite=lax

### Issue: Session Lost on Refresh
- **Cause**: Cookies not persisting
- **Solution**: Verify cookie domain and path settings

### Issue: 401 on API Calls
- **Cause**: Session not included in requests
- **Solution**: Ensure credentials included in fetch

### Issue: CORS Errors
- **Cause**: Incorrect origin configuration
- **Solution**: Update Supabase allowed URLs

## Test Automation Helper

Use the `/test-auth-flow` page for automated testing with visual feedback and step-by-step validation.

## Reporting

After completing tests:
1. Document any failures with screenshots
2. Note console errors
3. Record network request/response details
4. Submit findings with reproduction steps