'use client';

import { QueueDashboard } from '@/components/zoho/QueueDashboard';
import { motion, useMotionVariants } from '@/lib/motion';

export default function ZohoDashboardPage() {
  const variants = useMotionVariants();
  
  return (
    <>
      <motion.div
        {...variants.fadeInUp}
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