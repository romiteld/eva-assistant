import { NextAuthOptions } from 'next-auth';
import { SupabaseAdapter } from '@auth/supabase-adapter';
import { createClient } from '@/lib/supabase/server';

// Microsoft Entra ID provider with correct configuration
const EntraIDProvider = {
  id: 'microsoft-entra-id',
  name: 'Microsoft Entra ID',
  type: 'oauth' as const,
  version: '2.0',
  scope: 'openid profile email offline_access User.Read Mail.ReadWrite Mail.Send MailboxSettings.Read Calendars.ReadWrite OnlineMeetings.ReadWrite Contacts.ReadWrite Sites.Read.All Files.ReadWrite.All',
  params: { grant_type: 'authorization_code' },
  accessTokenUrl: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/oauth2/v2.0/token`,
  requestTokenUrl: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/oauth2/v2.0/token`,
  authorizationUrl: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/oauth2/v2.0/authorize?response_type=code&response_mode=query`,
  profileUrl: 'https://graph.microsoft.com/v1.0/me',
  async profile(profile: any, tokens: any) {
    return {
      id: profile.id,
      name: profile.displayName,
      email: profile.mail || profile.userPrincipalName,
      image: null,
      entraTokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_at,
      }
    };
  },
  clientId: process.env.ENTRA_CLIENT_ID!,
  clientSecret: process.env.ENTRA_CLIENT_SECRET!,
  allowDangerousEmailAccountLinking: true,
  authorization: {
    params: {
      prompt: 'consent',
      access_type: 'offline',
      response_type: 'code'
    }
  }
};

export const authOptions: NextAuthOptions = {
  providers: [EntraIDProvider],
  adapter: SupabaseAdapter({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'microsoft-entra-id') {
        // Create Supabase client within the request context
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = createClient(true);
        
        // Store Microsoft tokens in Supabase
        const { error } = await supabase
          .from('user_integrations')
          .upsert({
            user_id: user.id,
            provider: 'microsoft',
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            scope: account.scope,
            updated_at: new Date().toISOString()
          });
        
        if (error) {
          console.error('Failed to store Microsoft tokens:', error);
        }
      }
      return true;
    },
    async session({ session, token, user }) {
      // Add user ID to session
      if (session?.user) {
        session.user.id = user.id;
      }
      return session;
    },
    async jwt({ token, account, user }) {
      if (account && user) {
        token.id = user.id;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
      }
      return token;
    }
  },
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};