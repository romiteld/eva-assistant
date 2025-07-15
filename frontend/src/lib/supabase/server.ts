import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Re-export createServerClient for components that need it directly
export { createServerClient } from '@supabase/ssr'

export function createClient(useServiceRole: boolean = false) {
  const cookieStore = cookies()

  const key = useServiceRole 
    ? process.env.SUPABASE_SERVICE_ROLE_KEY! 
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      cookies: {
        get(name: string) {
          const cookie = cookieStore.get(name)
          // Only log non-auth token cookies to reduce noise
          if (!name.includes('auth-token')) {
            console.log(`[Server] Getting cookie ${name}:`, cookie ? 'found' : 'not found')
          }
          return cookie?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            const cookieOptions = {
              name,
              value,
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax' as const, // Use 'lax' for auth cookies to work with redirects
              path: '/',
            }
            console.log(`[Server] Setting cookie ${name}`, { hasValue: !!value, options: cookieOptions })
            cookieStore.set(cookieOptions)
          } catch (error) {
            console.error(`[Server] Error setting cookie ${name}:`, error)
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            const cookieOptions = {
              name,
              value: '',
              ...options,
              maxAge: 0,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax' as const,
              path: '/',
            }
            console.log(`[Server] Removing cookie ${name}`)
            cookieStore.set(cookieOptions)
          } catch (error) {
            console.error(`[Server] Error removing cookie ${name}:`, error)
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Export the Database type for convenience
export type { Database } from '@/types/database'