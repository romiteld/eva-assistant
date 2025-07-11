import { siteConfig } from './config';

export interface SitemapEntry {
  url: string;
  lastModified: Date;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export class SitemapGenerator {
  private baseUrl: string;
  private entries: SitemapEntry[] = [];

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || siteConfig.url;
  }

  addEntry(entry: SitemapEntry | Omit<SitemapEntry, 'lastModified'> & { lastModified?: Date }) {
    this.entries.push({
      ...entry,
      lastModified: entry.lastModified || new Date(),
    });
    return this;
  }

  addEntries(entries: Array<SitemapEntry | Omit<SitemapEntry, 'lastModified'> & { lastModified?: Date }>) {
    entries.forEach(entry => this.addEntry(entry));
    return this;
  }

  // Add static pages
  addStaticPages() {
    const staticPages = [
      { path: '/', priority: 1.0, changeFrequency: 'daily' as const },
      { path: '/login', priority: 0.8, changeFrequency: 'monthly' as const },
      { path: '/signup', priority: 0.8, changeFrequency: 'monthly' as const },
      { path: '/about', priority: 0.7, changeFrequency: 'monthly' as const },
      { path: '/features', priority: 0.9, changeFrequency: 'weekly' as const },
      { path: '/pricing', priority: 0.8, changeFrequency: 'weekly' as const },
      { path: '/contact', priority: 0.6, changeFrequency: 'monthly' as const },
      { path: '/privacy', priority: 0.3, changeFrequency: 'monthly' as const },
      { path: '/terms', priority: 0.3, changeFrequency: 'monthly' as const },
      { path: '/blog', priority: 0.7, changeFrequency: 'daily' as const },
      { path: '/careers', priority: 0.6, changeFrequency: 'weekly' as const },
      { path: '/partners', priority: 0.5, changeFrequency: 'monthly' as const },
      { path: '/resources', priority: 0.6, changeFrequency: 'weekly' as const },
      { path: '/case-studies', priority: 0.6, changeFrequency: 'monthly' as const },
      { path: '/integrations', priority: 0.7, changeFrequency: 'monthly' as const },
    ];

    staticPages.forEach(page => {
      this.addEntry({
        url: `${this.baseUrl}${page.path}`,
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
      });
    });

    return this;
  }

  // Add dashboard pages
  addDashboardPages() {
    const dashboardPages = [
      'dashboard',
      'dashboard/voice',
      'dashboard/lead-generation',
      'dashboard/content-studio',
      'dashboard/resume-parser',
      'dashboard/interview-center',
      'dashboard/recruiter-intel',
      'dashboard/tasks',
      'dashboard/outreach',
      'dashboard/orchestrator',
      'dashboard/firecrawl',
      'dashboard/settings',
    ];

    dashboardPages.forEach(page => {
      this.addEntry({
        url: `${this.baseUrl}/${page}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.5,
      });
    });

    return this;
  }

  // Add dynamic pages (e.g., blog posts, job listings)
  async addDynamicPages(
    fetchFunction: () => Promise<Array<{ path: string; lastModified?: Date; priority?: number }>>
  ) {
    try {
      const pages = await fetchFunction();
      pages.forEach(page => {
        this.addEntry({
          url: `${this.baseUrl}${page.path}`,
          lastModified: page.lastModified || new Date(),
          changeFrequency: 'weekly',
          priority: page.priority || 0.5,
        });
      });
    } catch (error) {
      console.error('Error fetching dynamic pages for sitemap:', error);
    }

    return this;
  }

  // Generate XML sitemap
  generateXML(): string {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${this.entries
  .map(
    entry => `  <url>
    <loc>${this.escapeXML(entry.url)}</loc>
    <lastmod>${entry.lastModified.toISOString()}</lastmod>
    ${entry.changeFrequency ? `<changefreq>${entry.changeFrequency}</changefreq>` : ''}
    ${entry.priority !== undefined ? `<priority>${entry.priority}</priority>` : ''}
  </url>`
  )
  .join('\n')}
</urlset>`;

    return xml;
  }

  // Generate sitemap index for multiple sitemaps
  generateIndex(sitemaps: Array<{ url: string; lastModified: Date }>) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    sitemap => `  <sitemap>
    <loc>${this.escapeXML(sitemap.url)}</loc>
    <lastmod>${sitemap.lastModified.toISOString()}</lastmod>
  </sitemap>`
  )
  .join('\n')}
</sitemapindex>`;

    return xml;
  }

  // Helper to escape XML special characters
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // Get all entries
  getEntries(): SitemapEntry[] {
    return this.entries;
  }

  // Clear all entries
  clear() {
    this.entries = [];
    return this;
  }
}