import { useEffect, useRef, useState } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  paintTime: number;
  interactionTime: number;
  memoryUsage?: number;
  frameRate?: number;
}

interface PerformanceMonitorOptions {
  componentName: string;
  enableFrameRateMonitoring?: boolean;
  enableMemoryMonitoring?: boolean;
  logToConsole?: boolean;
}

export function usePerformanceMonitor(options: PerformanceMonitorOptions) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const renderStartTime = useRef<number>(0);
  const interactionStartTime = useRef<number>(0);
  const frameRequestId = useRef<number>(0);
  const frames = useRef<number>(0);
  const lastTime = useRef<number>(0);
  const [frameRate, setFrameRate] = useState<number>(0);

  // Start render timing
  const startRenderTiming = () => {
    renderStartTime.current = performance.now();
  };

  // End render timing
  const endRenderTiming = () => {
    const renderTime = performance.now() - renderStartTime.current;
    
    // Get paint timing
    const paintEntries = performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
    const paintTime = firstPaint ? firstPaint.startTime : 0;

    // Get memory usage if available
    const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;

    const newMetrics: PerformanceMetrics = {
      renderTime,
      paintTime,
      interactionTime: interactionStartTime.current ? performance.now() - interactionStartTime.current : 0,
      memoryUsage: options.enableMemoryMonitoring ? memoryUsage : undefined,
      frameRate: options.enableFrameRateMonitoring ? frameRate : undefined
    };

    setMetrics(newMetrics);

    if (options.logToConsole) {
      console.log(`[${options.componentName}] Performance Metrics:`, newMetrics);
    }
  };

  // Start interaction timing
  const startInteractionTiming = () => {
    interactionStartTime.current = performance.now();
  };

  // Frame rate monitoring
  useEffect(() => {
    if (!options.enableFrameRateMonitoring) return;

    const measureFrameRate = (currentTime: number) => {
      if (lastTime.current === 0) {
        lastTime.current = currentTime;
        frames.current = 0;
      }

      frames.current++;
      const elapsed = currentTime - lastTime.current;

      if (elapsed >= 1000) {
        const fps = Math.round((frames.current * 1000) / elapsed);
        setFrameRate(fps);
        lastTime.current = currentTime;
        frames.current = 0;
      }

      frameRequestId.current = requestAnimationFrame(measureFrameRate);
    };

    frameRequestId.current = requestAnimationFrame(measureFrameRate);

    return () => {
      if (frameRequestId.current) {
        cancelAnimationFrame(frameRequestId.current);
      }
    };
  }, [options.enableFrameRateMonitoring]);

  // Performance observer for long tasks
  useEffect(() => {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.duration > 50) { // Long task threshold
          console.warn(`[${options.componentName}] Long task detected:`, {
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime
          });
        }
      });
    });

    observer.observe({ entryTypes: ['longtask'] });

    return () => observer.disconnect();
  }, [options.componentName]);

  return {
    metrics,
    startRenderTiming,
    endRenderTiming,
    startInteractionTiming,
    frameRate: options.enableFrameRateMonitoring ? frameRate : undefined
  };
}

// Hook specifically for animation performance
export function useAnimationPerformance(animationName: string) {
  const [animationMetrics, setAnimationMetrics] = useState<{
    duration: number;
    fps: number;
    dropped: number;
  } | null>(null);

  const measureAnimation = (callback: () => void | Promise<void>) => {
    const startTime = performance.now();
    let frameCount = 0;
    let droppedFrames = 0;
    const targetFPS = 60;
    const frameDuration = 1000 / targetFPS;

    const measureFrame = () => {
      frameCount++;
      const currentTime = performance.now();
      const elapsed = currentTime - startTime;
      
      if (elapsed > frameCount * frameDuration + 5) {
        droppedFrames++;
      }

      if (elapsed < 1000) { // Measure for 1 second
        requestAnimationFrame(measureFrame);
      } else {
        const actualFPS = Math.round((frameCount * 1000) / elapsed);
        setAnimationMetrics({
          duration: elapsed,
          fps: actualFPS,
          dropped: droppedFrames
        });
      }
    };

    requestAnimationFrame(measureFrame);
    
    if (typeof callback === 'function') {
      const result = callback();
      if (result instanceof Promise) {
        result.catch(console.error);
      }
    }
  };

  return {
    animationMetrics,
    measureAnimation
  };
}