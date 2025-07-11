import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://eva.thewellrecruiting.com';
  
  const routes = [
    '',
    '/login',
    '/signup',
    '/dashboard',
    '/dashboard/voice',
    '/dashboard/lead-generation',
    '/dashboard/content-studio',
    '/dashboard/resume-parser',
    '/dashboard/interview-center',
    '/dashboard/recruiter-intel',
    '/dashboard/tasks',
    '/dashboard/outreach',
    '/dashboard/orchestrator',
    '/dashboard/firecrawl',
    '/dashboard/linkedin',
    '/dashboard/twilio',
    '/dashboard/sharepoint',
    '/dashboard/email-templates',
    '/dashboard/candidates',
    '/dashboard/messages',
    '/dashboard/documents',
    '/dashboard/analytics',
    '/dashboard/settings',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'daily' : 'weekly',
    priority: route === '' ? 1 : route.startsWith('/dashboard') ? 0.8 : 0.5,
  }));
}