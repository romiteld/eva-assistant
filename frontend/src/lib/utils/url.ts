/**
 * Get the URL for the current environment
 * Handles local development, Vercel preview deployments, and production
 */
export function getURL(): string {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ?? // Set this to your site URL in production env.
    process?.env?.NEXT_PUBLIC_VERCEL_URL ?? // Automatically set by Vercel.
    'http://localhost:3000/'
    
  // Make sure to include `https://` when not localhost.
  url = url.startsWith('http') ? url : `https://${url}`
  
  // Make sure to include a trailing `/`.
  url = url.endsWith('/') ? url : `${url}/`
  
  return url
}

/**
 * Get the auth callback URL for the current environment
 */
export function getAuthCallbackURL(): string {
  const baseURL = getURL()
  return `${baseURL}auth/callback`
}

/**
 * Check if we're running on Vercel
 */
export function isVercel(): boolean {
  return process.env.VERCEL === '1'
}

/**
 * Get site URL for Supabase configuration
 * This should be your production URL in production, 
 * but can be dynamic for preview deployments
 */
export function getSiteURL(): string {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }
  return getURL()
}

/**
 * Get WebSocket URL for the current environment
 */
export function getWebSocketURL(): string {
  if (typeof window !== 'undefined') {
    // Client-side: use current origin
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}`
  }
  
  // Server-side: use configured URLs
  const baseURL = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return baseURL.replace(/^https?:/, (match) => match === 'https:' ? 'wss:' : 'ws:')
}

/**
 * Get HTTP WebSocket URL (for Socket.IO)
 */
export function getHttpWebSocketURL(): string {
  // Use separate WebSocket server URL in production
  if (process.env.NODE_ENV === 'production' || (typeof window !== 'undefined' && window.location.hostname !== 'localhost')) {
    return process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'https://your-websocket-server.railway.app'
  }
  
  // Local development: use localhost:8080
  return 'http://localhost:8080'
}