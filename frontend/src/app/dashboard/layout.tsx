'use client';

import { AuthProvider } from '@/contexts/AuthContext'
import { ServiceProvider } from '@/components/providers/ServiceProvider'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AuthErrorBoundary } from '@/components/error/AuthErrorBoundary'
import { DashboardLayout as DashboardWrapper } from '@/components/dashboard/DashboardLayout'

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
            <DashboardWrapper>
              {children}
            </DashboardWrapper>
          </AuthErrorBoundary>
        </ServiceProvider>
      </AuthGuard>
    </AuthProvider>
  )
}