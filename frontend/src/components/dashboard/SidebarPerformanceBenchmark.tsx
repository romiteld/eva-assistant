'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { OptimizedSidebar } from './OptimizedSidebar'
import { Sidebar as OriginalSidebar } from './Sidebar'
import { analyzeBundleSize, getOptimizationStrategy, PERFORMANCE_BENCHMARKS } from '@/utils/bundle-analyzer'
import { usePerformanceMonitor, useAnimationPerformance } from '@/hooks/usePerformanceMonitor'

interface BenchmarkResult {
  component: 'Original' | 'Optimized'
  renderTime: number
  memoryUsage: number
  frameRate: number
  score: number
}

interface BenchmarkProps {
  isOpen: boolean
  onClose: () => void
}

export function SidebarPerformanceBenchmark({ isOpen, onClose }: BenchmarkProps) {
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult[]>([])
  const [currentTest, setCurrentTest] = useState<'original' | 'optimized' | 'complete'>('original')
  const [showResults, setShowResults] = useState(false)
  
  const originalMonitor = usePerformanceMonitor()
  const optimizedMonitor = usePerformanceMonitor()

  const { animationMetrics, measureAnimation } = useAnimationPerformance('SidebarToggle')

  // Performance scoring algorithm
  const calculateScore = (renderTime: number, memoryUsage: number, frameRate: number): number => {
    const renderScore = Math.max(0, 100 - (renderTime / 16) * 100) // Based on 60fps target
    const memoryScore = Math.max(0, 100 - (memoryUsage / (25 * 1024 * 1024)) * 100) // Based on 25MB target
    const frameRateScore = Math.min(100, (frameRate / 60) * 100) // Based on 60fps target
    
    return Math.round((renderScore + memoryScore + frameRateScore) / 3)
  }

  // Run benchmark tests
  useEffect(() => {
    if (currentTest === 'complete') return

    const runBenchmark = async () => {
      // Wait for components to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      if (currentTest === 'original' && originalMonitor.performanceData) {
        const metrics = originalMonitor.performanceData.renderingMetrics
        const result: BenchmarkResult = {
          component: 'Original',
          renderTime: metrics.renderTime,
          memoryUsage: metrics.memoryUsage || 0,
          frameRate: 60, // Default frame rate assumption
          score: calculateScore(
            metrics.renderTime,
            metrics.memoryUsage || 0,
            60
          )
        }
        
        setBenchmarkResults(prev => [...prev, result])
        setCurrentTest('optimized')
      } else if (currentTest === 'optimized' && optimizedMonitor.performanceData) {
        const metrics = optimizedMonitor.performanceData.renderingMetrics
        const result: BenchmarkResult = {
          component: 'Optimized',
          renderTime: metrics.renderTime,
          memoryUsage: metrics.memoryUsage || 0,
          frameRate: 60, // Default frame rate assumption
          score: calculateScore(
            metrics.renderTime,
            metrics.memoryUsage || 0,
            60
          )
        }
        
        setBenchmarkResults(prev => [...prev, result])
        setCurrentTest('complete')
        setShowResults(true)
      }
    }

    runBenchmark()
  }, [currentTest, originalMonitor.performanceData, optimizedMonitor.performanceData])

  // Bundle analysis
  const bundleAnalysis = analyzeBundleSize()
  const optimizationStrategy = getOptimizationStrategy('desktop')

  const renderComponent = () => {
    switch (currentTest) {
      case 'original':
        return <OriginalSidebar isOpen={isOpen} onClose={onClose} />
      case 'optimized':
        return <OptimizedSidebar isOpen={isOpen} onClose={onClose} />
      default:
        return <OptimizedSidebar isOpen={isOpen} onClose={onClose} />
    }
  }

  return (
    <div className="relative">
      {/* Render the component being tested */}
      {renderComponent()}
      
      {/* Performance overlay */}
      {showResults && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-4 right-4 bg-black/95 backdrop-blur-xl text-white p-6 rounded-xl border border-white/10 z-[9999] max-w-sm"
        >
          <h3 className="text-lg font-bold mb-4 text-purple-400">Performance Benchmark Results</h3>
          
          <div className="space-y-4">
            {benchmarkResults.map((result, index) => (
              <div key={index} className="space-y-2">
                <h4 className="font-semibold text-sm">{result.component} Sidebar</h4>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Render Time:</span>
                    <span className={result.renderTime < 16 ? 'text-green-400' : result.renderTime < 33 ? 'text-yellow-400' : 'text-red-400'}>
                      {result.renderTime.toFixed(2)}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Memory Usage:</span>
                    <span className={result.memoryUsage < 25 * 1024 * 1024 ? 'text-green-400' : 'text-yellow-400'}>
                      {(result.memoryUsage / 1024 / 1024).toFixed(2)}MB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Frame Rate:</span>
                    <span className={result.frameRate >= 55 ? 'text-green-400' : result.frameRate >= 30 ? 'text-yellow-400' : 'text-red-400'}>
                      {result.frameRate.toFixed(1)}fps
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Score:</span>
                    <span className={result.score >= 90 ? 'text-green-400' : result.score >= 70 ? 'text-yellow-400' : 'text-red-400'}>
                      {result.score}/100
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {benchmarkResults.length === 2 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <h4 className="font-semibold text-sm mb-2">Improvements</h4>
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Render Time:</span>
                  <span className="text-green-400">
                    {((benchmarkResults[0].renderTime - benchmarkResults[1].renderTime) / benchmarkResults[0].renderTime * 100).toFixed(1)}% faster
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Memory Usage:</span>
                  <span className="text-green-400">
                    {((benchmarkResults[0].memoryUsage - benchmarkResults[1].memoryUsage) / benchmarkResults[0].memoryUsage * 100).toFixed(1)}% less
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Frame Rate:</span>
                  <span className="text-green-400">
                    {((benchmarkResults[1].frameRate - benchmarkResults[0].frameRate) / benchmarkResults[0].frameRate * 100).toFixed(1)}% better
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-white/10">
            <h4 className="font-semibold text-sm mb-2">Bundle Analysis</h4>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>Total Size:</span>
                <span>{bundleAnalysis.totalSize}KB</span>
              </div>
              <div className="flex justify-between">
                <span>Framer Motion:</span>
                <span>{bundleAnalysis.framerMotionSize}KB</span>
              </div>
              <div className="flex justify-between">
                <span>Lucide Icons:</span>
                <span>{bundleAnalysis.lucideIconsSize}KB</span>
              </div>
            </div>
          </div>

          {animationMetrics && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <h4 className="font-semibold text-sm mb-2">Animation Performance</h4>
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Duration:</span>
                  <span>{animationMetrics.duration.toFixed(2)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>FPS:</span>
                  <span className={animationMetrics.fps >= 55 ? 'text-green-400' : 'text-yellow-400'}>
                    {animationMetrics.fps}fps
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Dropped Frames:</span>
                  <span className={animationMetrics.droppedFrames === 0 ? 'text-green-400' : 'text-yellow-400'}>
                    {animationMetrics.droppedFrames}
                  </span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowResults(false)}
            className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg text-sm transition-colors"
          >
            Close Results
          </button>
        </motion.div>
      )}
      
      {/* Testing status */}
      {currentTest !== 'complete' && (
        <div className="fixed bottom-4 right-4 bg-black/90 text-white p-3 rounded-lg text-sm">
          Testing {currentTest} sidebar performance...
        </div>
      )}
    </div>
  )
}