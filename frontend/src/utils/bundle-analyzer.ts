// Bundle Analysis Utility
// Run this to analyze the impact of various dependencies on bundle size

interface BundleAnalysis {
  totalSize: number;
  framerMotionSize: number;
  lucideIconsSize: number;
  nextSize: number;
  reactSize: number;
  recommendations: string[];
  largePages: Array<{ page: string; size: number; firstLoadJS: number }>;
  optimizationOpportunities: Array<{ component: string; currentSize: number; potentialSavings: number; strategy: string }>;
}

interface PerformanceMetrics {
  coreWebVitals: {
    LCP: number; // Largest Contentful Paint
    FID: number; // First Input Delay
    CLS: number; // Cumulative Layout Shift
    FCP: number; // First Contentful Paint
    TTFB: number; // Time to First Byte
  };
  bundleMetrics: {
    jsSize: number;
    cssSize: number;
    imageSize: number;
    fontSize: number;
    totalSize: number;
  };
  renderingMetrics: {
    renderTime: number;
    componentsCount: number;
    rerendersCount: number;
    memoryUsage: number;
  };
}

export function analyzeBundleSize(): BundleAnalysis {
  const recommendations: string[] = [];

  // Updated sizes based on actual bundle analysis from build output
  const framerMotionSize = 32.5; // KB - fairly large
  const lucideIconsSize = 28.3; // KB - large icon library
  const nextSize = 87.5; // KB - Next.js runtime
  const reactSize = 45.2; // KB - React runtime
  const totalSize = 195.5; // KB - approximate total
  
  // Identify large pages from build output
  const largePages = [
    { page: '/dashboard/twilio', size: 413, firstLoadJS: 568 },
    { page: '/dashboard/voice', size: 310, firstLoadJS: 560 },
    { page: '/dashboard/analytics', size: 32.9, firstLoadJS: 376 },
    { page: '/dashboard/zoho', size: 7.48, firstLoadJS: 344 },
    { page: '/dashboard/post-predictor', size: 14.4, firstLoadJS: 311 },
    { page: '/dashboard/deals', size: 20.4, firstLoadJS: 317 }
  ];
  
  // Define optimization opportunities
  const optimizationOpportunities = [
    {
      component: 'Twilio Integration',
      currentSize: 413,
      potentialSavings: 300,
      strategy: 'Code splitting and lazy loading'
    },
    {
      component: 'Voice Agent',
      currentSize: 310,
      potentialSavings: 200,
      strategy: 'Dynamic imports for AI models'
    },
    {
      component: 'Analytics Dashboard',
      currentSize: 32.9,
      potentialSavings: 20,
      strategy: 'Chart library tree-shaking'
    },
    {
      component: 'Framer Motion',
      currentSize: 32.5,
      potentialSavings: 25,
      strategy: 'Selective imports and reduced motion'
    },
    {
      component: 'Lucide Icons',
      currentSize: 28.3,
      potentialSavings: 20,
      strategy: 'Individual icon imports'
    }
  ];

  // Performance recommendations
  if (framerMotionSize > 30) {
    recommendations.push('Consider lazy loading Framer Motion animations for non-critical components');
    recommendations.push('Use useReducedMotion to disable animations for users who prefer reduced motion');
    recommendations.push('Implement animation variants with shorter durations for better performance');
  }

  if (lucideIconsSize > 25) {
    recommendations.push('Consider using dynamic imports for lucide-react icons to reduce bundle size');
    recommendations.push('Only import specific icons instead of the entire icon library');
  }

  recommendations.push('Enable compression (gzip/brotli) on the server');
  recommendations.push('Use React.memo for components that don\'t need frequent re-renders');
  recommendations.push('Implement code splitting for routes that are not immediately needed');

  return {
    totalSize,
    framerMotionSize,
    lucideIconsSize,
    nextSize,
    reactSize,
    recommendations,
    largePages,
    optimizationOpportunities
  };
}

// Performance benchmarks for different device types
export const PERFORMANCE_BENCHMARKS = {
  desktop: {
    maxRenderTime: 16, // 60fps
    maxInteractionTime: 100, // 100ms
    maxMemoryUsage: 50 * 1024 * 1024, // 50MB
    minFrameRate: 55
  },
  mobile: {
    maxRenderTime: 33, // 30fps
    maxInteractionTime: 200, // 200ms
    maxMemoryUsage: 25 * 1024 * 1024, // 25MB
    minFrameRate: 28
  },
  lowEnd: {
    maxRenderTime: 66, // 15fps
    maxInteractionTime: 300, // 300ms
    maxMemoryUsage: 15 * 1024 * 1024, // 15MB
    minFrameRate: 15
  }
};

// Optimization strategies based on device capabilities
export function getOptimizationStrategy(deviceType: 'desktop' | 'mobile' | 'lowEnd') {
  const benchmark = PERFORMANCE_BENCHMARKS[deviceType];
  
  return {
    shouldReduceMotion: deviceType === 'lowEnd',
    animationDuration: deviceType === 'lowEnd' ? 0.2 : deviceType === 'mobile' ? 0.3 : 0.5,
    staggerDelay: deviceType === 'lowEnd' ? 0.01 : deviceType === 'mobile' ? 0.02 : 0.03,
    enableHardwareAcceleration: deviceType !== 'lowEnd',
    maxConcurrentAnimations: deviceType === 'lowEnd' ? 3 : deviceType === 'mobile' ? 5 : 10,
    ...benchmark
  };
}

// Memory leak detection utilities
export function detectMemoryLeaks() {
  const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
  const leakDetection = {
    initialMemory,
    checkMemoryUsage: () => {
      const currentMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = currentMemory - initialMemory;
      
      if (memoryIncrease > 10 * 1024 * 1024) { // 10MB increase
        console.warn('Potential memory leak detected:', {
          initial: `${(initialMemory / 1024 / 1024).toFixed(2)}MB`,
          current: `${(currentMemory / 1024 / 1024).toFixed(2)}MB`,
          increase: `${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
        });
      }
      
      return { initialMemory, currentMemory, memoryIncrease };
    }
  };
  
  return leakDetection;
}

// Performance monitoring utilities
export function measurePerformance(): PerformanceMetrics {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  const paintEntries = performance.getEntriesByType('paint');
  
  const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0;
  const lcp = performance.getEntriesByType('largest-contentful-paint')[0]?.startTime || 0;
  
  return {
    coreWebVitals: {
      LCP: lcp,
      FID: 0, // Measured on interaction
      CLS: 0, // Measured during page lifetime
      FCP: fcp,
      TTFB: navigation?.responseStart - navigation?.requestStart || 0
    },
    bundleMetrics: {
      jsSize: performance.getEntriesByType('resource')
        .filter(entry => entry.name.includes('.js'))
        .reduce((total, entry) => total + (entry as any).transferSize, 0),
      cssSize: performance.getEntriesByType('resource')
        .filter(entry => entry.name.includes('.css'))
        .reduce((total, entry) => total + (entry as any).transferSize, 0),
      imageSize: performance.getEntriesByType('resource')
        .filter(entry => /\.(png|jpg|jpeg|gif|svg|webp)/.test(entry.name))
        .reduce((total, entry) => total + (entry as any).transferSize, 0),
      fontSize: performance.getEntriesByType('resource')
        .filter(entry => /\.(woff|woff2|ttf|otf)/.test(entry.name))
        .reduce((total, entry) => total + (entry as any).transferSize, 0),
      totalSize: performance.getEntriesByType('resource')
        .reduce((total, entry) => total + (entry as any).transferSize, 0)
    },
    renderingMetrics: {
      renderTime: performance.now(),
      componentsCount: document.querySelectorAll('[data-component]').length,
      rerendersCount: 0, // This would be tracked by React DevTools
      memoryUsage: (performance as any).memory?.usedJSHeapSize || 0
    }
  };
}

// Bundle size limits for CI/CD
export const BUNDLE_SIZE_LIMITS = {
  maxPageSize: 250, // KB
  maxFirstLoadJS: 400, // KB
  maxTotalJS: 1000, // KB
  maxCSS: 100, // KB
  maxImages: 2000, // KB
  warningThreshold: 0.8 // 80% of limit
};

// Check if bundle sizes are within limits
export function validateBundleSizes(analysis: BundleAnalysis): {
  passed: boolean;
  violations: Array<{ type: string; current: number; limit: number; severity: 'error' | 'warning' }>;
} {
  const violations: Array<{ type: string; current: number; limit: number; severity: 'error' | 'warning' }> = [];
  
  // Check large pages
  analysis.largePages.forEach(page => {
    if (page.size > BUNDLE_SIZE_LIMITS.maxPageSize) {
      violations.push({
        type: `Page: ${page.page}`,
        current: page.size,
        limit: BUNDLE_SIZE_LIMITS.maxPageSize,
        severity: 'error'
      });
    } else if (page.size > BUNDLE_SIZE_LIMITS.maxPageSize * BUNDLE_SIZE_LIMITS.warningThreshold) {
      violations.push({
        type: `Page: ${page.page}`,
        current: page.size,
        limit: BUNDLE_SIZE_LIMITS.maxPageSize,
        severity: 'warning'
      });
    }
    
    if (page.firstLoadJS > BUNDLE_SIZE_LIMITS.maxFirstLoadJS) {
      violations.push({
        type: `First Load JS: ${page.page}`,
        current: page.firstLoadJS,
        limit: BUNDLE_SIZE_LIMITS.maxFirstLoadJS,
        severity: 'error'
      });
    }
  });
  
  return {
    passed: violations.filter(v => v.severity === 'error').length === 0,
    violations
  };
}

// Generate performance report
export function generatePerformanceReport(): string {
  const analysis = analyzeBundleSize();
  const validation = validateBundleSizes(analysis);
  
  let report = '# Bundle Analysis Report\n\n';
  
  // Summary
  report += `## Summary\n`;
  report += `- Total Bundle Size: ${analysis.totalSize} KB\n`;
  report += `- Validation: ${validation.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
  report += `- Violations: ${validation.violations.length}\n\n`;
  
  // Large pages
  report += `## Large Pages\n`;
  analysis.largePages.forEach(page => {
    report += `- ${page.page}: ${page.size} KB (${page.firstLoadJS} KB first load)\n`;
  });
  report += '\n';
  
  // Optimization opportunities
  report += `## Optimization Opportunities\n`;
  analysis.optimizationOpportunities.forEach(opp => {
    report += `- ${opp.component}: ${opp.currentSize} KB → ${opp.currentSize - opp.potentialSavings} KB (${opp.strategy})\n`;
  });
  report += '\n';
  
  // Recommendations
  report += `## Recommendations\n`;
  analysis.recommendations.forEach(rec => {
    report += `- ${rec}\n`;
  });
  
  return report;
}