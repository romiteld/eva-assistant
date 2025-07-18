/**
 * OAuth Migration Utility
 * 
 * This utility helps migrate from PKCE OAuth to Edge Functions OAuth
 * with minimal disruption to existing users.
 */

import { supabase } from '@/lib/supabase/browser';
import { signInWithMicrosoftPKCE } from './microsoft-oauth';
import { signInWithMicrosoftEdge } from './microsoft-edge-oauth';

export interface MigrationConfig {
  enableGradualRollout: boolean;
  rolloutPercentage: number;
  enableMetrics: boolean;
  enableFallback: boolean;
  debugMode: boolean;
}

export interface MigrationMetrics {
  pkceAttempts: number;
  pkceSuccesses: number;
  pkceFailures: number;
  edgeAttempts: number;
  edgeSuccesses: number;
  edgeFailures: number;
  fallbacksUsed: number;
  storageErrors: number;
}

/**
 * OAuth Migration Manager
 * Handles the transition from PKCE to Edge Functions
 */
export class OAuthMigrationManager {
  private config: MigrationConfig;
  private metrics: MigrationMetrics;
  
  constructor(config: Partial<MigrationConfig> = {}) {
    this.config = {
      enableGradualRollout: true,
      rolloutPercentage: 10, // Start with 10% of users
      enableMetrics: true,
      enableFallback: true,
      debugMode: false,
      ...config
    };
    
    this.metrics = {
      pkceAttempts: 0,
      pkceSuccesses: 0,
      pkceFailures: 0,
      edgeAttempts: 0,
      edgeSuccesses: 0,
      edgeFailures: 0,
      fallbacksUsed: 0,
      storageErrors: 0
    };
  }
  
  /**
   * Determine which OAuth method to use for a user
   */
  async getOAuthMethod(userId?: string): Promise<'pkce' | 'edge'> {
    // Check feature flags first
    if (userId) {
      const { data: flag } = await supabase
        .from('feature_flags')
        .select('enabled')
        .eq('user_id', userId)
        .eq('flag', 'edge_functions_oauth')
        .single();
      
      if (flag?.enabled !== undefined) {
        return flag.enabled ? 'edge' : 'pkce';
      }
    }
    
    // Use gradual rollout
    if (this.config.enableGradualRollout) {
      const hash = this.getUserHash(userId || 'anonymous');
      const threshold = this.config.rolloutPercentage / 100;
      return hash < threshold ? 'edge' : 'pkce';
    }
    
    // Default to Edge Functions
    return 'edge';
  }
  
  /**
   * Sign in with Microsoft using the appropriate method
   */
  async signInWithMicrosoft(options?: { forceMethod?: 'pkce' | 'edge' }) {
    const { data: { user } } = await supabase.auth.getUser();
    const method = options?.forceMethod || await this.getOAuthMethod(user?.id);
    
    if (this.config.debugMode) {
      console.log(`[OAuth Migration] Using ${method} method for user ${user?.id || 'anonymous'}`);
    }
    
    try {
      if (method === 'edge') {
        await this.attemptEdgeFunctionsOAuth();
      } else {
        await this.attemptPKCEOAuth();
      }
    } catch (error) {
      if (this.config.enableFallback && method === 'edge') {
        console.warn('[OAuth Migration] Edge Functions failed, falling back to PKCE');
        this.metrics.fallbacksUsed++;
        await this.attemptPKCEOAuth();
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Attempt OAuth using Edge Functions
   */
  private async attemptEdgeFunctionsOAuth() {
    this.metrics.edgeAttempts++;
    const startTime = performance.now();
    
    try {
      await signInWithMicrosoftEdge();
      this.metrics.edgeSuccesses++;
      
      if (this.config.enableMetrics) {
        await this.recordMetric({
          method: 'edge',
          success: true,
          duration: performance.now() - startTime
        });
      }
    } catch (error) {
      this.metrics.edgeFailures++;
      
      if (this.config.enableMetrics) {
        await this.recordMetric({
          method: 'edge',
          success: false,
          duration: performance.now() - startTime,
          error: error instanceof Error ? error.message : 'unknown'
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Attempt OAuth using PKCE
   */
  private async attemptPKCEOAuth() {
    this.metrics.pkceAttempts++;
    const startTime = performance.now();
    
    try {
      await signInWithMicrosoftPKCE();
      this.metrics.pkceSuccesses++;
      
      if (this.config.enableMetrics) {
        await this.recordMetric({
          method: 'pkce',
          success: true,
          duration: performance.now() - startTime
        });
      }
    } catch (error) {
      this.metrics.pkceFailures++;
      
      // Check if it's a storage error
      if (error instanceof Error && error.message.includes('storage')) {
        this.metrics.storageErrors++;
      }
      
      if (this.config.enableMetrics) {
        await this.recordMetric({
          method: 'pkce',
          success: false,
          duration: performance.now() - startTime,
          error: error instanceof Error ? error.message : 'unknown'
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Get metrics for monitoring
   */
  getMetrics(): MigrationMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Get migration status report
   */
  getMigrationStatus() {
    const totalAttempts = this.metrics.pkceAttempts + this.metrics.edgeAttempts;
    const edgePercentage = totalAttempts > 0 
      ? (this.metrics.edgeAttempts / totalAttempts) * 100 
      : 0;
    
    return {
      totalAttempts,
      edgeAdoption: `${edgePercentage.toFixed(2)}%`,
      pkceSuccessRate: this.metrics.pkceAttempts > 0
        ? `${((this.metrics.pkceSuccesses / this.metrics.pkceAttempts) * 100).toFixed(2)}%`
        : 'N/A',
      edgeSuccessRate: this.metrics.edgeAttempts > 0
        ? `${((this.metrics.edgeSuccesses / this.metrics.edgeAttempts) * 100).toFixed(2)}%`
        : 'N/A',
      storageErrorRate: totalAttempts > 0
        ? `${((this.metrics.storageErrors / totalAttempts) * 100).toFixed(2)}%`
        : 'N/A',
      fallbacksUsed: this.metrics.fallbacksUsed
    };
  }
  
  /**
   * Update rollout percentage
   */
  async updateRolloutPercentage(percentage: number) {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }
    
    this.config.rolloutPercentage = percentage;
    
    // Persist to database for consistency across instances
    await supabase
      .from('migration_config')
      .upsert({
        key: 'oauth_edge_rollout_percentage',
        value: percentage,
        updated_at: new Date().toISOString()
      });
  }
  
  /**
   * Clean up PKCE storage for users who have migrated
   */
  async cleanupPKCEStorage() {
    if (typeof window === 'undefined') return;
    
    const keysToRemove = [
      'pkce_code_verifier',
      'oauth_state',
      'microsoft_oauth_state'
    ];
    
    // Clean sessionStorage
    keysToRemove.forEach(key => {
      try {
        sessionStorage.removeItem(key);
      } catch (e) {
        console.warn(`Failed to remove ${key} from sessionStorage:`, e);
      }
    });
    
    // Clean localStorage
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn(`Failed to remove ${key} from localStorage:`, e);
      }
    });
    
    // Clean cookies
    document.cookie.split(';').forEach(cookie => {
      const [name] = cookie.trim().split('=');
      if (keysToRemove.includes(name)) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });
    
    if (this.config.debugMode) {
      console.log('[OAuth Migration] PKCE storage cleaned up');
    }
  }
  
  /**
   * Generate deterministic hash for user
   */
  private getUserHash(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) / 2147483647; // Normalize to 0-1
  }
  
  /**
   * Record metric to database
   */
  private async recordMetric(metric: {
    method: 'pkce' | 'edge';
    success: boolean;
    duration: number;
    error?: string;
  }) {
    try {
      await supabase.from('oauth_metrics').insert({
        provider: 'microsoft',
        action: 'login',
        method: metric.method,
        success: metric.success,
        duration_ms: Math.round(metric.duration),
        error_type: metric.error,
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.warn('[OAuth Migration] Failed to record metric:', error);
    }
  }
}

// Create singleton instance
export const oauthMigration = new OAuthMigrationManager({
  enableGradualRollout: true,
  rolloutPercentage: 10,
  enableMetrics: true,
  enableFallback: true,
  debugMode: process.env.NODE_ENV === 'development'
});

// Export convenience functions
export const signInWithMicrosoft = () => oauthMigration.signInWithMicrosoft();
export const getMigrationStatus = () => oauthMigration.getMigrationStatus();
export const cleanupPKCEStorage = () => oauthMigration.cleanupPKCEStorage();

/**
 * React hook for OAuth migration
 */
export function useOAuthMigration() {
  const [status, setStatus] = useState(oauthMigration.getMigrationStatus());
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(oauthMigration.getMigrationStatus());
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  const signIn = useCallback(async () => {
    setLoading(true);
    try {
      await signInWithMicrosoft();
    } finally {
      setLoading(false);
    }
  }, []);
  
  return {
    signIn,
    loading,
    status,
    updateRollout: oauthMigration.updateRolloutPercentage.bind(oauthMigration),
    cleanup: cleanupPKCEStorage
  };
}