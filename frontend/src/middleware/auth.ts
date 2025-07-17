import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createClient } from '@/lib/supabase/server';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/health',
  '/api/health/database',
  '/api/auth/microsoft/callback',
  '/api/auth/zoom/callback',
  '/api/webhooks',
  '/api/twilio/webhooks',
  '/api/csrf',
];

// Routes that require specific roles
const ROLE_REQUIREMENTS: Record<string, string[]> = {
  '/api/agents/assign': ['admin', 'recruiter'],
  '/api/agents/rebalance': ['admin'],
  '/api/deals/create': ['admin', 'recruiter'],
  '/api/upload': ['admin', 'recruiter', 'user'],
};

export async function requireAuth(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const pathname = new URL(request.url).pathname;

  // Check if route is public
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return handler(request as AuthenticatedRequest);
  }

  try {
    // Try NextAuth session first
    const session = await getServerSession(authOptions);
    
    if (session?.user) {
      (request as AuthenticatedRequest).user = {
        id: session.user.id!,
        email: session.user.email!,
        role: session.user.role,
      };
      return handler(request as AuthenticatedRequest);
    }

    // Fallback to Supabase auth
    const supabase = createClient();
    const { data: { session: supabaseSession } } = await supabase.auth.getSession();
    
    if (supabaseSession?.user) {
      (request as AuthenticatedRequest).user = {
        id: supabaseSession.user.id,
        email: supabaseSession.user.email!,
        role: supabaseSession.user.user_metadata?.role,
      };
      return handler(request as AuthenticatedRequest);
    }

    // No valid session found
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Auth middleware error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
}

export async function requireRole(
  request: AuthenticatedRequest,
  requiredRoles: string[]
): Promise<boolean> {
  if (!request.user) return false;
  
  // Admin can access everything
  if (request.user.role === 'admin') return true;
  
  // Check if user has any of the required roles
  return requiredRoles.includes(request.user.role || 'user');
}

export function checkRoleForRoute(pathname: string, userRole?: string): boolean {
  const requiredRoles = ROLE_REQUIREMENTS[pathname];
  
  if (!requiredRoles) return true; // No specific role required
  if (!userRole) return false; // No role but route requires one
  if (userRole === 'admin') return true; // Admin can access everything
  
  return requiredRoles.includes(userRole);
}