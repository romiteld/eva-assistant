import { test, expect, devices } from '@playwright/test'

// Browser-specific test configurations
const browsers = [
  { name: 'Chrome', project: 'chromium' },
  { name: 'Firefox', project: 'firefox' },
  { name: 'Safari', project: 'webkit' },
  { name: 'Edge', project: 'chromium', channel: 'msedge' }
]

const mobileDevices = [
  { name: 'iPhone 12', device: devices['iPhone 12'] },
  { name: 'iPhone SE', device: devices['iPhone SE'] },
  { name: 'Pixel 5', device: devices['Pixel 5'] },
  { name: 'Galaxy S8', device: devices['Galaxy S8'] },
  { name: 'iPad Pro', device: devices['iPad Pro'] },
  { name: 'iPad Mini', device: devices['iPad Mini'] }
]

test.describe('Cross-Browser Compatibility', () => {
  test.describe('Desktop Browser Testing', () => {
    test('Core functionality across browsers', async ({ page, browserName }) => {
      console.log(`Testing on ${browserName}`)
      
      // Basic navigation
      await page.goto('/')
      await expect(page).toHaveTitle(/EVA/)
      
      // Check main elements render
      await expect(page.locator('header')).toBeVisible()
      await expect(page.locator('main')).toBeVisible()
      
      // Navigate to login
      await page.goto('/auth/login')
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible()
      
      // Test form interaction
      await page.fill('[data-testid="email-input"]', 'test@example.com')
      const emailValue = await page.locator('[data-testid="email-input"]').inputValue()
      expect(emailValue).toBe('test@example.com')
      
      // Navigate to dashboard
      await page.goto('/dashboard')
      
      // Check dashboard renders
      await expect(page.locator('[data-testid="dashboard-container"]')).toBeVisible()
      
      // Test tab switching
      const tabs = ['voice', 'lead-generation', 'content-studio', 'tasks']
      for (const tab of tabs) {
        const tabButton = page.locator(`[data-testid="tab-${tab}"]`)
        if (await tabButton.isVisible()) {
          await tabButton.click()
          await page.waitForTimeout(500) // Wait for transition
        }
      }
    })
    
    test('CSS Grid and Flexbox support', async ({ page, browserName }) => {
      await page.goto('/dashboard')
      
      // Check grid layout
      const gridSupport = await page.evaluate(() => {
        const element = document.querySelector('[data-testid="dashboard-grid"]')
        if (!element) return false
        const style = window.getComputedStyle(element)
        return style.display === 'grid'
      })
      
      expect(gridSupport).toBe(true)
      
      // Check flexbox layout
      const flexSupport = await page.evaluate(() => {
        const elements = document.querySelectorAll('[class*="flex"]')
        return elements.length > 0
      })
      
      expect(flexSupport).toBe(true)
    })
    
    test('JavaScript API compatibility', async ({ page, browserName }) => {
      await page.goto('/dashboard')
      
      // Check modern JavaScript features
      const jsFeatures = await page.evaluate(() => {
        return {
          promises: typeof Promise !== 'undefined',
          asyncAwait: (async () => {})().constructor.name === 'Promise',
          fetch: typeof fetch !== 'undefined',
          localStorage: typeof localStorage !== 'undefined',
          sessionStorage: typeof sessionStorage !== 'undefined',
          webSockets: typeof WebSocket !== 'undefined',
          intersectionObserver: typeof IntersectionObserver !== 'undefined',
          resizeObserver: typeof ResizeObserver !== 'undefined'
        }
      })
      
      // All modern browsers should support these
      expect(jsFeatures.promises).toBe(true)
      expect(jsFeatures.asyncAwait).toBe(true)
      expect(jsFeatures.fetch).toBe(true)
      expect(jsFeatures.localStorage).toBe(true)
      expect(jsFeatures.sessionStorage).toBe(true)
      expect(jsFeatures.webSockets).toBe(true)
      
      // These might not be supported in older browsers
      if (browserName !== 'webkit') {
        expect(jsFeatures.resizeObserver).toBe(true)
      }
    })
    
    test('Form validation and inputs', async ({ page, browserName }) => {
      await page.goto('/dashboard/lead-generation')
      
      // Test HTML5 input types
      const inputTypes = ['email', 'tel', 'date', 'number', 'search']
      
      for (const type of inputTypes) {
        const input = page.locator(`input[type="${type}"]`).first()
        if (await input.count() > 0) {
          const isSupported = await input.evaluate((el, type) => {
            return (el as HTMLInputElement).type === type
          }, type)
          
          expect(isSupported).toBe(true)
        }
      }
      
      // Test form validation
      const form = page.locator('form').first()
      if (await form.count() > 0) {
        await form.evaluate(form => {
          (form as HTMLFormElement).checkValidity()
        })
      }
    })
    
    test('Media queries and responsive design', async ({ page, browserName }) => {
      // Test different viewport sizes
      const viewports = [
        { width: 1920, height: 1080, name: 'Desktop HD' },
        { width: 1366, height: 768, name: 'Laptop' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 375, height: 667, name: 'Mobile' }
      ]
      
      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.goto('/dashboard')
        
        // Check responsive classes are applied
        const isMobile = viewport.width < 768
        const sidebarVisible = await page.locator('[data-testid="sidebar"]').isVisible()
        
        if (isMobile) {
          // Sidebar should be hidden or in mobile menu
          const mobileMenu = await page.locator('[data-testid="mobile-menu-button"]').isVisible()
          expect(mobileMenu || !sidebarVisible).toBe(true)
        } else {
          // Sidebar should be visible on desktop
          expect(sidebarVisible).toBe(true)
        }
      }
    })
  })
  
  test.describe('Mobile Browser Testing', () => {
    mobileDevices.forEach(({ name, device }) => {
      test(`Mobile compatibility: ${name}`, async ({ browser }) => {
        const context = await browser.newContext({
          ...device
        })
        const page = await context.newPage()
        
        // Test mobile navigation
        await page.goto('/')
        await expect(page.locator('body')).toBeVisible()
        
        // Check mobile menu
        await page.goto('/dashboard')
        const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]')
        if (await mobileMenuButton.isVisible()) {
          await mobileMenuButton.click()
          await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible()
        }
        
        // Test touch interactions
        const touchTarget = page.locator('[data-testid="touch-target"]').first()
        if (await touchTarget.count() > 0) {
          await touchTarget.tap()
        }
        
        // Test swipe gestures if implemented
        const swipeableElement = page.locator('[data-testid="swipeable"]').first()
        if (await swipeableElement.count() > 0) {
          const box = await swipeableElement.boundingBox()
          if (box) {
            await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2)
            await page.mouse.down()
            await page.mouse.move(box.x + 10, box.y + box.height / 2)
            await page.mouse.up()
          }
        }
        
        await context.close()
      })
    })
    
    test('Mobile-specific features', async ({ browser }) => {
      const iPhone = devices['iPhone 12']
      const context = await browser.newContext({
        ...iPhone,
        permissions: ['geolocation'],
        geolocation: { latitude: 40.7128, longitude: -74.0060 }
      })
      const page = await context.newPage()
      
      await page.goto('/dashboard')
      
      // Test viewport meta tag
      const hasViewportMeta = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]')
        return meta !== null
      })
      expect(hasViewportMeta).toBe(true)
      
      // Test touch-specific CSS
      const hasTouchStyles = await page.evaluate(() => {
        const styles = Array.from(document.styleSheets)
        return styles.some(sheet => {
          try {
            const rules = Array.from(sheet.cssRules || [])
            return rules.some(rule => 
              rule.cssText?.includes('touch-action') || 
              rule.cssText?.includes('-webkit-tap-highlight-color')
            )
          } catch {
            return false
          }
        })
      })
      
      await context.close()
    })
  })
  
  test.describe('Browser-Specific Features', () => {
    test('Service Worker support', async ({ page, browserName }) => {
      await page.goto('/')
      
      const hasServiceWorker = await page.evaluate(() => {
        return 'serviceWorker' in navigator
      })
      
      // All modern browsers should support service workers
      expect(hasServiceWorker).toBe(true)
      
      // Check if service worker is registered
      const swRegistered = await page.evaluate(async () => {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations()
          return registrations.length > 0
        }
        return false
      })
      
      console.log(`Service Worker registered in ${browserName}: ${swRegistered}`)
    })
    
    test('WebSocket compatibility', async ({ page, browserName }) => {
      await page.goto('/dashboard')
      
      const wsSupport = await page.evaluate(() => {
        try {
          const ws = new WebSocket('wss://echo.websocket.org')
          ws.close()
          return true
        } catch {
          return false
        }
      })
      
      expect(wsSupport).toBe(true)
    })
    
    test('Local storage and cookies', async ({ page, browserName }) => {
      await page.goto('/dashboard')
      
      // Test localStorage
      await page.evaluate(() => {
        localStorage.setItem('test-key', 'test-value')
      })
      
      const localStorageValue = await page.evaluate(() => {
        return localStorage.getItem('test-key')
      })
      
      expect(localStorageValue).toBe('test-value')
      
      // Test cookies
      await page.context().addCookies([{
        name: 'test-cookie',
        value: 'test-value',
        domain: 'localhost',
        path: '/'
      }])
      
      const cookies = await page.context().cookies()
      const testCookie = cookies.find(c => c.name === 'test-cookie')
      expect(testCookie?.value).toBe('test-value')
    })
  })
  
  test.describe('Console Error Detection', () => {
    test('No console errors across browsers', async ({ page, browserName }) => {
      const consoleErrors: string[] = []
      
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(`[${browserName}] ${msg.text()}`)
        }
      })
      
      page.on('pageerror', error => {
        consoleErrors.push(`[${browserName}] Page error: ${error.message}`)
      })
      
      // Navigate through main pages
      const pages = ['/', '/dashboard', '/dashboard/voice', '/dashboard/lead-generation']
      
      for (const pagePath of pages) {
        await page.goto(pagePath)
        await page.waitForLoadState('networkidle')
      }
      
      // Check for errors
      console.log(`Console errors in ${browserName}:`, consoleErrors)
      expect(consoleErrors.length).toBe(0)
    })
  })
})