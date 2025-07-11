'use client';

import React from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { RecruiterDashboard } from '@/components/recruiter-intel/RecruiterDashboard';

export default function RecruiterIntelPage() {
  return (
    <DashboardLayout>
      <RecruiterDashboard />
    </DashboardLayout>
  );
}