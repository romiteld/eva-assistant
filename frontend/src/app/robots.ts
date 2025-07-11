import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://eva.thewellrecruiting.com';
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow: [
          '/api/',
          '/debug-*',
          '/test-*',
          '/test/',
          '/demo/',
          '/monitoring/',
          '/ceo/',
          '/_next/',
          '/dashboard/debug/',
          '/auth/microsoft/callback',
          '/auth/microsoft/complete',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}