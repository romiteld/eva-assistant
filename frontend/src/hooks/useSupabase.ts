import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/browser';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export function useSupabase() {
  const [client] = useState<SupabaseClient<Database>>(supabase);

  useEffect(() => {
    // Optional: Add any setup or cleanup logic here
    return () => {
      // Cleanup if needed
    };
  }, []);

  return client;
}