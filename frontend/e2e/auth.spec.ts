import { test, expect } from '@playwright/test'

test.describe('Authentication E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display login page with all elements', async ({ page }) => {
    // Check page title and heading
    await expect(page).toHaveTitle(/EVA/)
    await expect(page.getByText('Welcome to EVA')).toBeVisible()
    await expect(page.getByText('Your AI-powered Executive Virtual Assistant')).toBeVisible()

    // Check form elements
    await expect(page.getByLabel('Email address')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send magic link' })).toBeVisible()
    
    // Check footer links
    await expect(page.getByText('Terms of Service')).toBeVisible()
    await expect(page.getByText('Privacy Policy')).toBeVisible()
  })

  test('should show error for invalid email format', async ({ page }) => {
    // Enter invalid email
    await page.getByLabel('Email address').fill('invalid-email')
    await page.getByRole('button', { name: 'Send magic link' }).click()

    // Browser should show validation error
    const emailInput = page.getByLabel('Email address')
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage)
    expect(validationMessage).toBeTruthy()
  })

  test('should send magic link for valid email', async ({ page }) => {
    // Enter valid email
    await page.getByLabel('Email address').fill('test@example.com')
    await page.getByRole('button', { name: 'Send magic link' }).click()

    // Should show loading state
    await expect(page.getByText('Sending magic link...')).toBeVisible()

    // Should show success message
    await expect(page.getByText('Check your email!')).toBeVisible()
    await expect(page.getByText('test@example.com')).toBeVisible()
    await expect(page.getByText(/Click the link in your email/)).toBeVisible()
  })

  test('should allow changing email after sending', async ({ page }) => {
    // Send magic link
    await page.getByLabel('Email address').fill('first@example.com')
    await page.getByRole('button', { name: 'Send magic link' }).click()
    
    // Wait for success state
    await expect(page.getByText('Check your email!')).toBeVisible()

    // Click to use different email
    await page.getByText('Use a different email').click()

    // Should return to form
    await expect(page.getByLabel('Email address')).toBeVisible()
    await expect(page.getByLabel('Email address')).toHaveValue('')
  })

  test('should disable submit button when email is empty', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: 'Send magic link' })
    
    // Initially disabled
    await expect(submitButton).toBeDisabled()

    // Enable when typing
    await page.getByLabel('Email address').fill('test@example.com')
    await expect(submitButton).toBeEnabled()

    // Disable again when cleared
    await page.getByLabel('Email address').clear()
    await expect(submitButton).toBeDisabled()
  })

  test('should handle network errors gracefully', async ({ page, context }) => {
    // Block API requests to simulate network error
    await context.route('**/auth/v1/otp', route => route.abort())

    // Try to send magic link
    await page.getByLabel('Email address').fill('test@example.com')
    await page.getByRole('button', { name: 'Send magic link' }).click()

    // Should show error message
    await expect(page.getByText(/Failed to send magic link/)).toBeVisible()
  })

  test('should navigate to dashboard after authentication', async ({ page, context }) => {
    // Mock successful authentication
    await context.addCookies([{
      name: 'sb-access-token',
      value: 'mock-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax'
    }])

    // Mock API response for authenticated user
    await context.route('**/auth/v1/user', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-id',
          email: 'test@example.com',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString()
        })
      })
    })

    // Navigate to protected route
    await page.goto('/dashboard')

    // Should be on dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByText('EVA Enterprise')).toBeVisible()
  })

  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    // Try to access dashboard without authentication
    await page.goto('/dashboard')

    // Should redirect to login
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Welcome to EVA')).toBeVisible()
  })

  test('should maintain session across page refreshes', async ({ page, context }) => {
    // Set up authentication
    await context.addCookies([{
      name: 'sb-access-token',
      value: 'mock-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax'
    }])

    // Mock authenticated user
    await context.route('**/auth/v1/user', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-id',
          email: 'test@example.com',
          aud: 'authenticated'
        })
      })
    })

    // Navigate to dashboard
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/dashboard')

    // Refresh page
    await page.reload()

    // Should still be on dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByText('EVA Enterprise')).toBeVisible()
  })

  test('should handle sign out correctly', async ({ page, context }) => {
    // Set up authentication
    await context.addCookies([{
      name: 'sb-access-token',
      value: 'mock-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax'
    }])

    // Mock authenticated user and logout endpoint
    await context.route('**/auth/v1/user', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-id',
          email: 'test@example.com',
          aud: 'authenticated'
        })
      })
    })

    await context.route('**/auth/v1/logout', route => {
      route.fulfill({ status: 204 })
    })

    // Navigate to dashboard
    await page.goto('/dashboard')
    
    // Find and click sign out button (adjust selector as needed)
    await page.getByRole('button', { name: /sign out/i }).click()

    // Should redirect to login
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Welcome to EVA')).toBeVisible()
  })
})