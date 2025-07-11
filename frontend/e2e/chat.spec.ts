import { test, expect } from '@playwright/test'

test.describe('Chat Interface Flow', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock authenticated state
    await context.addCookies([
      {
        name: 'sb-auth-token',
        value: 'mock-auth-token',
        domain: 'localhost',
        path: '/',
      },
    ])
  })

  test('should display chat interface', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Open chat interface
    await page.getByRole('button', { name: /open chat/i }).click()
    
    // Check chat elements
    await expect(page.getByTestId('chat-interface')).toBeVisible()
    await expect(page.getByPlaceholder(/type a message/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /send/i })).toBeVisible()
  })

  test('should send and receive messages', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: /open chat/i }).click()
    
    // Send a message
    const messageInput = page.getByPlaceholder(/type a message/i)
    await messageInput.fill('Hello, EVA!')
    await page.getByRole('button', { name: /send/i }).click()
    
    // Check message appears in chat
    await expect(page.getByText('Hello, EVA!')).toBeVisible()
    
    // Wait for AI response
    await expect(page.getByTestId('ai-message')).toBeVisible({ timeout: 10000 })
  })

  test('should handle file uploads', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: /open chat/i }).click()
    
    // Upload a file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('test content'),
    })
    
    // Check file preview appears
    await expect(page.getByText('test.pdf')).toBeVisible()
    
    // Send message with file
    await page.getByPlaceholder(/type a message/i).fill('Please analyze this document')
    await page.getByRole('button', { name: /send/i }).click()
    
    // Check for processing indicator
    await expect(page.getByText(/processing document/i)).toBeVisible()
  })

  test('should show typing indicator', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: /open chat/i }).click()
    
    // Send a message
    await page.getByPlaceholder(/type a message/i).fill('Complex question')
    await page.getByRole('button', { name: /send/i }).click()
    
    // Check typing indicator appears
    await expect(page.getByTestId('typing-indicator')).toBeVisible()
    
    // Typing indicator should disappear when response arrives
    await expect(page.getByTestId('typing-indicator')).not.toBeVisible({ timeout: 10000 })
  })

  test('should handle command shortcuts', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: /open chat/i }).click()
    
    // Type a command
    const messageInput = page.getByPlaceholder(/type a message/i)
    await messageInput.fill('/help')
    await page.getByRole('button', { name: /send/i }).click()
    
    // Check help menu appears
    await expect(page.getByText(/available commands/i)).toBeVisible()
    await expect(page.getByText(/\/task/i)).toBeVisible()
    await expect(page.getByText(/\/search/i)).toBeVisible()
    await expect(page.getByText(/\/schedule/i)).toBeVisible()
  })

  test('should create task from chat', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: /open chat/i }).click()
    
    // Use task command
    await page.getByPlaceholder(/type a message/i).fill('/task Create presentation for Monday meeting')
    await page.getByRole('button', { name: /send/i }).click()
    
    // Check task creation confirmation
    await expect(page.getByText(/task created/i)).toBeVisible()
    
    // Navigate to tasks and verify
    await page.getByRole('tab', { name: /tasks/i }).click()
    await expect(page.getByText('Create presentation for Monday meeting')).toBeVisible()
  })

  test('should maintain chat history', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: /open chat/i }).click()
    
    // Send multiple messages
    const messages = ['First message', 'Second message', 'Third message']
    
    for (const message of messages) {
      await page.getByPlaceholder(/type a message/i).fill(message)
      await page.getByRole('button', { name: /send/i }).click()
      await page.waitForTimeout(1000) // Wait between messages
    }
    
    // Check all messages are visible
    for (const message of messages) {
      await expect(page.getByText(message)).toBeVisible()
    }
    
    // Refresh page
    await page.reload()
    await page.getByRole('button', { name: /open chat/i }).click()
    
    // History should persist
    for (const message of messages) {
      await expect(page.getByText(message)).toBeVisible()
    }
  })

  test('should handle errors in chat', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: /open chat/i }).click()
    
    // Simulate error by going offline
    await page.context().setOffline(true)
    
    // Try to send message
    await page.getByPlaceholder(/type a message/i).fill('Test message')
    await page.getByRole('button', { name: /send/i }).click()
    
    // Should show error message
    await expect(page.getByText(/failed to send message/i)).toBeVisible()
    
    // Go back online
    await page.context().setOffline(false)
    
    // Retry should work
    await page.getByRole('button', { name: /retry/i }).click()
    await expect(page.getByText(/message sent/i)).toBeVisible()
  })

  test('should support markdown in responses', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: /open chat/i }).click()
    
    // Send a message that would generate markdown response
    await page.getByPlaceholder(/type a message/i).fill('Show me a code example')
    await page.getByRole('button', { name: /send/i }).click()
    
    // Wait for response
    await page.waitForSelector('[data-testid="ai-message"]', { timeout: 10000 })
    
    // Check for markdown elements
    const aiMessage = page.locator('[data-testid="ai-message"]').last()
    await expect(aiMessage.locator('pre')).toBeVisible() // Code block
    await expect(aiMessage.locator('code')).toBeVisible() // Inline code
  })

  test('should handle voice input', async ({ page, browserName }) => {
    // Skip on Firefox as it doesn't support Web Speech API in tests
    test.skip(browserName === 'firefox', 'Voice input not supported in Firefox tests')
    
    await page.goto('/dashboard')
    await page.getByRole('button', { name: /open chat/i }).click()
    
    // Click voice input button
    await page.getByRole('button', { name: /voice input/i }).click()
    
    // Check recording indicator
    await expect(page.getByTestId('recording-indicator')).toBeVisible()
    
    // Stop recording
    await page.getByRole('button', { name: /stop recording/i }).click()
    
    // Check transcription appears
    await expect(page.getByPlaceholder(/type a message/i)).not.toBeEmpty()
  })
})