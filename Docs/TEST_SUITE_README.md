# EVA Assistant Test Suite Documentation

This document provides an overview of the comprehensive test suite implemented for the EVA Assistant platform.

## Test Suite Overview

The test suite is designed to achieve 80% code coverage as configured in `jest.config.js` and includes:

1. **Unit Tests** - Testing individual components and functions in isolation
2. **Integration Tests** - Testing component interactions and API integrations
3. **End-to-End Tests** - Testing complete user flows with Playwright

## Test Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── __tests__/
│   │   │       └── LoginPage.test.tsx
│   │   ├── dashboard/
│   │   │   └── __tests__/
│   │   │       └── Sidebar.test.tsx
│   │   └── ui/
│   │       └── __tests__/
│   │           ├── button.test.tsx
│   │           ├── input.test.tsx
│   │           └── select.test.tsx
│   ├── lib/
│   │   └── supabase/
│   │       └── __tests__/
│   │           └── auth.integration.test.ts
│   └── app/
│       └── api/
│           └── __tests__/
│               └── auth.integration.test.ts
└── e2e/
    ├── auth.spec.ts
    └── dashboard.spec.ts
```

## Running Tests

### Unit & Integration Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run a specific test file
npm test -- src/components/auth/__tests__/LoginPage.test.tsx
```

### End-to-End Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI mode
npm run test:e2e:ui

# Run specific E2E test
npx playwright test e2e/auth.spec.ts
```

## Test Examples

### 1. Component Unit Tests

#### LoginPage Component Test (`src/components/auth/__tests__/LoginPage.test.tsx`)

Tests cover:
- Component rendering with correct elements
- Form validation
- Email input handling
- Magic link submission flow
- Success/error states
- Loading states
- User interaction flows

Key patterns:
```typescript
// Mocking external dependencies
jest.mock('@/lib/supabase/auth', () => ({
  authHelpers: {
    sendMagicLink: jest.fn()
  }
}))

// Testing user interactions
const user = userEvent.setup()
await user.type(emailInput, 'test@example.com')
await user.click(submitButton)

// Asserting component states
expect(screen.getByText('Check your email!')).toBeInTheDocument()
```

#### UI Component Tests

**Button Component** (`src/components/ui/__tests__/button.test.tsx`)
- Variant rendering (default, destructive, outline, etc.)
- Size variations (sm, default, lg, icon)
- Click event handling
- Disabled state behavior
- Custom className application
- Ref forwarding
- asChild prop functionality

**Input Component** (`src/components/ui/__tests__/input.test.tsx`)
- Value handling and display
- Controlled/uncontrolled modes
- Different input types
- Placeholder text
- Disabled state
- Focus/blur events
- Form integration

**Select Component** (`src/components/ui/__tests__/select.test.tsx`)
- Dropdown open/close behavior
- Item selection
- Keyboard navigation
- Disabled states
- Group labels and separators
- Selected item indicators

### 2. Integration Tests

#### Authentication Integration (`src/lib/supabase/__tests__/auth.integration.test.ts`)

Tests authentication flows with mocked Supabase responses:
- Magic link authentication flow
- Session management
- OAuth flows (Microsoft)
- Token refresh
- Profile fetching
- Error handling

Example:
```typescript
it('successfully sends magic link and handles response', async () => {
  const testEmail = 'test@example.com'
  
  await expect(authHelpers.sendMagicLink(testEmail)).resolves.not.toThrow()
  
  expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
    email: testEmail,
    options: {
      emailRedirectTo: expect.stringContaining('/dashboard')
    }
  })
})
```

#### API Route Integration (`src/app/api/__tests__/auth.integration.test.ts`)

Tests API endpoints:
- Request validation
- Response formatting
- Error handling
- OAuth token exchange
- User profile retrieval

### 3. End-to-End Tests

#### Authentication E2E (`e2e/auth.spec.ts`)

Complete user authentication flows:
- Login page display
- Email validation
- Magic link sending
- Success/error messages
- Session persistence
- Protected route access
- Sign out functionality

#### Dashboard E2E (`e2e/dashboard.spec.ts`)

Dashboard functionality:
- Navigation between sections
- Active state highlighting
- System status display
- Mobile responsiveness
- Keyboard navigation
- Deep linking
- Error resilience

## Test Configuration

### Jest Configuration (`jest.config.js`)

- **Test Environment**: jsdom for browser-like environment
- **Coverage Threshold**: 80% for branches, functions, lines, and statements
- **Module Aliases**: Configured for @/ imports
- **Transform**: Handles TypeScript and ESM modules
- **Setup Files**: 
  - `jest.polyfills.js` - Browser API polyfills
  - `jest.setup.ts` - Test utilities and global mocks

### Mock Service Worker (MSW)

MSW is configured in `src/test/setup-msw.ts` to intercept and mock HTTP requests:

```typescript
// Mock Supabase auth endpoints
http.post('*/auth/v1/token', () => {
  return HttpResponse.json({
    access_token: 'mock-access-token',
    user: { id: 'test-user-id', email: 'test@example.com' }
  })
})
```

### Playwright Configuration (`playwright.config.ts`)

- **Browsers**: Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari
- **Base URL**: http://localhost:3000
- **Screenshots**: On failure
- **Videos**: On first retry
- **Trace**: On first retry
- **Web Server**: Automatically starts dev server

## Best Practices

### 1. Test Organization
- Group related tests using `describe` blocks
- Use descriptive test names that explain the expected behavior
- Follow AAA pattern: Arrange, Act, Assert

### 2. Mocking
- Mock external dependencies (Supabase, APIs)
- Use MSW for HTTP request mocking
- Mock only what's necessary for the test

### 3. Assertions
- Use specific assertions (`toHaveTextContent` vs `toBeInTheDocument`)
- Test both positive and negative cases
- Verify error handling

### 4. User Interactions
- Use `userEvent` for realistic user interactions
- Test keyboard navigation
- Verify accessibility attributes

### 5. Async Testing
- Use `waitFor` for async operations
- Handle loading states
- Test error boundaries

## Coverage Report

Run `npm run test:coverage` to generate a coverage report. The report will be available in:
- Terminal output
- `coverage/lcov-report/index.html` (HTML report)

Current coverage threshold: 80% for all metrics

## Debugging Tests

### Unit/Integration Tests
```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

### E2E Tests
```bash
# Debug mode with headed browser
npx playwright test --debug

# Generate trace for debugging
npx playwright test --trace on
```

## Continuous Integration

The test suite is designed to run in CI environments:

```bash
# CI-specific test command
npm run test:ci
```

This command:
- Runs tests in CI mode
- Generates coverage reports
- Limits worker processes
- Exits with appropriate codes

## Adding New Tests

When adding new features:

1. **Create test file** in `__tests__` directory next to the component
2. **Import testing utilities**:
   ```typescript
   import { render, screen } from '@testing-library/react'
   import userEvent from '@testing-library/user-event'
   ```
3. **Mock dependencies** as needed
4. **Write comprehensive tests** covering:
   - Happy path
   - Error cases
   - Edge cases
   - User interactions
5. **Run coverage** to ensure threshold is met

## Test Patterns to Follow

The implemented tests demonstrate several important patterns:

1. **Component Testing Pattern** - See `LoginPage.test.tsx`
2. **UI Library Testing Pattern** - See `button.test.tsx`, `input.test.tsx`
3. **Integration Testing Pattern** - See `auth.integration.test.ts`
4. **E2E Testing Pattern** - See `auth.spec.ts`, `dashboard.spec.ts`

These patterns can be used as templates for testing similar components and features throughout the application.