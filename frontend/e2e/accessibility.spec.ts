import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        refresh_token: 'mock-refresh-token',
        user: { id: 'user-123', email: 'test@example.com' }
      }))
    })
  })

  test.describe('Dashboard Navigation', () => {
    test('sidebar should be accessible', async ({ page }) => {
      await page.goto('/dashboard')

      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[data-testid="sidebar"]')
        .analyze()

      expect(accessibilityScanResults.violations).toEqual([])
    })

    test('should support keyboard navigation in sidebar', async ({ page }) => {
      await page.goto('/dashboard')

      // Test Tab navigation through sidebar items
      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="nav-dashboard"]')).toBeFocused()

      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="nav-voice"]')).toBeFocused()

      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="nav-orchestrator"]')).toBeFocused()
    })

    test('should support arrow key navigation in sidebar', async ({ page }) => {
      await page.goto('/dashboard')

      // Focus on first navigation item
      await page.locator('[data-testid="nav-dashboard"]').focus()

      // Test arrow key navigation
      await page.keyboard.press('ArrowDown')
      await expect(page.locator('[data-testid="nav-voice"]')).toBeFocused()

      await page.keyboard.press('ArrowDown')
      await expect(page.locator('[data-testid="nav-orchestrator"]')).toBeFocused()

      await page.keyboard.press('ArrowUp')
      await expect(page.locator('[data-testid="nav-voice"]')).toBeFocused()
    })

    test('should handle Home and End keys in sidebar', async ({ page }) => {
      await page.goto('/dashboard')

      // Focus on middle navigation item
      await page.locator('[data-testid="nav-orchestrator"]').focus()

      // Test Home key
      await page.keyboard.press('Home')
      await expect(page.locator('[data-testid="nav-dashboard"]')).toBeFocused()

      // Test End key
      await page.keyboard.press('End')
      await expect(page.locator('[data-testid="nav-settings"]')).toBeFocused()
    })

    test('should have proper ARIA labels and roles', async ({ page }) => {
      await page.goto('/dashboard')

      // Check navigation role
      await expect(page.locator('[data-testid="sidebar"]')).toHaveAttribute('role', 'navigation')
      await expect(page.locator('[data-testid="sidebar"]')).toHaveAttribute('aria-label', 'Main navigation')

      // Check navigation items have proper labels
      await expect(page.locator('[data-testid="nav-dashboard"]')).toHaveAttribute('aria-label', 'Dashboard')
      await expect(page.locator('[data-testid="nav-voice"]')).toHaveAttribute('aria-label', 'Voice Agent')
      await expect(page.locator('[data-testid="nav-orchestrator"]')).toHaveAttribute('aria-label', 'Agent Orchestrator')
    })

    test('should indicate current page with aria-current', async ({ page }) => {
      await page.goto('/dashboard/voice')

      await expect(page.locator('[data-testid="nav-voice"]')).toHaveAttribute('aria-current', 'page')
    })

    test('should support screen reader announcements', async ({ page }) => {
      await page.goto('/dashboard')

      // Check for live region for announcements
      await expect(page.locator('[aria-live="polite"]')).toBeVisible()
    })
  })

  test.describe('Voice Agent Accessibility', () => {
    test('voice controls should be accessible', async ({ page }) => {
      await page.goto('/dashboard/voice')

      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[data-testid="voice-controls"]')
        .analyze()

      expect(accessibilityScanResults.violations).toEqual([])
    })

    test('should handle microphone permission dialog', async ({ page }) => {
      await page.goto('/dashboard/voice')

      // Mock microphone permission request
      await page.evaluate(() => {
        navigator.mediaDevices.getUserMedia = async () => {
          throw new Error('Permission denied')
        }
      })

      const startButton = page.locator('[data-testid="start-voice-button"]')
      await startButton.click()

      // Check permission dialog is accessible
      await expect(page.locator('[data-testid="permission-dialog"]')).toBeVisible()
      await expect(page.locator('[data-testid="permission-dialog"]')).toHaveAttribute('role', 'dialog')
      await expect(page.locator('[data-testid="permission-dialog"]')).toHaveAttribute('aria-labelledby', 'permission-title')
    })

    test('should provide voice control status to screen readers', async ({ page }) => {
      await page.goto('/dashboard/voice')

      // Check for status announcements
      await expect(page.locator('[data-testid="voice-status"]')).toHaveAttribute('aria-live', 'polite')
      await expect(page.locator('[data-testid="voice-status"]')).toHaveAttribute('aria-atomic', 'true')
    })

    test('should have proper button labels', async ({ page }) => {
      await page.goto('/dashboard/voice')

      await expect(page.locator('[data-testid="start-voice-button"]')).toHaveAttribute('aria-label', 'Start voice conversation')
      await expect(page.locator('[data-testid="stop-voice-button"]')).toHaveAttribute('aria-label', 'Stop voice conversation')
      await expect(page.locator('[data-testid="mute-button"]')).toHaveAttribute('aria-label', 'Mute microphone')
    })

    test('should indicate recording state', async ({ page }) => {
      await page.goto('/dashboard/voice')

      // Start recording
      const startButton = page.locator('[data-testid="start-voice-button"]')
      await startButton.click()

      // Check recording state is indicated
      await expect(page.locator('[data-testid="recording-indicator"]')).toHaveAttribute('aria-label', 'Recording in progress')
    })
  })

  test.describe('Form Accessibility', () => {
    test('task creation form should be accessible', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Open create task modal
      const createButton = page.locator('[data-testid="create-task-button"]')
      await createButton.click()

      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[data-testid="create-task-modal"]')
        .analyze()

      expect(accessibilityScanResults.violations).toEqual([])
    })

    test('form fields should have proper labels', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      const createButton = page.locator('[data-testid="create-task-button"]')
      await createButton.click()

      // Check form labels
      await expect(page.locator('[data-testid="task-title-input"]')).toHaveAttribute('aria-labelledby', 'title-label')
      await expect(page.locator('[data-testid="task-description-input"]')).toHaveAttribute('aria-labelledby', 'description-label')
      await expect(page.locator('[data-testid="priority-select"]')).toHaveAttribute('aria-labelledby', 'priority-label')
    })

    test('form validation should be accessible', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      const createButton = page.locator('[data-testid="create-task-button"]')
      await createButton.click()

      // Try to submit without filling required fields
      const submitButton = page.locator('[data-testid="submit-task-button"]')
      await submitButton.click()

      // Check validation messages are associated with inputs
      await expect(page.locator('[data-testid="task-title-input"]')).toHaveAttribute('aria-describedby', 'title-error')
      await expect(page.locator('[data-testid="title-error"]')).toHaveAttribute('role', 'alert')
    })

    test('form should support keyboard navigation', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      const createButton = page.locator('[data-testid="create-task-button"]')
      await createButton.click()

      // Test Tab navigation through form
      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="task-title-input"]')).toBeFocused()

      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="task-description-input"]')).toBeFocused()

      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="priority-select"]')).toBeFocused()
    })
  })

  test.describe('Modal Accessibility', () => {
    test('modals should trap focus', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      const createButton = page.locator('[data-testid="create-task-button"]')
      await createButton.click()

      // Focus should be trapped within modal
      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="task-title-input"]')).toBeFocused()

      // Continue tabbing to last focusable element
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="cancel-button"]')).toBeFocused()

      // Tab from last element should return to first
      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="task-title-input"]')).toBeFocused()
    })

    test('modals should support Escape key', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      const createButton = page.locator('[data-testid="create-task-button"]')
      await createButton.click()

      // Press Escape to close modal
      await page.keyboard.press('Escape')
      await expect(page.locator('[data-testid="create-task-modal"]')).not.toBeVisible()
    })

    test('modals should have proper ARIA attributes', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      const createButton = page.locator('[data-testid="create-task-button"]')
      await createButton.click()

      // Check modal attributes
      await expect(page.locator('[data-testid="create-task-modal"]')).toHaveAttribute('role', 'dialog')
      await expect(page.locator('[data-testid="create-task-modal"]')).toHaveAttribute('aria-labelledby', 'modal-title')
      await expect(page.locator('[data-testid="create-task-modal"]')).toHaveAttribute('aria-modal', 'true')
    })

    test('modal backdrop should not be focusable', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      const createButton = page.locator('[data-testid="create-task-button"]')
      await createButton.click()

      // Check backdrop is not focusable
      await expect(page.locator('[data-testid="modal-backdrop"]')).toHaveAttribute('aria-hidden', 'true')
    })
  })

  test.describe('Table Accessibility', () => {
    test('task table should be accessible', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[data-testid="task-table"]')
        .analyze()

      expect(accessibilityScanResults.violations).toEqual([])
    })

    test('table should have proper headers', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Check table headers
      await expect(page.locator('[data-testid="task-table"]')).toHaveAttribute('role', 'table')
      await expect(page.locator('[data-testid="title-header"]')).toHaveAttribute('role', 'columnheader')
      await expect(page.locator('[data-testid="status-header"]')).toHaveAttribute('role', 'columnheader')
      await expect(page.locator('[data-testid="priority-header"]')).toHaveAttribute('role', 'columnheader')
    })

    test('table should support keyboard navigation', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Focus on first table row
      await page.locator('[data-testid="task-row-1"]').focus()

      // Test arrow key navigation
      await page.keyboard.press('ArrowDown')
      await expect(page.locator('[data-testid="task-row-2"]')).toBeFocused()

      await page.keyboard.press('ArrowUp')
      await expect(page.locator('[data-testid="task-row-1"]')).toBeFocused()
    })

    test('sortable columns should be accessible', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      const sortableHeader = page.locator('[data-testid="sortable-title-header"]')
      await expect(sortableHeader).toHaveAttribute('role', 'button')
      await expect(sortableHeader).toHaveAttribute('aria-sort', 'none')
      await expect(sortableHeader).toHaveAttribute('aria-label', 'Sort by title')

      // Click to sort
      await sortableHeader.click()
      await expect(sortableHeader).toHaveAttribute('aria-sort', 'ascending')
    })
  })

  test.describe('Loading States', () => {
    test('loading indicators should be accessible', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Check loading spinner
      await expect(page.locator('[data-testid="loading-spinner"]')).toHaveAttribute('role', 'progressbar')
      await expect(page.locator('[data-testid="loading-spinner"]')).toHaveAttribute('aria-label', 'Loading tasks')
    })

    test('skeleton loaders should be accessible', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Check skeleton loader
      await expect(page.locator('[data-testid="skeleton-loader"]')).toHaveAttribute('aria-label', 'Loading content')
      await expect(page.locator('[data-testid="skeleton-loader"]')).toHaveAttribute('aria-busy', 'true')
    })
  })

  test.describe('Error States', () => {
    test('error messages should be accessible', async ({ page }) => {
      // Mock error response
      await page.route('**/api/tasks', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Failed to load tasks' })
        })
      })

      await page.goto('/dashboard/tasks')

      // Check error message
      await expect(page.locator('[data-testid="error-message"]')).toHaveAttribute('role', 'alert')
      await expect(page.locator('[data-testid="error-message"]')).toHaveAttribute('aria-live', 'assertive')
    })

    test('error recovery should be accessible', async ({ page }) => {
      // Mock error response
      await page.route('**/api/tasks', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Failed to load tasks' })
        })
      })

      await page.goto('/dashboard/tasks')

      // Check retry button
      await expect(page.locator('[data-testid="retry-button"]')).toHaveAttribute('aria-label', 'Retry loading tasks')
    })
  })

  test.describe('Toast Notifications', () => {
    test('toast notifications should be accessible', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Trigger a toast notification
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: 'Task created successfully', type: 'success' }
        }))
      })

      // Check toast accessibility
      await expect(page.locator('[data-testid="toast-notification"]')).toHaveAttribute('role', 'alert')
      await expect(page.locator('[data-testid="toast-notification"]')).toHaveAttribute('aria-live', 'polite')
    })

    test('toast close button should be accessible', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Trigger a toast notification
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: 'Task created successfully', type: 'success' }
        }))
      })

      // Check close button
      await expect(page.locator('[data-testid="toast-close-button"]')).toHaveAttribute('aria-label', 'Close notification')
    })
  })

  test.describe('Confirmation Dialogs', () => {
    test('confirmation dialogs should be accessible', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Trigger delete confirmation
      const deleteButton = page.locator('[data-testid="delete-task-1"]')
      await deleteButton.click()

      // Check confirmation dialog
      await expect(page.locator('[data-testid="confirmation-dialog"]')).toHaveAttribute('role', 'alertdialog')
      await expect(page.locator('[data-testid="confirmation-dialog"]')).toHaveAttribute('aria-labelledby', 'confirmation-title')
      await expect(page.locator('[data-testid="confirmation-dialog"]')).toHaveAttribute('aria-describedby', 'confirmation-description')
    })

    test('confirmation dialog buttons should be accessible', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      const deleteButton = page.locator('[data-testid="delete-task-1"]')
      await deleteButton.click()

      // Check button labels
      await expect(page.locator('[data-testid="confirm-delete"]')).toHaveAttribute('aria-label', 'Confirm delete task')
      await expect(page.locator('[data-testid="cancel-delete"]')).toHaveAttribute('aria-label', 'Cancel delete task')
    })
  })

  test.describe('Color Contrast', () => {
    test('should meet WCAG AA color contrast requirements', async ({ page }) => {
      await page.goto('/dashboard')

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa', 'wcag21aa'])
        .analyze()

      expect(accessibilityScanResults.violations).toEqual([])
    })

    test('should support high contrast mode', async ({ page }) => {
      // Enable high contrast mode
      await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
      await page.goto('/dashboard')

      // Check high contrast styles are applied
      await expect(page.locator('[data-testid="sidebar"]')).toHaveClass(/high-contrast/)
    })
  })

  test.describe('Reduced Motion', () => {
    test('should respect reduced motion preference', async ({ page }) => {
      // Enable reduced motion
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/dashboard')

      // Check animations are disabled
      await expect(page.locator('[data-testid="animated-element"]')).toHaveClass(/no-animation/)
    })
  })

  test.describe('Mobile Accessibility', () => {
    test('should be accessible on mobile devices', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/dashboard')

      const accessibilityScanResults = await new AxeBuilder({ page })
        .analyze()

      expect(accessibilityScanResults.violations).toEqual([])
    })

    test('should have proper touch targets', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/dashboard')

      // Check touch targets are at least 44px
      const touchTargets = page.locator('[data-testid="touch-target"]')
      const count = await touchTargets.count()

      for (let i = 0; i < count; i++) {
        const element = touchTargets.nth(i)
        const boundingBox = await element.boundingBox()
        expect(boundingBox!.width).toBeGreaterThanOrEqual(44)
        expect(boundingBox!.height).toBeGreaterThanOrEqual(44)
      }
    })
  })
})