'use client';

import React from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ApplicantPipeline } from '@/components/recruiting/applicant-pipeline';

export default function ResumeParserPage() {
  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Resume Parser & Pipeline</h1>
          <p className="text-gray-400 mt-2">AI-powered resume analysis and candidate pipeline management</p>
        </div>
        <ApplicantPipeline />
      </div>
    </DashboardLayout>
  );
}