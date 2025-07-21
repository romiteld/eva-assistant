'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EVAVoicePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new Talk to Eva page
    router.replace('/dashboard/talk-to-eva');
  }, [router]);

  return null;
}