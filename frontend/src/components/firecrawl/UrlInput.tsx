'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Globe, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UrlInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  label?: string
  error?: string
  disabled?: boolean
  showValidation?: boolean
}

export function UrlInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'https://example.com',
  label = 'Enter URL',
  error,
  disabled = false,
  showValidation = true,
}: UrlInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [touched, setTouched] = useState(false)

  const isValidUrl = (url: string) => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const isValid = value && isValidUrl(value)
  const showError = touched && value && !isValid

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isValid && onSubmit) {
      onSubmit()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="space-y-2">
        {label && (
          <label className="text-sm font-medium text-gray-200">
            {label}
          </label>
        )}
        <div className="relative">
          <motion.div
            className={cn(
              'relative flex items-center rounded-lg border bg-gray-900/50 backdrop-blur-sm transition-all duration-200',
              isFocused && 'border-purple-500 shadow-lg shadow-purple-500/20',
              !isFocused && 'border-gray-700 hover:border-gray-600',
              showError && 'border-red-500',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            animate={{
              scale: isFocused ? 1.01 : 1,
            }}
            transition={{ duration: 0.2 }}
          >
            <div className="pl-4">
              <Globe className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                onChange(e.target.value)
                if (!touched) setTouched(true)
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(
                'flex-1 bg-transparent px-3 py-3 text-sm text-gray-100 placeholder-gray-500 outline-none',
                disabled && 'cursor-not-allowed'
              )}
            />
            {showValidation && value && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="pr-4"
              >
                {isValid ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
              </motion.div>
            )}
          </motion.div>
          {(showError || error) && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 text-sm text-red-400"
            >
              {error || 'Please enter a valid URL'}
            </motion.p>
          )}
        </div>
      </div>
    </form>
  )
}