import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'

test.describe('Authentication Flow', () => {
  test.describe('Magic Link Authentication', () => {
    test('should display magic link login form', async ({ page }) => {
      await page.goto('/auth/login')

      // Check for magic link form elements
      await expect(page.locator('input[type="email"]')).toBeVisible()
      await expect(page.locator('button[type="submit"]')).toBeVisible()
      await expect(page.locator('text=Send Magic Link')).toBeVisible()
    })

    test('should validate email format', async ({ page }) => {
      await page.goto('/auth/login')

      const emailInput = page.locator('input[type="email"]')
      const submitButton = page.locator('button[type="submit"]')

      // Test invalid email
      await emailInput.fill('invalid-email')
      await submitButton.click()

      await expect(page.locator('text=Please enter a valid email address')).toBeVisible()
    })

    test('should handle empty email submission', async ({ page }) => {
      await page.goto('/auth/login')

      const submitButton = page.locator('button[type="submit"]')
      await submitButton.click()

      await expect(page.locator('text=Email is required')).toBeVisible()
    })

    test('should show success message after sending magic link', async ({ page }) => {
      await page.goto('/auth/login')

      const emailInput = page.locator('input[type="email"]')
      const submitButton = page.locator('button[type="submit"]')

      await emailInput.fill('test@example.com')
      await submitButton.click()

      // Wait for success message
      await expect(page.locator('text=Magic link sent!')).toBeVisible()
      await expect(page.locator('text=Check your email for the login link')).toBeVisible()
    })

    test('should be accessible', async ({ page }) => {
      await page.goto('/auth/login')

      const accessibilityScanResults = await new AxeBuilder({ page }).analyze()
      expect(accessibilityScanResults.violations).toEqual([])
    })
  })

  test.describe('Microsoft OAuth', () => {
    test('should display Microsoft OAuth button', async ({ page }) => {
      await page.goto('/auth/login')

      await expect(page.locator('button:has-text("Sign in with Microsoft")')).toBeVisible()
    })

    test('should redirect to Microsoft OAuth when clicked', async ({ page }) => {
      await page.goto('/auth/login')

      const microsoftButton = page.locator('button:has-text("Sign in with Microsoft")')
      
      // Mock the OAuth redirect
      await page.route('**/auth/microsoft', async route => {
        await route.fulfill({
          status: 302,
          headers: {
            'Location': 'https://login.microsoftonline.com/oauth2/v2.0/authorize?client_id=test'
          }
        })
      })

      await microsoftButton.click()

      // Should redirect to Microsoft OAuth
      await expect(page).toHaveURL(/login\.microsoftonline\.com/)
    })

    test('should handle OAuth callback', async ({ page }) => {
      // Mock successful OAuth callback
      await page.route('**/auth/microsoft/callback**', async route => {
        await route.fulfill({
          status: 302,
          headers: {
            'Location': '/dashboard'
          }
        })
      })

      await page.goto('/auth/microsoft/callback?code=test-code&state=test-state')

      // Should redirect to dashboard after successful authentication
      await expect(page).toHaveURL('/dashboard')
    })

    test('should handle OAuth errors', async ({ page }) => {
      await page.goto('/auth/microsoft/callback?error=access_denied&error_description=User+denied+access')

      await expect(page.locator('text=Authentication failed')).toBeVisible()
      await expect(page.locator('text=User denied access')).toBeVisible()
    })
  })

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      await page.goto('/dashboard')

      // Should redirect to login page
      await expect(page).toHaveURL('/auth/login')
    })

    test('should allow authenticated users to access dashboard', async ({ page }) => {
      // Mock authentication
      await page.addInitScript(() => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          refresh_token: 'mock-refresh-token',
          user: { id: 'user-123', email: 'test@example.com' }
        }))
      })

      await page.goto('/dashboard')

      // Should stay on dashboard
      await expect(page).toHaveURL('/dashboard')
      await expect(page.locator('text=Welcome to EVA')).toBeVisible()
    })
  })

  test.describe('Logout Flow', () => {
    test('should log out user and redirect to login', async ({ page }) => {
      // Mock authentication
      await page.addInitScript(() => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          refresh_token: 'mock-refresh-token',
          user: { id: 'user-123', email: 'test@example.com' }
        }))
      })

      await page.goto('/dashboard')

      // Find and click logout button
      const logoutButton = page.locator('button:has-text("Logout")')
      await logoutButton.click()

      // Should redirect to login after logout
      await expect(page).toHaveURL('/auth/login')
      await expect(page.locator('text=You have been logged out')).toBeVisible()
    })

    test('should clear authentication state on logout', async ({ page }) => {
      // Mock authentication
      await page.addInitScript(() => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          refresh_token: 'mock-refresh-token',
          user: { id: 'user-123', email: 'test@example.com' }
        }))
      })

      await page.goto('/dashboard')

      // Click logout
      const logoutButton = page.locator('button:has-text("Logout")')
      await logoutButton.click()

      // Check that authentication state is cleared
      const authToken = await page.evaluate(() => localStorage.getItem('supabase.auth.token'))
      expect(authToken).toBeNull()
    })
  })

  test.describe('Session Management', () => {
    test('should handle expired session gracefully', async ({ page }) => {
      // Mock expired session
      await page.addInitScript(() => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'expired-token',
          refresh_token: 'expired-refresh-token',
          expires_at: Date.now() - 1000, // Expired 1 second ago
          user: { id: 'user-123', email: 'test@example.com' }
        }))
      })

      await page.goto('/dashboard')

      // Should redirect to login when session is expired
      await expect(page).toHaveURL('/auth/login')
      await expect(page.locator('text=Your session has expired')).toBeVisible()
    })

    test('should refresh token automatically', async ({ page }) => {
      // Mock token refresh
      await page.route('**/auth/v1/token**', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
            user: { id: 'user-123', email: 'test@example.com' }
          })
        })
      })

      // Mock near-expired session
      await page.addInitScript(() => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'soon-to-expire-token',
          refresh_token: 'valid-refresh-token',
          expires_at: Date.now() + 300000, // Expires in 5 minutes
          user: { id: 'user-123', email: 'test@example.com' }
        }))
      })

      await page.goto('/dashboard')

      // Should stay on dashboard with refreshed token
      await expect(page).toHaveURL('/dashboard')
      await expect(page.locator('text=Welcome to EVA')).toBeVisible()
    })
  })

  test.describe('Accessibility', () => {
    test('login page should be accessible', async ({ page }) => {
      await page.goto('/auth/login')

      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('main')
        .analyze()

      expect(accessibilityScanResults.violations).toEqual([])
    })

    test('should support keyboard navigation', async ({ page }) => {
      await page.goto('/auth/login')

      // Test keyboard navigation
      await page.keyboard.press('Tab')
      await expect(page.locator('input[type="email"]')).toBeFocused()

      await page.keyboard.press('Tab')
      await expect(page.locator('button[type="submit"]')).toBeFocused()

      await page.keyboard.press('Tab')
      await expect(page.locator('button:has-text("Sign in with Microsoft")')).toBeFocused()
    })

    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto('/auth/login')

      const emailInput = page.locator('input[type="email"]')
      const submitButton = page.locator('button[type="submit"]')

      await expect(emailInput).toHaveAttribute('aria-label', 'Email address')
      await expect(submitButton).toHaveAttribute('aria-label', 'Send magic link')
    })
  })

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Mock network failure
      await page.route('**/auth/v1/otp', async route => {
        await route.abort('failed')
      })

      await page.goto('/auth/login')

      const emailInput = page.locator('input[type="email"]')
      const submitButton = page.locator('button[type="submit"]')

      await emailInput.fill('test@example.com')
      await submitButton.click()

      await expect(page.locator('text=Network error. Please try again.')).toBeVisible()
    })

    test('should handle server errors', async ({ page }) => {
      // Mock server error
      await page.route('**/auth/v1/otp', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Internal server error'
          })
        })
      })

      await page.goto('/auth/login')

      const emailInput = page.locator('input[type="email"]')
      const submitButton = page.locator('button[type="submit"]')

      await emailInput.fill('test@example.com')
      await submitButton.click()

      await expect(page.locator('text=An error occurred. Please try again.')).toBeVisible()
    })
  })
})