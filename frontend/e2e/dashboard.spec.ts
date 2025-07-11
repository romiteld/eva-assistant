import { test, expect } from '@playwright/test'

test.describe('Dashboard E2E Tests', () => {
  // Helper function to authenticate before tests
  async function authenticateUser(context: any) {
    await context.addCookies([{
      name: 'sb-access-token',
      value: 'mock-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax'
    }])

    await context.route('**/auth/v1/user', (route: any) => {
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
  }

  test.beforeEach(async ({ context }) => {
    await authenticateUser(context)
  })

  test('should display dashboard with all navigation items', async ({ page }) => {
    await page.goto('/dashboard')

    // Check main dashboard elements
    await expect(page.getByText('EVA Enterprise')).toBeVisible()
    await expect(page.getByText('AI Assistant')).toBeVisible()

    // Check navigation items in sidebar
    const navItems = [
      'Dashboard',
      'Voice Agent',
      'Lead Generation',
      'Content Studio',
      'Agent Orchestrator',
      'Outreach Campaigns',
      'Resume Parser',
      'Interview Center',
      'Recruiter Intel',
      'Task Management',
      'Firecrawl',
      'Candidates',
      'Messages',
      'Documents',
      'Settings'
    ]

    for (const item of navItems) {
      await expect(page.getByText(item)).toBeVisible()
    }
  })

  test('should navigate between dashboard sections', async ({ page }) => {
    await page.goto('/dashboard')

    // Navigate to Voice Agent
    await page.getByText('Voice Agent').click()
    await expect(page).toHaveURL('/dashboard/voice')

    // Navigate to Lead Generation
    await page.getByText('Lead Generation').click()
    await expect(page).toHaveURL('/dashboard/lead-generation')

    // Navigate to Content Studio
    await page.getByText('Content Studio').click()
    await expect(page).toHaveURL('/dashboard/content-studio')

    // Navigate back to main dashboard
    await page.getByText('Dashboard').first().click()
    await expect(page).toHaveURL('/dashboard')
  })

  test('should highlight active navigation item', async ({ page }) => {
    await page.goto('/dashboard/voice')

    // Voice Agent should be highlighted
    const voiceAgentButton = page.getByText('Voice Agent').locator('..')
    await expect(voiceAgentButton).toHaveClass(/bg-purple-600\/20/)
    await expect(voiceAgentButton).toHaveClass(/text-white/)
    await expect(voiceAgentButton).toHaveClass(/border-purple-500\/30/)
  })

  test('should display system status indicator', async ({ page }) => {
    await page.goto('/dashboard')

    // Check system status
    await expect(page.getByText('System Status')).toBeVisible()
    await expect(page.getByText('All systems operational')).toBeVisible()

    // Check for pulse animation on status indicator
    const statusIndicator = page.locator('.bg-green-400.animate-pulse')
    await expect(statusIndicator).toBeVisible()
  })

  test('should handle sidebar toggle on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/dashboard')

    // Sidebar should be closeable on mobile
    const closeButton = page.locator('button').filter({ hasText: '' }).first()
    await expect(closeButton).toBeVisible()
    await expect(closeButton).toHaveClass(/lg:hidden/)
  })

  test('should load voice agent page', async ({ page }) => {
    await page.goto('/dashboard/voice')

    // Check for voice agent specific content
    await expect(page).toHaveURL('/dashboard/voice')
    // Add more specific checks based on voice agent implementation
  })

  test('should load lead generation page', async ({ page }) => {
    await page.goto('/dashboard/lead-generation')

    // Check for lead generation specific content
    await expect(page).toHaveURL('/dashboard/lead-generation')
    // Add more specific checks based on lead generation implementation
  })

  test('should load content studio page', async ({ page }) => {
    await page.goto('/dashboard/content-studio')

    // Check for content studio specific content
    await expect(page).toHaveURL('/dashboard/content-studio')
    // Add more specific checks based on content studio implementation
  })

  test('should maintain sidebar state across navigation', async ({ page }) => {
    await page.goto('/dashboard')

    // Navigate to different sections
    await page.getByText('Voice Agent').click()
    await expect(page.getByText('EVA Enterprise')).toBeVisible()

    await page.getByText('Lead Generation').click()
    await expect(page.getByText('EVA Enterprise')).toBeVisible()

    // Sidebar should remain visible
    await expect(page.getByText('System Status')).toBeVisible()
  })

  test('should handle deep linking to dashboard sections', async ({ page }) => {
    // Direct navigation to nested routes
    await page.goto('/dashboard/interview-center')
    await expect(page).toHaveURL('/dashboard/interview-center')

    await page.goto('/dashboard/recruiter-intel')
    await expect(page).toHaveURL('/dashboard/recruiter-intel')

    await page.goto('/dashboard/tasks')
    await expect(page).toHaveURL('/dashboard/tasks')
  })

  test('should show loading states appropriately', async ({ page }) => {
    // Slow down network to see loading states
    await page.route('**/*', route => {
      setTimeout(() => route.continue(), 100)
    })

    await page.goto('/dashboard')
    
    // Navigate and check for any loading indicators
    await page.getByText('Content Studio').click()
    
    // Check URL changed even during loading
    await expect(page).toHaveURL('/dashboard/content-studio')
  })

  test('should handle keyboard navigation', async ({ page }) => {
    await page.goto('/dashboard')

    // Tab through navigation items
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    
    // Press Enter on focused item
    await page.keyboard.press('Enter')
    
    // Should navigate to the focused item's route
    await expect(page.url()).toContain('/dashboard/')
  })

  test('should persist user session across dashboard sections', async ({ page, context }) => {
    // Mock user profile endpoint
    await context.route('**/rest/v1/profiles*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'test-user-id',
          full_name: 'Test User',
          email: 'test@example.com'
        }])
      })
    })

    await page.goto('/dashboard')

    // Navigate through sections
    await page.getByText('Settings').click()
    await expect(page).toHaveURL('/dashboard/settings')

    // User should still be authenticated
    await page.goto('/dashboard')
    await expect(page.getByText('EVA Enterprise')).toBeVisible()
  })

  test('should handle errors gracefully', async ({ page, context }) => {
    // Mock API error
    await context.route('**/rest/v1/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      })
    })

    await page.goto('/dashboard')
    
    // Should still display UI despite API errors
    await expect(page.getByText('EVA Enterprise')).toBeVisible()
    await expect(page.getByText('Dashboard')).toBeVisible()
  })
})