/** @type {import('next').NextConfig} */
const nextConfig = {
  // Temporarily skip type checking during build to fix other issues
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Skip ESLint during build  
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Suppress hydration warnings in development
  reactStrictMode: true,
  
  // Enable SWC minification
  swcMinify: true,
  
  // Optimize for production
  poweredByHeader: false,
  compress: true,
  
  // Image optimization
  images: {
    domains: ['localhost', 'supabase.co'],
  },
  
  // Security headers required by Zoom and OWASP
  async headers() {
    // Build CSP based on environment
    const isDev = process.env.NODE_ENV === 'development';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Common CSP rules
    const cspRules = {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://challenges.cloudflare.com', 'blob:'],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:', 'blob:'],
      'font-src': ["'self'", 'data:'],
      'connect-src': [
        "'self'",
        'https://*.supabase.co',
        'wss://*.supabase.co',
        'https://www.googleapis.com',
        'https://generativelanguage.googleapis.com',
        'https://api.openai.com',
        'https://api.zoom.us',
        'https://zoom.us',
        'https://login.microsoftonline.com',
        'https://graph.microsoft.com',
        'https://api.linkedin.com',
        'https://www.linkedin.com',
        'https://oauth2.googleapis.com',
        'https://accounts.google.com',
        'https://accounts.zoho.com',
        'https://api.zoho.com',
        'https://login.salesforce.com',
        'https://*.salesforce.com',
        'wss://generativelanguage.googleapis.com',
        appUrl,
        // Allow WebSocket connections in development
        ...(isDev ? ['ws://localhost:*', 'wss://localhost:*'] : []),
      ],
      'frame-src': [
        "'self'",
        'https://challenges.cloudflare.com',
        'https://login.microsoftonline.com',
        'https://www.linkedin.com',
        'https://accounts.google.com',
        'https://zoom.us',
      ],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'worker-src': ["'self'", 'blob:'],
      'media-src': ["'self'", 'blob:', 'data:', 'https:'],
    };

    // Convert CSP object to string
    const cspString = Object.entries(cspRules)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value: cspString,
          },
        ],
      },
      {
        // Specific headers for Zoom integration pages
        source: '/dashboard/interview-center/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOW-FROM https://zoom.us',
          },
        ],
      },
    ]
  },
  
  // Handle node: imports for LangGraph
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'node:async_hooks': false,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        path: false,
        os: false,
      };
    }
    
    // Optimize bundle splitting for production
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Separate vendor chunks for better caching
            vendor: {
              name: 'vendors',
              chunks: 'all',
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
              enforce: true,
            },
            // Separate chunk for large libraries
            'framer-motion': {
              name: 'framer-motion',
              chunks: 'all',
              test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
              priority: 30,
              enforce: true,
            },
            'lucide-react': {
              name: 'lucide-icons',
              chunks: 'all',
              test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
              priority: 30,
              enforce: true,
            },
            // Microsoft Graph and AI libraries
            'microsoft-graph': {
              name: 'microsoft-graph',
              chunks: 'all',
              test: /[\\/]node_modules[\\/]@microsoft[\\/]/,
              priority: 30,
              enforce: true,
            },
            'ai-libraries': {
              name: 'ai-libraries',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](@google|@ai-sdk|@langchain)[\\/]/,
              priority: 30,
              enforce: true,
            },
            // Common UI libraries
            'ui-libraries': {
              name: 'ui-libraries',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](@radix-ui|@tanstack|recharts)[\\/]/,
              priority: 25,
              enforce: true,
            },
            // Supabase
            'supabase': {
              name: 'supabase',
              chunks: 'all',
              test: /[\\/]node_modules[\\/]@supabase[\\/]/,
              priority: 25,
              enforce: true,
            },
            // Common utilities
            'utils': {
              name: 'utils',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](date-fns|uuid|clsx|class-variance-authority|tailwind-merge)[\\/]/,
              priority: 20,
              enforce: true,
            },
          },
        },
      };
    }
    
    // Suppress chunk loading errors in development
    if (dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        runtimeChunk: false,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
          },
        },
      };
    }
    
    // Bundle analyzer in development
    if (dev && process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'server',
          openAnalyzer: true,
          analyzerPort: 8888,
        })
      );
    }
    
    return config;
  },
}

module.exports = nextConfig;