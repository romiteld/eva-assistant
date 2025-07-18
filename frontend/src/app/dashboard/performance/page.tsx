'use client'

import { BundleAnalyzerDashboard } from '@/components/dashboard/BundleAnalyzerDashboard'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'

export default function PerformancePage() {
  return (
    <DashboardLayout>
      <BundleAnalyzerDashboard />
    </DashboardLayout>
  )
}