'use client';

import React from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AIInterviewScheduler } from '@/components/recruiting/ai-interview-scheduler';

export default function InterviewCenterPage() {
  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">AI Interview Center</h1>
          <p className="text-gray-400 mt-2">Smart scheduling and interview preparation with AI assistance</p>
        </div>
        <AIInterviewScheduler />
      </div>
    </DashboardLayout>
  );
}