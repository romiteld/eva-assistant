'use client';

import { QueueDashboard } from '@/components/zoho/QueueDashboard';
import { motion } from 'framer-motion';

export default function ZohoDashboardPage() {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Zoho CRM Integration</h1>
          <p className="text-gray-400">
            Monitor API queue performance, rate limits, and system health
          </p>
        </div>
        
        <QueueDashboard />
      </motion.div>
    </>
  );
}