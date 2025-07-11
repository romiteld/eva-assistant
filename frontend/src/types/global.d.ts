// Global type declarations

// Extend the Window interface
declare global {
  interface Window {
    // Add any custom window properties here
    __NEXT_DATA__?: any
    gtag?: (...args: any[]) => void
  }

  // Node.js global types
  namespace NodeJS {
    interface ProcessEnv {
      // Supabase
      NEXT_PUBLIC_SUPABASE_URL: string
      NEXT_PUBLIC_SUPABASE_ANON_KEY: string
      SUPABASE_SERVICE_ROLE_KEY?: string
      
      // API Keys
      FIRECRAWL_API_KEY?: string
      NEXT_PUBLIC_GEMINI_API_KEY?: string
      OPENAI_API_KEY?: string
      
      // OAuth
      MICROSOFT_CLIENT_ID?: string
      MICROSOFT_CLIENT_SECRET?: string
      MICROSOFT_TENANT_ID?: string
      
      // Other integrations
      TWILIO_ACCOUNT_SID?: string
      TWILIO_AUTH_TOKEN?: string
      ZOHO_CLIENT_ID?: string
      ZOHO_CLIENT_SECRET?: string
      
      // Environment
      NODE_ENV: 'development' | 'production' | 'test'
      NEXT_PUBLIC_VERCEL_URL?: string
    }
  }

  // Extend built-in types
  interface Array<T> {
    // Add any custom array methods here
  }

  interface String {
    // Add any custom string methods here
  }
}

// Module declarations for packages without types
declare module '*.svg' {
  const content: React.FunctionComponent<React.SVGAttributes<SVGElement>>
  export default content
}

declare module '*.css' {
  const content: { [className: string]: string }
  export default content
}

// Ensure this file is treated as a module
export {}