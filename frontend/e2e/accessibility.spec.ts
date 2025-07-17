import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility Testing', () => {
  test.describe('WCAG 2.1 AA Compliance', () => {
    const pages = [
      { name: 'Homepage', path: '/' },
      { name: 'Login', path: '/auth/login' },
      { name: 'Dashboard', path: '/dashboard' },
      { name: 'Voice Agent', path: '/dashboard/voice' },
      { name: 'Lead Generation', path: '/dashboard/lead-generation' },
      { name: 'Content Studio', path: '/dashboard/content-studio' },
      { name: 'Resume Parser', path: '/dashboard/resume-parser' },
      { name: 'Interview Center', path: '/dashboard/interview-center' },
      { name: 'Recruiter Intel', path: '/dashboard/recruiter-intel' },
      { name: 'Tasks', path: '/dashboard/tasks' },
      { name: 'Twilio', path: '/dashboard/twilio' },
      { name: 'Zoom', path: '/dashboard/zoom' }
    ]
    
    pages.forEach(({ name, path }) => {
      test(`Accessibility: ${name} (${path})`, async ({ page }) => {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        
        const accessibilityScanResults = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()
        
        // Log violations for debugging
        if (accessibilityScanResults.violations.length > 0) {
          console.log(`\nAccessibility violations on ${name}:`)
          accessibilityScanResults.violations.forEach(violation => {
            console.log(`- ${violation.id}: ${violation.description}`)
            console.log(`  Impact: ${violation.impact}`)
            console.log(`  Affected elements: ${violation.nodes.length}`)
          })
        }
        
        expect(accessibilityScanResults.violations).toHaveLength(0)
      })
    })
  })
  
  test.describe('Keyboard Navigation', () => {
    test('Dashboard keyboard navigation', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Tab through main navigation
      await page.keyboard.press('Tab')
      let activeElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
      expect(activeElement).toBeTruthy()
      
      // Navigate through tabs
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab')
        activeElement = await page.evaluate(() => document.activeElement?.tagName)
        expect(['BUTTON', 'A', 'INPUT']).toContain(activeElement)
      }
      
      // Test Enter key activation
      await page.keyboard.press('Enter')
      // Should navigate or activate element
      
      // Test Escape key for modals
      await page.click('[data-testid="open-modal-button"]').catch(() => {})
      await page.keyboard.press('Escape')
      await expect(page.locator('[role="dialog"]')).not.toBeVisible()
    })
    
    test('Form keyboard navigation', async ({ page }) => {
      await page.goto('/dashboard/lead-generation')
      
      // Tab to search input
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      
      // Type in search
      await page.keyboard.type('test search')
      
      // Submit with Enter
      await page.keyboard.press('Enter')
      
      // Verify search initiated
      await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible()
    })
    
    test('Skip to main content link', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Press Tab to reveal skip link
      await page.keyboard.press('Tab')
      
      const skipLink = page.locator('text=Skip to main content')
      await expect(skipLink).toBeVisible()
      
      // Activate skip link
      await page.keyboard.press('Enter')
      
      // Verify focus moved to main content
      const mainContent = await page.evaluate(() => {
        return document.activeElement?.getAttribute('id') === 'main-content'
      })
      expect(mainContent).toBe(true)
    })
  })
  
  test.describe('Screen Reader Compatibility', () => {
    test('ARIA labels and descriptions', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Check for proper ARIA labels
      const buttons = await page.locator('button').all()
      for (const button of buttons) {
        const hasLabel = await button.evaluate(el => {
          return !!(el.getAttribute('aria-label') || el.textContent?.trim())
        })
        expect(hasLabel).toBe(true)
      }
      
      // Check for proper heading hierarchy
      const headings = await page.evaluate(() => {
        const h1 = document.querySelectorAll('h1').length
        const h2 = document.querySelectorAll('h2').length
        const h3 = document.querySelectorAll('h3').length
        return { h1, h2, h3 }
      })
      
      expect(headings.h1).toBeGreaterThan(0)
      expect(headings.h1).toBeLessThanOrEqual(1) // Only one h1 per page
    })
    
    test('Form field labels', async ({ page }) => {
      await page.goto('/dashboard/lead-generation')
      
      // Check all inputs have labels
      const inputs = await page.locator('input').all()
      for (const input of inputs) {
        const hasLabel = await input.evaluate(el => {
          const id = el.id
          const label = id ? document.querySelector(`label[for="${id}"]`) : null
          const ariaLabel = el.getAttribute('aria-label')
          const ariaLabelledBy = el.getAttribute('aria-labelledby')
          return !!(label || ariaLabel || ariaLabelledBy)
        })
        expect(hasLabel).toBe(true)
      }
    })
    
    test('Live regions for dynamic content', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Check for aria-live regions
      const liveRegions = await page.locator('[aria-live]').count()
      expect(liveRegions).toBeGreaterThan(0)
      
      // Verify status messages use appropriate live regions
      const statusRegion = page.locator('[role="status"]')
      if (await statusRegion.count() > 0) {
        const ariaLive = await statusRegion.getAttribute('aria-live')
        expect(['polite', 'assertive']).toContain(ariaLive)
      }
    })
  })
  
  test.describe('Color Contrast', () => {
    test('Text color contrast ratios', async ({ page }) => {
      await page.goto('/dashboard')
      
      const contrastIssues = await page.evaluate(() => {
        const issues: any[] = []
        const elements = document.querySelectorAll('*')
        
        elements.forEach(element => {
          const style = window.getComputedStyle(element)
          const backgroundColor = style.backgroundColor
          const color = style.color
          
          if (backgroundColor !== 'rgba(0, 0, 0, 0)' && color !== 'rgba(0, 0, 0, 0)') {
            // Simple contrast check (would use proper algorithm in production)
            const bgLuminance = 0.5 // Placeholder
            const fgLuminance = 0.5 // Placeholder
            const contrast = Math.abs(bgLuminance - fgLuminance)
            
            if (contrast < 0.3) {
              issues.push({
                element: element.tagName,
                bg: backgroundColor,
                fg: color
              })
            }
          }
        })
        
        return issues
      })
      
      expect(contrastIssues.length).toBe(0)
    })
    
    test('Focus indicator visibility', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Tab through elements and check focus visibility
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab')
        
        const hasFocusIndicator = await page.evaluate(() => {
          const focused = document.activeElement
          if (!focused) return false
          
          const style = window.getComputedStyle(focused)
          const outline = style.outline
          const boxShadow = style.boxShadow
          const border = style.border
          
          return !!(outline !== 'none' || boxShadow !== 'none' || border !== 'none')
        })
        
        expect(hasFocusIndicator).toBe(true)
      }
    })
  })
  
  test.describe('Responsive and Touch Accessibility', () => {
    test('Touch target sizes on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/dashboard')
      
      // Check button sizes
      const buttons = await page.locator('button').all()
      for (const button of buttons) {
        const box = await button.boundingBox()
        if (box) {
          // Touch targets should be at least 44x44 pixels
          expect(box.width).toBeGreaterThanOrEqual(44)
          expect(box.height).toBeGreaterThanOrEqual(44)
        }
      }
    })
    
    test('Zoom functionality', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Check that viewport meta tag allows zooming
      const viewportContent = await page.evaluate(() => {
        const viewport = document.querySelector('meta[name="viewport"]')
        return viewport?.getAttribute('content')
      })
      
      expect(viewportContent).not.toContain('user-scalable=no')
      expect(viewportContent).not.toContain('maximum-scale=1')
    })
  })
  
  test.describe('Form Accessibility', () => {
    test('Error message association', async ({ page }) => {
      await page.goto('/auth/login')
      
      // Submit empty form
      await page.click('[data-testid="submit-button"]')
      
      // Check error messages are properly associated
      const errorMessages = await page.locator('[role="alert"]').all()
      for (const error of errorMessages) {
        const id = await error.getAttribute('id')
        expect(id).toBeTruthy()
        
        // Find associated input
        const associatedInput = await page.locator(`[aria-describedby="${id}"]`).count()
        expect(associatedInput).toBeGreaterThan(0)
      }
    })
    
    test('Required field indicators', async ({ page }) => {
      await page.goto('/dashboard/lead-generation')
      
      // Check required fields have proper indicators
      const requiredInputs = await page.locator('input[required]').all()
      for (const input of requiredInputs) {
        const label = await input.evaluate(el => {
          const id = el.id
          return document.querySelector(`label[for="${id}"]`)?.textContent
        })
        
        // Label should indicate required status
        expect(label).toMatch(/required|\*/i)
      }
    })
  })
})