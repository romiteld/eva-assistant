# Error Handling System Guide

This document describes the comprehensive error handling system implemented in the EVA Assistant application.

## Overview

The error handling system provides:
- Global error boundaries for graceful error recovery
- Centralized error logging and monitoring
- User-friendly error messages
- Recovery options and retry mechanisms
- Development and production mode support

## Components

### 1. Error Service (`/lib/error-service.ts`)

The core service for error management:

```typescript
import { errorService, ErrorCategory, ErrorSeverity } from '@/lib/error-service'

// Log an error
errorService.logError(error, ErrorCategory.API, ErrorSeverity.HIGH, {
  context: { userId: '123', action: 'fetchData' }
})

// Get recent errors
const errors = errorService.getRecentErrors(ErrorCategory.AUTH)
```

**Error Categories:**
- `AUTH` - Authentication/authorization errors
- `API` - API request failures
- `DATABASE` - Database connection/query errors
- `UI` - UI rendering errors
- `NETWORK` - Network connectivity issues
- `VALIDATION` - Input validation errors
- `UNKNOWN` - Uncategorized errors

**Error Severities:**
- `LOW` - Minor issues, informational
- `MEDIUM` - Standard errors requiring attention
- `HIGH` - Serious errors affecting functionality
- `CRITICAL` - System-breaking errors

### 2. Error Boundaries

#### Global Error Boundary (`/components/error/ErrorBoundary.tsx`)
Wraps the entire application in the root layout:

```tsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

#### Specialized Error Boundaries

**AuthErrorBoundary** - For authentication-related sections:
```tsx
<AuthErrorBoundary>
  <ProtectedContent />
</AuthErrorBoundary>
```

**DashboardErrorBoundary** - For dashboard components:
```tsx
<DashboardErrorBoundary section="Analytics">
  <AnalyticsWidget />
</DashboardErrorBoundary>
```

**ChatErrorBoundary** - For chat interfaces:
```tsx
<ChatErrorBoundary onReset={handleReset}>
  <ChatInterface />
</ChatErrorBoundary>
```

### 3. Error Hook (`/hooks/useErrorHandler.ts`)

Simplifies error handling in components:

```typescript
const { handleError, handleAsyncError } = useErrorHandler()

// Basic error handling
try {
  // risky operation
} catch (error) {
  handleError(error, {
    category: ErrorCategory.API,
    severity: ErrorSeverity.MEDIUM,
    showToast: true
  })
}

// Async error handling
const data = await handleAsyncError(
  async () => {
    const response = await fetch('/api/data')
    if (!response.ok) throw new Error('Failed to fetch')
    return response.json()
  },
  { fallbackMessage: 'Unable to load data' }
)
```

### 4. Error UI Components

#### ErrorNotification (`/components/error/ErrorNotification.tsx`)
Displays error notifications with actions:

```tsx
<ErrorNotification
  message="Connection lost"
  severity={ErrorSeverity.HIGH}
  onRetry={handleRetry}
  autoHide={true}
  actions={[
    { label: 'Reconnect', onClick: reconnect, variant: 'primary' }
  ]}
/>
```

#### ErrorRecovery (`/components/error/ErrorRecovery.tsx`)
Provides recovery steps for different error types:

```tsx
<ErrorRecovery
  errorCategory={ErrorCategory.NETWORK}
  onRecovered={handleRecovered}
  customSteps={[
    {
      id: 'custom-fix',
      title: 'Custom Fix',
      description: 'Try this custom solution',
      action: customFixAction,
      icon: ToolIcon
    }
  ]}
/>
```

### 5. Error Monitoring Dashboard

The `ErrorMonitoringDashboard` component provides real-time error monitoring:
- Error statistics by severity and category
- Recent error logs
- Filtering capabilities
- Error details and context

## Database Schema

Errors are persisted to the database for critical issues:

```sql
CREATE TABLE error_logs (
  id UUID PRIMARY KEY,
  message TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  context JSONB,
  stack TEXT,
  user_id UUID,
  session_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Best Practices

### 1. Always Use Error Categories
```typescript
// ✅ Good
handleError(error, { category: ErrorCategory.API })

// ❌ Bad
handleError(error)
```

### 2. Provide Context
```typescript
handleError(error, {
  context: {
    component: 'UserProfile',
    action: 'updateAvatar',
    userId: user.id
  }
})
```

### 3. Use Appropriate Severity Levels
- `CRITICAL` - System is unusable
- `HIGH` - Feature is broken
- `MEDIUM` - Degraded experience
- `LOW` - Minor issue

### 4. Wrap Critical Sections
```tsx
<DashboardErrorBoundary section="Payment Processing">
  <PaymentForm />
</DashboardErrorBoundary>
```

### 5. Provide Recovery Options
```typescript
handleError(error, {
  showToast: true,
  fallbackMessage: 'Payment failed. Please try again.',
  // Component can handle retry
})
```

## Environment Configuration

### Development Mode
- Full error details shown
- Stack traces visible
- Console logging enabled

### Production Mode
- User-friendly messages only
- Errors sent to monitoring service
- Critical errors persisted to database

### Environment Variables
```env
# Error monitoring endpoint (optional)
NEXT_PUBLIC_ERROR_MONITORING_ENDPOINT=https://your-monitoring-service.com/errors

# Supabase for error persistence
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Testing Error Handling

Use the `ErrorHandlingExample` component to test various error scenarios:

```tsx
import { ErrorHandlingExample } from '@/components/examples/ErrorHandlingExample'

// Add to a test page
<ErrorHandlingExample />
```

This provides buttons to trigger different error types and see how they're handled.

## Migration Guide

To add error handling to existing components:

1. **Wrap with Error Boundary:**
   ```tsx
   <DashboardErrorBoundary section="Your Section">
     <YourComponent />
   </DashboardErrorBoundary>
   ```

2. **Use Error Hook:**
   ```tsx
   const { handleError } = useErrorHandler()
   
   // In your catch blocks
   catch (error) {
     handleError(error, { category: ErrorCategory.API })
   }
   ```

3. **Add Recovery Options:**
   ```tsx
   const handleRetry = () => {
     // Retry logic
   }
   
   // Show retry button in error state
   ```

## Monitoring and Debugging

1. **Check Browser Console** - All errors logged in development
2. **Error Monitoring Dashboard** - Real-time error tracking
3. **Database Logs** - Query `error_logs` table for persistent errors
4. **Session Storage** - Check `eva_session_id` for session tracking

## Future Enhancements

- Integration with Sentry or similar monitoring service
- Error analytics and trends
- Automated error reporting via email/Slack
- Machine learning for error pattern detection
- Self-healing mechanisms for common errors