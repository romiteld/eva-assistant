# EVA Authentication Test Instructions

## Quick Start

1. **Access the Test Page**
   Navigate to: `http://localhost:3000/test-auth-flow`

2. **Review Automated Tests**
   The page automatically runs system health checks on load:
   - Browser cookie support
   - CSRF token validation
   - Current session state
   - API connectivity
   - Database connection
   - Auth flow configuration

3. **Run Authentication Test**
   - Enter a test email address
   - Click "Start Auth Test"
   - Check your email for the magic link
   - Click the link to complete authentication
   - Return to the test page to verify success

## Manual Testing Steps

### Step 1: Pre-Authentication Testing

1. **Clear Browser State**
   ```javascript
   // Run in browser console
   document.cookie.split(";").forEach(c => {
     document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
   });
   localStorage.clear();
   sessionStorage.clear();
   ```

2. **Navigate to Protected Route**
   - Go to `/dashboard`
   - Verify redirect to `/login`
   - Check console for middleware logs

3. **Inspect Initial State**
   - Open Developer Tools > Application > Cookies
   - Verify only `csrf-token` cookie exists
   - No auth-related cookies should be present

### Step 2: Authentication Flow

1. **Initiate Login**
   - Go to `/login`
   - Enter email address
   - Click "Send Magic Link"
   - Watch Network tab for `/auth/otp` request

2. **Email Verification**
   - Check email inbox
   - Verify link format: `/auth/callback?code=xxx&state=xxx`
   - Note the state parameter matches cookie

3. **Complete Authentication**
   - Click magic link
   - Observe callback processing
   - Verify redirect to dashboard

### Step 3: Post-Authentication Verification

1. **Check Session**
   ```javascript
   // Run in test page console
   import { createClient } from '@/lib/supabase/browser'
   const supabase = createClient()
   const { data: { session } } = await supabase.auth.getSession()
   console.log('Session:', session)
   ```

2. **Verify Cookies**
   - Check for auth cookies in Application tab
   - Verify HttpOnly and Secure flags
   - Confirm SameSite=lax setting

3. **Test Protected Routes**
   - Navigate to `/dashboard`
   - Try API endpoints: `/api/auth-status`
   - Verify no 401 errors

### Step 4: Session Persistence

1. **Page Refresh Test**
   - Press F5 on dashboard
   - Verify still authenticated
   - Check session remains valid

2. **New Tab Test**
   - Open dashboard in new tab
   - Verify authenticated without re-login
   - Session should be shared

3. **Browser Restart Test**
   - Close all browser tabs
   - Reopen and navigate to dashboard
   - Should remain authenticated

### Step 5: Logout Testing

1. **Perform Logout**
   - Click logout button
   - Verify redirect to login
   - Check all cookies cleared

2. **Verify Cleanup**
   ```javascript
   // Check no session remains
   document.cookie // Should not contain auth cookies
   ```

## Common Test Scenarios

### Scenario 1: Expired Magic Link
1. Request magic link
2. Wait 1+ hours
3. Try to use link
4. Should see error message

### Scenario 2: Invalid State (CSRF)
1. Request magic link
2. Clear cookies before clicking
3. Click link
4. Should see state mismatch error

### Scenario 3: Network Interruption
1. Start auth flow
2. Disconnect network
3. Try to proceed
4. Should see appropriate error

### Scenario 4: Multiple Tabs
1. Log in on tab 1
2. Open tab 2, go to login
3. Should redirect to dashboard
4. Log out on tab 1
5. Tab 2 should require login on next action

## API Testing

### Test Authenticated Endpoints
```bash
# Get session status
curl http://localhost:3000/api/auth-status \
  -H "Cookie: <copy-cookies-from-browser>"

# Test protected endpoint
curl http://localhost:3000/api/verify-session \
  -H "Cookie: <copy-cookies-from-browser>"
```

### Test Debug Endpoints
```bash
# Get detailed auth debug info
curl http://localhost:3000/api/debug-auth

# Check database health
curl http://localhost:3000/api/health/database
```

## Troubleshooting Guide

### Issue: "No session after callback"
1. Check browser console for errors
2. Verify cookies are enabled
3. Check Supabase logs for auth errors
4. Ensure redirect URL is configured in Supabase

### Issue: "State mismatch error"
1. Verify cookies aren't blocked
2. Check SameSite cookie settings
3. Ensure using same domain throughout flow

### Issue: "Cannot access dashboard"
1. Check middleware logs in console
2. Verify session exists with test page
3. Check for cookie issues
4. Try clearing all data and re-authenticating

### Issue: "Session lost on refresh"
1. Check cookie persistence settings
2. Verify server-side session handling
3. Check for middleware issues
4. Review Supabase session configuration

## Performance Benchmarks

Expected timings for optimal user experience:

- Login page load: < 2 seconds
- Magic link send: < 3 seconds  
- Email delivery: < 30 seconds
- Callback processing: < 2 seconds
- Dashboard load: < 3 seconds
- API requests: < 500ms

## Security Checklist

- [ ] CSRF token present and validated
- [ ] State parameter used in auth flow
- [ ] Cookies have proper security flags
- [ ] Session tokens not exposed in URLs
- [ ] Rate limiting active (100 req/min)
- [ ] Security headers properly set
- [ ] No sensitive data in localStorage

## Test Data

### Test Email Addresses
- `test@example.com` - Standard test
- `admin@example.com` - Admin role test
- `user+test@example.com` - Plus addressing test

### Test Scenarios Coverage
- [ ] Happy path authentication
- [ ] Error handling
- [ ] Edge cases
- [ ] Security scenarios
- [ ] Performance under load

## Automated Test Commands

Run these in the browser console on the test page:

```javascript
// Full auth cycle test
async function runFullAuthTest() {
  console.log('Starting full auth test...');
  
  // Check initial state
  const response = await fetch('/api/auth-status');
  const data = await response.json();
  console.log('Initial auth state:', data);
  
  // Test session persistence
  if (data.authenticated) {
    console.log('Already authenticated, testing session...');
    const verifyResponse = await fetch('/api/verify-session');
    const verifyData = await verifyResponse.json();
    console.log('Session verification:', verifyData);
  }
  
  console.log('Test complete!');
}

runFullAuthTest();
```

## Reporting Results

When reporting test results, include:

1. **Test Environment**
   - Browser and version
   - Operating system
   - Network conditions
   - Supabase project ID

2. **Test Results**
   - Screenshot of test page
   - Console logs
   - Network request/response
   - Specific error messages

3. **Reproduction Steps**
   - Exact steps taken
   - Data used
   - Timing information
   - Any deviations from expected

## Next Steps

After completing tests:

1. Review all test results
2. Document any failures
3. Create issues for bugs found
4. Verify fixes and retest
5. Update test cases as needed