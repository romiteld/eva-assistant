import { createClient } from '@/lib/supabase/browser';
import { AuthError, Session, User } from '@supabase/supabase-js';

export class AuthService {
  private static instance: AuthService;
  private supabase = createClient();
  private sessionPromise: Promise<Session | null> | null = null;
  private lastCheck: number = 0;
  private SESSION_CACHE_DURATION = 30000; // 30 seconds

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async getSession(): Promise<{ session: Session | null; error: AuthError | null }> {
    const now = Date.now();
    
    // Return cached promise if within cache duration
    if (this.sessionPromise && now - this.lastCheck < this.SESSION_CACHE_DURATION) {
      try {
        const session = await this.sessionPromise;
        return { session, error: null };
      } catch (error) {
        return { session: null, error: error as AuthError };
      }
    }

    // Create new promise for session check
    this.lastCheck = now;
    this.sessionPromise = this.supabase.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      return data.session;
    });

    try {
      const session = await this.sessionPromise;
      return { session, error: null };
    } catch (error) {
      this.sessionPromise = null; // Clear on error
      return { session: null, error: error as AuthError };
    }
  }

  async getUser(): Promise<{ user: User | null; error: AuthError | null }> {
    const { session, error } = await this.getSession();
    if (error || !session) {
      return { user: null, error };
    }
    return { user: session.user, error: null };
  }

  async refreshSession(): Promise<{ session: Session | null; error: AuthError | null }> {
    // Clear cache to force refresh
    this.sessionPromise = null;
    this.lastCheck = 0;

    const { data, error } = await this.supabase.auth.refreshSession();
    if (!error && data.session) {
      // Update cache with new session
      this.sessionPromise = Promise.resolve(data.session);
      this.lastCheck = Date.now();
    }
    
    return { session: data.session, error };
  }

  async signIn(email: string, password: string) {
    // Clear any existing session cache
    this.clearCache();
    
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.session) {
      // Cache the new session
      this.sessionPromise = Promise.resolve(data.session);
      this.lastCheck = Date.now();
    }

    return { data, error };
  }

  async signInWithOTP(email: string) {
    return this.supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });
  }

  async verifyOTP(email: string, token: string) {
    // Clear cache before verification
    this.clearCache();

    const { data, error } = await this.supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (!error && data.session) {
      // Cache the new session
      this.sessionPromise = Promise.resolve(data.session);
      this.lastCheck = Date.now();
    }

    return { data, error };
  }

  async signOut() {
    // Clear cache immediately
    this.clearCache();
    
    const { error } = await this.supabase.auth.signOut();
    return { error };
  }

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return this.supabase.auth.onAuthStateChange((event, session) => {
      // Update cache on auth state changes
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        this.sessionPromise = Promise.resolve(session);
        this.lastCheck = Date.now();
      } else if (event === 'SIGNED_OUT') {
        this.clearCache();
      }
      
      callback(event, session);
    });
  }

  private clearCache() {
    this.sessionPromise = null;
    this.lastCheck = 0;
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();