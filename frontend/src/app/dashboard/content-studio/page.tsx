'use client';

import React from 'react';
import { UltraContentCreator } from '@/components/content-studio/ultra-content-creator';

export default function ContentStudioPage() {
  return (
    <>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">AI Content Studio Ultra</h1>
          <p className="text-gray-400 mt-2">Create engaging content with predictive analytics and market insights</p>
        </div>
        <UltraContentCreator />
      </div>
    </>
  );
}