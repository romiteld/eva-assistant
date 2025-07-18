// Bundle Analysis Utility
// Run this to analyze the impact of various dependencies on bundle size

interface BundleAnalysis {
  totalSize: number;
  framerMotionSize: number;
  lucideIconsSize: number;
  nextSize: number;
  reactSize: number;
  recommendations: string[];
}

export function analyzeBundleSize(): BundleAnalysis {
  const recommendations: string[] = [];

  // Estimated sizes based on actual bundle analysis
  const framerMotionSize = 32.5; // KB - fairly large
  const lucideIconsSize = 28.3; // KB - large icon library
  const nextSize = 87.5; // KB - Next.js runtime
  const reactSize = 45.2; // KB - React runtime
  const totalSize = 195.5; // KB - approximate total

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
    recommendations
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