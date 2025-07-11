import { supabase } from './client';
import { authHelpers } from './auth';

// Utility functions for testing authentication
export const authTestUtils = {
  // Test magic link sending
  testMagicLink: async (email: string) => {
    console.log('Testing magic link for:', email);
    try {
      const result = await authHelpers.sendMagicLink(email);
      console.log('Magic link sent successfully:', result);
      return { success: true, data: result };
    } catch (error) {
      console.error('Magic link test failed:', error);
      return { success: false, error };
    }
  },

  // Test current session
  testSession: async () => {
    console.log('Testing current session...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('Active session found:', {
          userId: session.user.id,
          email: session.user.email,
          expiresAt: new Date(session.expires_at! * 1000).toLocaleString()
        });
        return { success: true, session };
      } else {
        console.log('No active session');
        return { success: false, message: 'No active session' };
      }
    } catch (error) {
      console.error('Session test failed:', error);
      return { success: false, error };
    }
  },

  // Test profile creation/update
  testProfile: async () => {
    console.log('Testing profile operations...');
    try {
      const user = await authHelpers.getCurrentUser();
      if (!user) {
        return { success: false, message: 'No authenticated user' };
      }

      console.log('Current user:', user);

      // Test profile update
      const updates = {
        full_name: 'Test User',
        company: 'Test Company',
        role: 'Financial Advisor Recruiter'
      };

      // Update profile using Supabase directly
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      console.log('Profile updated:', updatedProfile);

      return { success: true, profile: updatedProfile };
    } catch (error) {
      console.error('Profile test failed:', error);
      return { success: false, error };
    }
  },

  // Test authentication flow end-to-end
  runFullAuthTest: async (testEmail: string) => {
    console.log('=== Running Full Authentication Test ===');
    
    // 1. Test magic link
    console.log('\n1. Testing magic link...');
    const magicLinkResult = await authTestUtils.testMagicLink(testEmail);
    
    if (!magicLinkResult.success) {
      console.error('Magic link test failed. Stopping tests.');
      return;
    }

    console.log('\n✅ Magic link sent successfully!');
    console.log('Check your email and click the link to continue testing.');
    console.log('\n2. After clicking the link, run:');
    console.log('   authTestUtils.testSession()');
    console.log('\n3. Then test profile operations with:');
    console.log('   authTestUtils.testProfile()');
  }
};

// Make it available in browser console for testing
if (typeof window !== 'undefined') {
  (window as any).authTestUtils = authTestUtils;
  console.log('Auth test utilities loaded. Available commands:');
  console.log('- authTestUtils.testMagicLink("your@email.com")');
  console.log('- authTestUtils.testSession()');
  console.log('- authTestUtils.testProfile()');
  console.log('- authTestUtils.runFullAuthTest("your@email.com")');
}