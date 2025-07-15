'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CompetitorDashboard } from '@/components/competitor-analysis/CompetitorDashboard';

export default function CompetitorAnalysisPage() {
  return (
    <DashboardLayout>
      <CompetitorDashboard />
    </DashboardLayout>
  );
}