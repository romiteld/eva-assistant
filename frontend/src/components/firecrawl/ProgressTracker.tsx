'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  Link,
  FileSearch,
  Globe,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ProgressStep {
  id: string
  label: string
  status: 'pending' | 'active' | 'completed' | 'error'
  message?: string
  progress?: number
  icon?: React.ReactNode
}

interface ProgressTrackerProps {
  steps: ProgressStep[]
  title?: string
  subtitle?: string
  showDetails?: boolean
  className?: string
}

export function ProgressTracker({
  steps,
  title = 'Processing',
  subtitle,
  showDetails = true,
  className,
}: ProgressTrackerProps) {
  const activeStepIndex = steps.findIndex(step => step.status === 'active')
  const completedSteps = steps.filter(step => step.status === 'completed').length
  const totalProgress = (completedSteps / steps.length) * 100

  const getStepIcon = (step: ProgressStep) => {
    if (step.icon) return step.icon

    switch (step.id) {
      case 'connect':
        return <Globe className="h-4 w-4" />
      case 'parse':
        return <FileSearch className="h-4 w-4" />
      case 'extract':
        return <Zap className="h-4 w-4" />
      default:
        return <Link className="h-4 w-4" />
    }
  }

  const getStatusIcon = (status: ProgressStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'active':
        return <Loader2 className="h-5 w-5 text-purple-500 animate-spin" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-lg border border-gray-700 bg-gray-900/50 backdrop-blur-sm p-6',
        className
      )}
    >
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
          {subtitle && (
            <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>

        {/* Overall Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Overall Progress</span>
            <span className="text-gray-300">{Math.round(totalProgress)}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              initial={{ width: 0 }}
              animate={{ width: `${totalProgress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          <AnimatePresence mode="sync">
            {steps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg transition-all',
                  step.status === 'active' && 'bg-purple-500/10 border border-purple-500/20',
                  step.status === 'completed' && 'bg-green-500/5',
                  step.status === 'error' && 'bg-red-500/10 border border-red-500/20'
                )}
              >
                <div className="mt-0.5">{getStatusIcon(step.status)}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-sm font-medium',
                      step.status === 'completed' && 'text-gray-300',
                      step.status === 'active' && 'text-purple-400',
                      step.status === 'error' && 'text-red-400',
                      step.status === 'pending' && 'text-gray-500'
                    )}>
                      {step.label}
                    </span>
                    {showDetails && (
                      <span className="text-gray-600">{getStepIcon(step)}</span>
                    )}
                  </div>
                  {step.message && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-gray-400"
                    >
                      {step.message}
                    </motion.p>
                  )}
                  {step.progress !== undefined && step.status === 'active' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-2"
                    >
                      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-purple-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${step.progress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Active Step Details */}
        {showDetails && activeStepIndex >= 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 p-3 bg-purple-500/5 rounded-lg border border-purple-500/10"
          >
            <p className="text-xs text-purple-400">
              Currently: {steps[activeStepIndex].label}
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}