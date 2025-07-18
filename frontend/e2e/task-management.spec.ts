import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'

test.describe('Task Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        refresh_token: 'mock-refresh-token',
        user: { id: 'user-123', email: 'test@example.com' }
      }))
    })

    // Mock tasks API
    await page.route('**/api/tasks', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            tasks: [
              {
                id: 'task-1',
                title: 'Complete project proposal',
                description: 'Write and submit the Q1 project proposal',
                status: 'pending',
                priority: 'high',
                due_date: '2024-01-15T10:00:00Z',
                created_at: '2024-01-01T10:00:00Z',
                updated_at: '2024-01-01T10:00:00Z',
              },
              {
                id: 'task-2',
                title: 'Review client feedback',
                description: 'Analyze and respond to client feedback',
                status: 'in_progress',
                priority: 'medium',
                due_date: '2024-01-10T15:00:00Z',
                created_at: '2024-01-01T11:00:00Z',
                updated_at: '2024-01-02T09:00:00Z',
              },
            ]
          })
        })
      }
    })
  })

  test.describe('Task List View', () => {
    test('should display task list', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Check for task list elements
      await expect(page.locator('text=Complete project proposal')).toBeVisible()
      await expect(page.locator('text=Review client feedback')).toBeVisible()
      await expect(page.locator('[data-testid="task-status-pending"]')).toBeVisible()
      await expect(page.locator('[data-testid="task-status-in_progress"]')).toBeVisible()
    })

    test('should show task priorities with correct colors', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Check priority indicators
      await expect(page.locator('[data-testid="priority-high"]')).toBeVisible()
      await expect(page.locator('[data-testid="priority-medium"]')).toBeVisible()
      
      // Check priority colors
      const highPriorityTask = page.locator('[data-testid="priority-high"]').first()
      await expect(highPriorityTask).toHaveClass(/bg-red-100/)
    })

    test('should display due dates', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      await expect(page.locator('text=Due: Jan 15, 2024')).toBeVisible()
      await expect(page.locator('text=Due: Jan 10, 2024')).toBeVisible()
    })

    test('should filter tasks by status', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Click on pending filter
      const pendingFilter = page.locator('[data-testid="filter-pending"]')
      await pendingFilter.click()

      // Should show only pending tasks
      await expect(page.locator('text=Complete project proposal')).toBeVisible()
      await expect(page.locator('text=Review client feedback')).not.toBeVisible()
    })

    test('should sort tasks by due date', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Click sort dropdown
      const sortDropdown = page.locator('[data-testid="sort-dropdown"]')
      await sortDropdown.click()

      // Select due date sort
      const dueDateSort = page.locator('[data-testid="sort-due-date"]')
      await dueDateSort.click()

      // Check that tasks are sorted by due date
      const taskTitles = page.locator('[data-testid="task-title"]')
      await expect(taskTitles.first()).toHaveText('Review client feedback') // Due Jan 10
      await expect(taskTitles.last()).toHaveText('Complete project proposal') // Due Jan 15
    })
  })

  test.describe('Task Creation', () => {
    test('should open create task modal', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      const createButton = page.locator('[data-testid="create-task-button"]')
      await createButton.click()

      await expect(page.locator('[data-testid="create-task-modal"]')).toBeVisible()
      await expect(page.locator('text=Create New Task')).toBeVisible()
    })

    test('should create a new task', async ({ page }) => {
      // Mock task creation
      await page.route('**/api/tasks', async route => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              task: {
                id: 'task-3',
                title: 'New Test Task',
                description: 'Test task description',
                status: 'pending',
                priority: 'medium',
                due_date: '2024-01-20T10:00:00Z',
                created_at: '2024-01-01T12:00:00Z',
                updated_at: '2024-01-01T12:00:00Z',
              }
            })
          })
        }
      })

      await page.goto('/dashboard/tasks')

      // Open create modal
      const createButton = page.locator('[data-testid="create-task-button"]')
      await createButton.click()

      // Fill form
      await page.locator('[data-testid="task-title-input"]').fill('New Test Task')
      await page.locator('[data-testid="task-description-input"]').fill('Test task description')
      
      // Select priority
      const prioritySelect = page.locator('[data-testid="priority-select"]')
      await prioritySelect.click()
      await page.locator('[data-testid="priority-medium"]').click()

      // Set due date
      await page.locator('[data-testid="due-date-input"]').fill('2024-01-20')

      // Submit form
      const submitButton = page.locator('[data-testid="submit-task-button"]')
      await submitButton.click()

      // Check success message
      await expect(page.locator('text=Task created successfully')).toBeVisible()
      await expect(page.locator('[data-testid="create-task-modal"]')).not.toBeVisible()
    })

    test('should validate required fields', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Open create modal
      const createButton = page.locator('[data-testid="create-task-button"]')
      await createButton.click()

      // Try to submit without filling required fields
      const submitButton = page.locator('[data-testid="submit-task-button"]')
      await submitButton.click()

      // Check validation messages
      await expect(page.locator('text=Title is required')).toBeVisible()
    })

    test('should handle creation errors', async ({ page }) => {
      // Mock error response
      await page.route('**/api/tasks', async route => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Failed to create task'
            })
          })
        }
      })

      await page.goto('/dashboard/tasks')

      // Open create modal and fill form
      const createButton = page.locator('[data-testid="create-task-button"]')
      await createButton.click()

      await page.locator('[data-testid="task-title-input"]').fill('New Test Task')
      await page.locator('[data-testid="task-description-input"]').fill('Test task description')

      // Submit form
      const submitButton = page.locator('[data-testid="submit-task-button"]')
      await submitButton.click()

      // Check error message
      await expect(page.locator('text=Failed to create task')).toBeVisible()
    })
  })

  test.describe('Task Updates', () => {
    test('should update task status', async ({ page }) => {
      // Mock task update
      await page.route('**/api/tasks?id=task-1', async route => {
        if (route.request().method() === 'PUT') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              task: {
                id: 'task-1',
                title: 'Complete project proposal',
                description: 'Write and submit the Q1 project proposal',
                status: 'completed',
                priority: 'high',
                due_date: '2024-01-15T10:00:00Z',
              }
            })
          })
        }
      })

      await page.goto('/dashboard/tasks')

      // Click on task status dropdown
      const statusDropdown = page.locator('[data-testid="task-1-status"]')
      await statusDropdown.click()

      // Select completed status
      const completedOption = page.locator('[data-testid="status-completed"]')
      await completedOption.click()

      // Check success message
      await expect(page.locator('text=Task updated successfully')).toBeVisible()
      await expect(page.locator('[data-testid="task-status-completed"]')).toBeVisible()
    })

    test('should edit task details', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Click edit button on first task
      const editButton = page.locator('[data-testid="edit-task-1"]')
      await editButton.click()

      // Check edit modal is open
      await expect(page.locator('[data-testid="edit-task-modal"]')).toBeVisible()
      await expect(page.locator('text=Edit Task')).toBeVisible()

      // Fields should be pre-populated
      await expect(page.locator('[data-testid="task-title-input"]')).toHaveValue('Complete project proposal')
      await expect(page.locator('[data-testid="task-description-input"]')).toHaveValue('Write and submit the Q1 project proposal')
    })

    test('should delete task', async ({ page }) => {
      // Mock task deletion
      await page.route('**/api/tasks?id=task-1', async route => {
        if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              message: 'Task deleted successfully'
            })
          })
        }
      })

      await page.goto('/dashboard/tasks')

      // Click delete button
      const deleteButton = page.locator('[data-testid="delete-task-1"]')
      await deleteButton.click()

      // Confirm deletion
      const confirmButton = page.locator('[data-testid="confirm-delete"]')
      await confirmButton.click()

      // Check success message
      await expect(page.locator('text=Task deleted successfully')).toBeVisible()
    })
  })

  test.describe('Task Search and Filtering', () => {
    test('should search tasks by title', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Type in search input
      const searchInput = page.locator('[data-testid="task-search-input"]')
      await searchInput.fill('project')

      // Should show only matching tasks
      await expect(page.locator('text=Complete project proposal')).toBeVisible()
      await expect(page.locator('text=Review client feedback')).not.toBeVisible()
    })

    test('should filter by priority', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Click priority filter
      const priorityFilter = page.locator('[data-testid="filter-priority"]')
      await priorityFilter.click()

      // Select high priority
      const highPriorityOption = page.locator('[data-testid="priority-high-filter"]')
      await highPriorityOption.click()

      // Should show only high priority tasks
      await expect(page.locator('text=Complete project proposal')).toBeVisible()
      await expect(page.locator('text=Review client feedback')).not.toBeVisible()
    })

    test('should filter by due date range', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Open date range filter
      const dateFilter = page.locator('[data-testid="date-range-filter"]')
      await dateFilter.click()

      // Set date range
      await page.locator('[data-testid="start-date"]').fill('2024-01-01')
      await page.locator('[data-testid="end-date"]').fill('2024-01-12')

      // Apply filter
      const applyButton = page.locator('[data-testid="apply-date-filter"]')
      await applyButton.click()

      // Should show only tasks within date range
      await expect(page.locator('text=Review client feedback')).toBeVisible() // Due Jan 10
      await expect(page.locator('text=Complete project proposal')).not.toBeVisible() // Due Jan 15
    })

    test('should clear all filters', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Apply a filter
      const pendingFilter = page.locator('[data-testid="filter-pending"]')
      await pendingFilter.click()

      // Clear all filters
      const clearButton = page.locator('[data-testid="clear-filters"]')
      await clearButton.click()

      // Should show all tasks
      await expect(page.locator('text=Complete project proposal')).toBeVisible()
      await expect(page.locator('text=Review client feedback')).toBeVisible()
    })
  })

  test.describe('Keyboard Navigation', () => {
    test('should support keyboard navigation', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Test tabbing through tasks
      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="create-task-button"]')).toBeFocused()

      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="task-search-input"]')).toBeFocused()

      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="edit-task-1"]')).toBeFocused()
    })

    test('should handle keyboard shortcuts', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Test keyboard shortcut to create task
      await page.keyboard.press('Control+n')
      await expect(page.locator('[data-testid="create-task-modal"]')).toBeVisible()

      // Test Escape to close modal
      await page.keyboard.press('Escape')
      await expect(page.locator('[data-testid="create-task-modal"]')).not.toBeVisible()
    })
  })

  test.describe('Accessibility', () => {
    test('should be accessible', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[data-testid="task-list"]')
        .analyze()

      expect(accessibilityScanResults.violations).toEqual([])
    })

    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      await expect(page.locator('[data-testid="create-task-button"]')).toHaveAttribute('aria-label', 'Create new task')
      await expect(page.locator('[data-testid="task-search-input"]')).toHaveAttribute('aria-label', 'Search tasks')
    })

    test('should announce status changes to screen readers', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Check for live region for status updates
      await expect(page.locator('[aria-live="polite"]')).toBeVisible()
    })
  })

  test.describe('Real-time Updates', () => {
    test('should update task list in real-time', async ({ page }) => {
      await page.goto('/dashboard/tasks')

      // Simulate real-time update
      await page.evaluate(() => {
        const event = new CustomEvent('task-updated', {
          detail: {
            id: 'task-1',
            title: 'Updated Task Title',
            status: 'completed'
          }
        })
        window.dispatchEvent(event)
      })

      // Check that task is updated
      await expect(page.locator('text=Updated Task Title')).toBeVisible()
      await expect(page.locator('[data-testid="task-status-completed"]')).toBeVisible()
    })
  })

  test.describe('Mobile Responsiveness', () => {
    test('should be responsive on mobile devices', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/dashboard/tasks')

      // Check that mobile layout is applied
      await expect(page.locator('[data-testid="mobile-task-list"]')).toBeVisible()
      await expect(page.locator('[data-testid="mobile-create-button"]')).toBeVisible()
    })

    test('should handle mobile interactions', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/dashboard/tasks')

      // Test swipe gestures on mobile
      const taskCard = page.locator('[data-testid="task-card-1"]')
      
      // Simulate swipe left gesture with mouse drag
      const box = await taskCard.boundingBox()
      if (box) {
        await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + 10, box.y + box.height / 2)
        await page.mouse.up()
      }

      // Should reveal action buttons
      await expect(page.locator('[data-testid="mobile-task-actions"]')).toBeVisible()
    })
  })
})