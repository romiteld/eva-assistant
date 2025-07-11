# EVA Assistant Testing Guide

## Overview

This document provides a comprehensive guide to the testing infrastructure for the EVA Assistant application. Our testing strategy includes unit tests, integration tests, and end-to-end tests to ensure high quality and reliability.

## Test Structure

```
frontend/
├── src/
│   ├── **/__tests__/        # Unit and integration tests
│   ├── test/                # Test utilities and setup
│   │   ├── setup-msw.ts     # Mock Service Worker setup
│   │   └── test-utils.tsx   # Custom test utilities
├── e2e/                     # End-to-end tests
├── jest.config.js           # Jest configuration
├── jest.setup.js            # Jest setup file
└── playwright.config.ts     # Playwright configuration
```

## Running Tests

### Prerequisites

```bash
# Install dependencies
cd frontend
npm install

# Install Playwright browsers (for E2E tests)
npx playwright install --with-deps
```

### Test Commands

```bash
# Run all unit and integration tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run tests in CI mode
npm run test:ci
```

## Test Types

### 1. Unit Tests

Unit tests focus on individual components, hooks, and utilities in isolation.

**Example: Testing a Hook**
```typescript
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuth } from '../useAuth'

describe('useAuth', () => {
  it('should handle sign in', async () => {
    const { result } = renderHook(() => useAuth())
    
    await act(async () => {
      const response = await result.current.signIn('test@example.com')
      expect(response.success).toBe(true)
    })
  })
})
```

### 2. Integration Tests

Integration tests verify that different parts of the application work together correctly.

**Example: Testing API Routes**
```typescript
import { POST } from '../route'
import { NextRequest } from 'next/server'

describe('Firecrawl API Route', () => {
  it('should handle scrape action', async () => {
    const request = new NextRequest('http://localhost:3000/api/firecrawl', {
      method: 'POST',
      body: JSON.stringify({ action: 'scrape', url: 'https://example.com' })
    })
    
    const response = await POST(request)
    expect(response.status).toBe(200)
  })
})
```

### 3. E2E Tests

End-to-end tests simulate real user interactions across the entire application.

**Example: Authentication Flow**
```typescript
import { test, expect } from '@playwright/test'

test('should complete authentication flow', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[placeholder="Email"]', 'test@example.com')
  await page.click('button:has-text("Send Magic Link")')
  await expect(page.locator('text=Check your email')).toBeVisible()
})
```

## Testing Best Practices

### 1. Test Organization

- Group related tests using `describe` blocks
- Use descriptive test names that explain what is being tested
- Follow the AAA pattern: Arrange, Act, Assert

### 2. Mocking

We use Mock Service Worker (MSW) for API mocking:

```typescript
import { rest } from 'msw'
import { server } from '@/test/setup-msw'

test('should handle API error', async () => {
  server.use(
    rest.get('/api/tasks', (req, res, ctx) => {
      return res(ctx.status(500), ctx.json({ error: 'Server error' }))
    })
  )
  
  // Test error handling...
})
```

### 3. Test Utilities

Use our custom test utilities for consistent testing:

```typescript
import { render, createMockUser, createMockTask } from '@/test/test-utils'

test('should render with mock data', () => {
  const mockUser = createMockUser({ email: 'custom@example.com' })
  const mockTask = createMockTask({ title: 'Custom Task' })
  
  render(<Component />, {
    initialAuth: { user: mockUser }
  })
})
```

### 4. Async Testing

Always properly handle async operations:

```typescript
// Use waitFor for async state updates
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
})

// Use findBy queries for elements that appear async
const element = await screen.findByRole('button', { name: /submit/i })
```

## Coverage Requirements

Our project maintains the following coverage thresholds:

- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

To check coverage:
```bash
npm run test:coverage
```

## CI/CD Integration

Tests run automatically on:
- Every push to `main` and `develop` branches
- Every pull request

The CI pipeline includes:
1. Unit and integration tests
2. E2E tests
3. Code quality checks (ESLint, TypeScript)
4. Security scans

## Debugging Tests

### Jest Tests

```bash
# Run a specific test file
npm test -- useAuth.test.tsx

# Run tests matching a pattern
npm test -- --testNamePattern="should handle sign in"

# Debug tests in VS Code
# Add breakpoint and use "Jest: Debug" command
```

### Playwright Tests

```bash
# Run in debug mode
npx playwright test --debug

# Run with headed browser
npx playwright test --headed

# Run specific test file
npx playwright test auth.spec.ts

# Generate test code
npx playwright codegen http://localhost:3000
```

## Writing New Tests

### 1. Unit Test Template

```typescript
import { renderHook } from '@testing-library/react'
import { useYourHook } from '../useYourHook'

describe('useYourHook', () => {
  beforeEach(() => {
    // Setup
  })

  afterEach(() => {
    // Cleanup
  })

  it('should do something', async () => {
    const { result } = renderHook(() => useYourHook())
    
    // Test implementation
  })
})
```

### 2. E2E Test Template

```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should perform user action', async ({ page }) => {
    // User interactions
    await page.click('button')
    
    // Assertions
    await expect(page.locator('text=Success')).toBeVisible()
  })
})
```

## Common Issues and Solutions

### 1. Flaky Tests

- Use proper wait strategies (`waitFor`, `findBy`)
- Avoid fixed timeouts
- Mock external dependencies

### 2. Test Isolation

- Clear mocks between tests
- Reset database state
- Use unique test data

### 3. Performance

- Use `test.concurrent` for independent tests
- Minimize setup/teardown overhead
- Consider test splitting in CI

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [MSW Documentation](https://mswjs.io/)

## Contributing

When adding new features:
1. Write tests first (TDD approach encouraged)
2. Ensure all tests pass locally
3. Check coverage meets thresholds
4. Add E2E tests for critical user flows
5. Update this guide if needed