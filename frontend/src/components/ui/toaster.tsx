"use client"

import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster 
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'bg-gray-900 border-gray-800',
          title: 'text-gray-100',
          description: 'text-gray-400',
          actionButton: 'bg-purple-600 hover:bg-purple-700',
          cancelButton: 'bg-gray-700 hover:bg-gray-600',
        },
      }}
    />
  )
}
