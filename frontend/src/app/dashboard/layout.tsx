'use client';

import { AuthProvider } from '@/contexts/AuthContext'
import { ServiceProvider } from '@/components/providers/ServiceProvider'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AuthErrorBoundary } from '@/components/error/AuthErrorBoundary'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <AuthGuard fallbackUrl="/login">
        <ServiceProvider>
          <AuthErrorBoundary>
            {children}
          </AuthErrorBoundary>
        </ServiceProvider>
      </AuthGuard>
    </AuthProvider>
  )
}