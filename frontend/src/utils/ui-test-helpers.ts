/**
 * UI/UX Testing Helpers
 * Utility functions to help test responsive design, accessibility, and performance
 */

// Check if element is visible in viewport
export const isElementInViewport = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
};

// Check touch target size (minimum 44x44px for accessibility)
export const checkTouchTargetSize = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  return rect.width >= 44 && rect.height >= 44;
};

// Get color contrast ratio
export const getContrastRatio = (color1: string, color2: string): number => {
  // Convert hex to RGB
  const getRGB = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  // Calculate relative luminance
  const getLuminance = (rgb: { r: number; g: number; b: number }) => {
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const rgb1 = getRGB(color1);
  const rgb2 = getRGB(color2);
  
  if (!rgb1 || !rgb2) return 0;

  const lum1 = getLuminance(rgb1);
  const lum2 = getLuminance(rgb2);
  
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  
  return (brightest + 0.05) / (darkest + 0.05);
};

// Check for missing ARIA labels
export const checkAccessibility = (container: HTMLElement) => {
  const issues: string[] = [];
  
  // Check buttons without text or aria-label
  const buttons = container.querySelectorAll('button');
  buttons.forEach((button) => {
    if (!button.textContent?.trim() && !button.getAttribute('aria-label')) {
      issues.push(`Button missing accessible label: ${button.outerHTML}`);
    }
  });
  
  // Check images without alt text
  const images = container.querySelectorAll('img');
  images.forEach((img) => {
    if (!img.getAttribute('alt')) {
      issues.push(`Image missing alt text: ${img.outerHTML}`);
    }
  });
  
  // Check form inputs without labels
  const inputs = container.querySelectorAll('input, textarea, select');
  inputs.forEach((input) => {
    const id = input.getAttribute('id');
    if (!id || !container.querySelector(`label[for="${id}"]`)) {
      if (!input.getAttribute('aria-label')) {
        issues.push(`Form input missing label: ${input.outerHTML}`);
      }
    }
  });
  
  return issues;
};

// Measure animation performance
export const measureAnimationPerformance = (callback: () => void) => {
  let frameCount = 0;
  let startTime = performance.now();
  let fps = 0;
  
  const measureFrame = () => {
    frameCount++;
    const currentTime = performance.now();
    const elapsed = currentTime - startTime;
    
    if (elapsed >= 1000) {
      fps = Math.round((frameCount * 1000) / elapsed);
      frameCount = 0;
      startTime = currentTime;
      callback();
    }
    
    requestAnimationFrame(measureFrame);
  };
  
  measureFrame();
  
  return {
    getFPS: () => fps,
    stop: () => cancelAnimationFrame(measureFrame as any)
  };
};

// Check responsive breakpoints
export const getActiveBreakpoint = (): string => {
  const width = window.innerWidth;
  
  if (width < 640) return 'mobile';
  if (width < 768) return 'sm';
  if (width < 1024) return 'md';
  if (width < 1280) return 'lg';
  if (width < 1536) return 'xl';
  return '2xl';
};

// Simulate different viewport sizes
export const testResponsiveBreakpoints = (callback: (breakpoint: string, width: number) => void) => {
  const breakpoints = [
    { name: 'mobile', width: 375 },
    { name: 'tablet', width: 768 },
    { name: 'desktop', width: 1024 },
    { name: 'wide', width: 1440 }
  ];
  
  breakpoints.forEach(({ name, width }) => {
    // Note: This won't actually resize the window in most browsers due to security
    // But it provides the structure for testing
    callback(name, width);
  });
};

// Check for layout overflow
export const checkLayoutOverflow = (container: HTMLElement) => {
  const issues: string[] = [];
  const containerWidth = container.offsetWidth;
  
  const elements = container.querySelectorAll('*');
  elements.forEach((element) => {
    const el = element as HTMLElement;
    if (el.offsetWidth > containerWidth) {
      issues.push(`Element overflows container: ${el.tagName}.${el.className}`);
    }
  });
  
  return issues;
};

// Performance observer for LCP, FID, CLS
export const setupPerformanceObserver = (callback: (metric: string, value: number) => void) => {
  // Largest Contentful Paint
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    callback('LCP', lastEntry.startTime);
  }).observe({ entryTypes: ['largest-contentful-paint'] });
  
  // First Input Delay
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry: any) => {
      callback('FID', entry.processingStart - entry.startTime);
    });
  }).observe({ entryTypes: ['first-input'] });
  
  // Cumulative Layout Shift
  let clsValue = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!(entry as any).hadRecentInput) {
        clsValue += (entry as any).value;
        callback('CLS', clsValue);
      }
    }
  }).observe({ entryTypes: ['layout-shift'] });
};

// Test loading states
export const simulateSlowNetwork = (delay: number = 3000) => {
  const originalFetch = window.fetch;
  
  window.fetch = async (...args) => {
    await new Promise(resolve => setTimeout(resolve, delay));
    return originalFetch(...args);
  };
  
  return () => {
    window.fetch = originalFetch;
  };
};

// Keyboard navigation tester
export const testKeyboardNavigation = (container: HTMLElement) => {
  const focusableElements = container.querySelectorAll(
    'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
  );
  
  const issues: string[] = [];
  
  focusableElements.forEach((element) => {
    const el = element as HTMLElement;
    
    // Check if element is visible
    if (el.offsetWidth === 0 || el.offsetHeight === 0) {
      issues.push(`Hidden focusable element: ${el.outerHTML}`);
    }
    
    // Check tab index
    const tabIndex = el.getAttribute('tabindex');
    if (tabIndex && parseInt(tabIndex) < -1) {
      issues.push(`Invalid tabindex: ${el.outerHTML}`);
    }
  });
  
  return {
    focusableCount: focusableElements.length,
    issues
  };
};

// Export all test utilities
export const UITestUtils = {
  isElementInViewport,
  checkTouchTargetSize,
  getContrastRatio,
  checkAccessibility,
  measureAnimationPerformance,
  getActiveBreakpoint,
  testResponsiveBreakpoints,
  checkLayoutOverflow,
  setupPerformanceObserver,
  simulateSlowNetwork,
  testKeyboardNavigation
};