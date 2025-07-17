import { test, expect } from '@playwright/test'

test.describe('Integration Testing', () => {
  test.describe('End-to-End Workflows', () => {
    test('Complete Lead Generation to CRM Workflow', async ({ page }) => {
      // Login first
      await page.goto('/auth/login')
      await page.fill('[data-testid="email-input"]', 'test@example.com')
      await page.click('[data-testid="magic-link-button"]')
      
      // Navigate to lead generation
      await page.goto('/dashboard/lead-generation')
      await page.waitForLoadState('networkidle')
      
      // Search for leads
      await page.fill('[data-testid="search-input"]', 'financial advisor New York')
      await page.click('[data-testid="search-button"]')
      
      // Wait for results
      await page.waitForSelector('[data-testid="lead-result"]', { timeout: 30000 })
      
      // Select first lead
      const firstLead = page.locator('[data-testid="lead-result"]').first()
      await firstLead.click()
      
      // Verify lead details loaded
      await expect(page.locator('[data-testid="lead-details"]')).toBeVisible()
      
      // Add to CRM
      await page.click('[data-testid="add-to-crm-button"]')
      
      // Verify success message
      await expect(page.locator('[data-testid="success-toast"]')).toContainText('Lead added to CRM')
      
      // Verify lead appears in pipeline
      await page.goto('/dashboard/resume-parser')
      await expect(page.locator('[data-testid="pipeline-lead"]')).toBeVisible()
    })
    
    test('Content Creation to Publishing Workflow', async ({ page }) => {
      await page.goto('/dashboard/content-studio')
      await page.waitForLoadState('networkidle')
      
      // Create new content
      await page.fill('[data-testid="content-title"]', 'Test Article')
      await page.fill('[data-testid="content-prompt"]', 'Write about financial planning')
      await page.click('[data-testid="generate-content"]')
      
      // Wait for AI generation
      await page.waitForSelector('[data-testid="generated-content"]', { timeout: 60000 })
      
      // Edit content
      const contentEditor = page.locator('[data-testid="content-editor"]')
      await contentEditor.click()
      await contentEditor.type(' Additional content.')
      
      // Preview
      await page.click('[data-testid="preview-button"]')
      await expect(page.locator('[data-testid="content-preview"]')).toBeVisible()
      
      // Schedule publishing
      await page.click('[data-testid="schedule-button"]')
      await page.fill('[data-testid="publish-date"]', '2024-12-31')
      await page.click('[data-testid="confirm-schedule"]')
      
      // Verify scheduled
      await expect(page.locator('[data-testid="scheduled-badge"]')).toBeVisible()
    })
    
    test('Interview Scheduling with Calendar Integration', async ({ page }) => {
      await page.goto('/dashboard/interview-center')
      
      // Create new interview
      await page.click('[data-testid="new-interview"]')
      await page.fill('[data-testid="candidate-name"]', 'John Doe')
      await page.fill('[data-testid="position"]', 'Senior Financial Advisor')
      
      // Select date and time
      await page.click('[data-testid="date-picker"]')
      await page.click('[data-testid="calendar-date-available"]')
      await page.selectOption('[data-testid="time-slot"]', '10:00 AM')
      
      // Add interviewers
      await page.fill('[data-testid="interviewer-email"]', 'interviewer@example.com')
      await page.click('[data-testid="add-interviewer"]')
      
      // Generate interview guide
      await page.click('[data-testid="generate-guide"]')
      await page.waitForSelector('[data-testid="interview-guide"]', { timeout: 30000 })
      
      // Schedule
      await page.click('[data-testid="schedule-interview"]')
      
      // Verify calendar event created
      await expect(page.locator('[data-testid="calendar-event-created"]')).toBeVisible()
      
      // Verify email sent
      await expect(page.locator('[data-testid="email-sent-confirmation"]')).toBeVisible()
    })
  })
  
  test.describe('Real-time Updates', () => {
    test('WebSocket Connection and Real-time Updates', async ({ page, context }) => {
      // Open two pages
      const page1 = page
      const page2 = await context.newPage()
      
      // Navigate both to dashboard
      await page1.goto('/dashboard/tasks')
      await page2.goto('/dashboard/tasks')
      
      // Create task in page1
      await page1.fill('[data-testid="new-task-title"]', 'Real-time Test Task')
      await page1.click('[data-testid="create-task"]')
      
      // Verify task appears in page2 without refresh
      await expect(page2.locator('text=Real-time Test Task')).toBeVisible({ timeout: 5000 })
      
      // Update task status in page2
      await page2.click('[data-testid="task-status-toggle"]')
      
      // Verify status updates in page1
      await expect(page1.locator('[data-testid="task-completed"]')).toBeVisible({ timeout: 5000 })
      
      await page2.close()
    })
    
    test('Agent Status Real-time Monitoring', async ({ page }) => {
      await page.goto('/dashboard/orchestrator')
      
      // Verify WebSocket connection
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected')
      
      // Start an agent task
      await page.goto('/dashboard/lead-generation')
      await page.fill('[data-testid="search-input"]', 'test search')
      await page.click('[data-testid="search-button"]')
      
      // Go back to orchestrator
      await page.goto('/dashboard/orchestrator')
      
      // Verify agent activity shows up
      await expect(page.locator('[data-testid="agent-activity"]')).toContainText('Lead Generation Agent')
      await expect(page.locator('[data-testid="agent-status"]')).toContainText('Active')
    })
  })
  
  test.describe('Third-party Integration Tests', () => {
    test('Microsoft 365 Email Integration', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Check if Microsoft auth is connected
      const msStatus = page.locator('[data-testid="microsoft-status"]')
      if (await msStatus.isVisible()) {
        await expect(msStatus).toContainText('Connected')
        
        // Test email search
        await page.click('[data-testid="email-search"]')
        await page.fill('[data-testid="email-query"]', 'interview')
        await page.click('[data-testid="search-emails"]')
        
        // Verify results
        await expect(page.locator('[data-testid="email-results"]')).toBeVisible({ timeout: 10000 })
      }
    })
    
    test('Twilio SMS Integration', async ({ page }) => {
      await page.goto('/dashboard/twilio')
      
      // Check connection status
      await expect(page.locator('[data-testid="twilio-status"]')).toBeVisible()
      
      // Test SMS sending (mock)
      await page.fill('[data-testid="phone-number"]', '+1234567890')
      await page.fill('[data-testid="sms-message"]', 'Test message')
      await page.click('[data-testid="send-sms"]')
      
      // Verify queued
      await expect(page.locator('[data-testid="sms-queued"]')).toBeVisible()
    })
    
    test('Firecrawl Web Scraping', async ({ page }) => {
      await page.goto('/dashboard/firecrawl')
      
      // Test URL scraping
      await page.fill('[data-testid="scrape-url"]', 'https://example.com')
      await page.click('[data-testid="scrape-button"]')
      
      // Wait for results
      await expect(page.locator('[data-testid="scrape-results"]')).toBeVisible({ timeout: 30000 })
      
      // Verify content extracted
      await expect(page.locator('[data-testid="extracted-content"]')).not.toBeEmpty()
    })
  })
  
  test.describe('Data Flow Validation', () => {
    test('User Profile Data Consistency', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Get user data from main dashboard
      const dashboardUsername = await page.locator('[data-testid="user-name"]').textContent()
      const dashboardEmail = await page.locator('[data-testid="user-email"]').textContent()
      
      // Navigate to different sections and verify consistency
      const sections = [
        '/dashboard/tasks',
        '/dashboard/lead-generation',
        '/dashboard/content-studio'
      ]
      
      for (const section of sections) {
        await page.goto(section)
        await expect(page.locator('[data-testid="user-name"]')).toContainText(dashboardUsername!)
        await expect(page.locator('[data-testid="user-email"]')).toContainText(dashboardEmail!)
      }
    })
    
    test('Cross-Component State Synchronization', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Create a task
      await page.goto('/dashboard/tasks')
      await page.fill('[data-testid="new-task-title"]', 'Follow up with lead')
      await page.click('[data-testid="create-task"]')
      
      // Go to lead generation and create a lead
      await page.goto('/dashboard/lead-generation')
      await page.fill('[data-testid="manual-lead-name"]', 'Test Lead')
      await page.click('[data-testid="create-lead"]')
      
      // Link task to lead
      await page.click('[data-testid="link-task"]')
      await page.selectOption('[data-testid="task-select"]', 'Follow up with lead')
      await page.click('[data-testid="confirm-link"]')
      
      // Go back to tasks and verify link
      await page.goto('/dashboard/tasks')
      await expect(page.locator('text=Linked to: Test Lead')).toBeVisible()
    })
  })
  
  test.describe('Error Handling and Recovery', () => {
    test('API Error Handling', async ({ page, context }) => {
      // Intercept API calls to simulate errors
      await context.route('**/api/leads/search', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal Server Error' })
        })
      })
      
      await page.goto('/dashboard/lead-generation')
      await page.fill('[data-testid="search-input"]', 'test')
      await page.click('[data-testid="search-button"]')
      
      // Verify error message
      await expect(page.locator('[data-testid="error-message"]')).toContainText('error')
      
      // Verify retry button
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
    })
    
    test('Network Offline Recovery', async ({ page, context }) => {
      await page.goto('/dashboard')
      
      // Go offline
      await context.setOffline(true)
      
      // Try to navigate
      await page.click('[data-testid="tab-tasks"]').catch(() => {})
      
      // Verify offline indicator
      await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible()
      
      // Go back online
      await context.setOffline(false)
      
      // Verify reconnection
      await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible({ timeout: 10000 })
    })
    
    test('Session Timeout Handling', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Simulate session timeout by clearing cookies
      await page.context().clearCookies()
      
      // Try to perform an action
      await page.click('[data-testid="create-task-button"]').catch(() => {})
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/auth\/login/)
      
      // Verify return URL is preserved
      await expect(page.locator('[data-testid="return-url"]')).toHaveValue('/dashboard')
    })
  })
})