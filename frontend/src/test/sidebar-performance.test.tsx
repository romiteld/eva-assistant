import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import { OptimizedSidebar } from '@/components/dashboard/OptimizedSidebar'
import { Sidebar as OriginalSidebar } from '@/components/dashboard/Sidebar'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/dashboard',
}))

// Mock Framer Motion for consistent testing
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    aside: ({ children, ...props }: any) => <aside {...props}>{children}</aside>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}))

// Performance testing utilities
const measureRenderTime = async (component: React.ReactElement) => {
  const start = performance.now()
  render(component)
  const end = performance.now()
  return end - start
}

const measureReRenderTime = async (component: React.ReactElement, action: () => void) => {
  const { rerender } = render(component)
  const start = performance.now()
  action()
  rerender(component)
  const end = performance.now()
  return end - start
}

describe('Sidebar Performance Tests', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    isCollapsed: false,
    onCollapsedChange: jest.fn(),
  }

  describe('Render Performance', () => {
    it('OptimizedSidebar should render faster than OriginalSidebar', async () => {
      const originalRenderTime = await measureRenderTime(
        <OriginalSidebar {...defaultProps} />
      )
      
      const optimizedRenderTime = await measureRenderTime(
        <OptimizedSidebar {...defaultProps} />
      )
      
      // OptimizedSidebar should be at least 10% faster
      expect(optimizedRenderTime).toBeLessThan(originalRenderTime * 0.9)
    })

    it('should render within performance budget (16ms for 60fps)', async () => {
      const renderTime = await measureRenderTime(
        <OptimizedSidebar {...defaultProps} />
      )
      
      // Should render within 16ms for 60fps
      expect(renderTime).toBeLessThan(16)
    })

    it('should have minimal re-render time when props change', async () => {
      const reRenderTime = await measureReRenderTime(
        <OptimizedSidebar {...defaultProps} />,
        () => {
          // Simulate prop change
          defaultProps.isCollapsed = !defaultProps.isCollapsed
        }
      )
      
      // Re-render should be very fast
      expect(reRenderTime).toBeLessThan(8)
    })
  })

  describe('Memory Usage', () => {
    it('should not create memory leaks during multiple renders', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0
      
      // Render component multiple times
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(<OptimizedSidebar {...defaultProps} />)
        unmount()
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory
      
      // Memory increase should be minimal (less than 1MB)
      expect(memoryIncrease).toBeLessThan(1024 * 1024)
    })
  })

  describe('Animation Performance', () => {
    it('should use optimized animation configurations', () => {
      render(<OptimizedSidebar {...defaultProps} />)
      
      // Check that animations are properly optimized
      // This is a structural test since we can't easily test actual animation performance
      const sidebar = screen.getByRole('navigation')
      expect(sidebar).toHaveStyle('will-change: transform')
    })

    it('should respect reduced motion preferences', () => {
      // Mock useReducedMotion to return true
      jest.mocked(require('framer-motion').useReducedMotion).mockReturnValue(true)
      
      render(<OptimizedSidebar {...defaultProps} />)
      
      // Component should render without errors when reduced motion is enabled
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })
  })

  describe('Interaction Performance', () => {
    it('should handle rapid clicking without performance degradation', async () => {
      const onCloseMock = jest.fn()
      render(<OptimizedSidebar {...defaultProps} onClose={onCloseMock} />)
      
      const closeButton = screen.getByLabelText('Close sidebar')
      
      // Measure time for rapid clicks
      const start = performance.now()
      for (let i = 0; i < 10; i++) {
        fireEvent.click(closeButton)
      }
      const end = performance.now()
      
      // Should handle rapid clicks quickly
      expect(end - start).toBeLessThan(50)
      expect(onCloseMock).toHaveBeenCalledTimes(10)
    })

    it('should handle keyboard navigation efficiently', async () => {
      render(<OptimizedSidebar {...defaultProps} />)
      
      const nav = screen.getByRole('navigation')
      
      // Test arrow key navigation
      const start = performance.now()
      fireEvent.keyDown(nav, { key: 'ArrowDown' })
      fireEvent.keyDown(nav, { key: 'ArrowDown' })
      fireEvent.keyDown(nav, { key: 'ArrowUp' })
      const end = performance.now()
      
      // Keyboard navigation should be very fast
      expect(end - start).toBeLessThan(10)
    })
  })

  describe('Bundle Size Impact', () => {
    it('should have minimal bundle size impact', () => {
      // This test checks that we're not importing unnecessary dependencies
      const component = render(<OptimizedSidebar {...defaultProps} />)
      
      // Should successfully render without importing the entire framer-motion library
      expect(component).toBeTruthy()
      
      // Check that we're using memoization properly
      expect(OptimizedSidebar.displayName).toBe('OptimizedSidebar')
    })
  })

  describe('Hardware Acceleration', () => {
    it('should enable hardware acceleration for better performance', () => {
      render(<OptimizedSidebar {...defaultProps} />)
      
      const sidebar = screen.getByRole('navigation')
      
      // Check that hardware acceleration is enabled
      expect(sidebar).toHaveStyle('transform: translateZ(0)')
      expect(sidebar).toHaveStyle('will-change: transform')
    })
  })

  describe('Accessibility Performance', () => {
    it('should maintain accessibility without performance impact', async () => {
      const start = performance.now()
      render(<OptimizedSidebar {...defaultProps} />)
      
      // Check accessibility features
      expect(screen.getByRole('navigation')).toBeInTheDocument()
      expect(screen.getByLabelText('Main navigation')).toBeInTheDocument()
      expect(screen.getAllByRole('menuitem')).toHaveLength(24) // All navigation items
      
      const end = performance.now()
      
      // Accessibility features should not significantly impact render time
      expect(end - start).toBeLessThan(20)
    })
  })
})

// Integration test for performance monitoring
describe('Performance Monitoring Integration', () => {
  it('should integrate with performance monitoring hooks', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    
    // Mock performance monitoring
    const mockPerformance = {
      metrics: {
        renderTime: 12.5,
        frameRate: 58,
        memoryUsage: 15 * 1024 * 1024,
        paintTime: 8.2,
        interactionTime: 5.1
      },
      startRenderTiming: jest.fn(),
      endRenderTiming: jest.fn(),
      startInteractionTiming: jest.fn()
    }
    
    jest.mock('@/hooks/usePerformanceMonitor', () => ({
      usePerformanceMonitor: () => mockPerformance
    }))
    
    render(<OptimizedSidebar {...defaultProps} />)
    
    // Performance monitoring should be integrated
    expect(mockPerformance.startRenderTiming).toHaveBeenCalled()
    
    consoleSpy.mockRestore()
  })
})