// SEO Components and Utilities
export { SEO } from './SEO';
export { JsonLd } from './JsonLd';
export { Breadcrumbs } from './Breadcrumbs';
export { Heading, H1, H2, H3, H4, H5, H6 } from './Heading';
export { OptimizedImage, Figure } from './OptimizedImage';

// Schema exports
export * from './schemas';
export { 
  organizationSchema, 
  websiteSchema, 
  softwareApplicationSchema 
} from './JsonLd';

// Re-export utilities
export {
  generateSEO,
  generateBreadcrumbJsonLd,
  optimizeDescription,
  generateCanonicalUrl,
  validateKeywords,
  generateOrganizationSchema,
  generatePersonSchema,
  generateArticleSchema,
} from '@/lib/seo/utils';

// Re-export sitemap generator
export { SitemapGenerator } from '@/lib/seo/sitemap-generator';
export type { SitemapEntry } from '@/lib/seo/sitemap-generator';