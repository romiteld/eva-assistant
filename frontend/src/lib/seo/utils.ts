import { Metadata } from 'next';
import { siteConfig } from './config';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  noindex?: boolean;
  canonical?: string;
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: string[];
}

export function generateSEO({
  title,
  description,
  keywords = [],
  image,
  noindex = false,
  canonical,
  publishedTime,
  modifiedTime,
  author,
  section,
  tags = [],
}: SEOProps): Metadata {
  const fullTitle = `${title} | ${siteConfig.shortName}`;
  const ogImage = image || siteConfig.ogImage;
  const fullKeywords = [...siteConfig.keywords, ...keywords];

  const metadata: Metadata = {
    title: fullTitle,
    description,
    keywords: fullKeywords,
    authors: author ? [{ name: author }] : siteConfig.authors,
    openGraph: {
      title: fullTitle,
      description,
      type: publishedTime ? 'article' : 'website',
      locale: 'en_US',
      url: canonical || siteConfig.url,
      siteName: siteConfig.name,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      ...(publishedTime && {
        article: {
          publishedTime,
          modifiedTime: modifiedTime || publishedTime,
          authors: author ? [author] : ['The Well Recruiting Solutions'],
          section,
          tags,
        },
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      site: '@thewellrecruit',
      creator: '@thewellrecruit',
      images: [ogImage],
    },
    robots: noindex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        },
    ...(canonical && {
      alternates: {
        canonical,
      },
    }),
  };

  return metadata;
}

// Helper function to generate breadcrumb JSON-LD
export function generateBreadcrumbJsonLd(
  items: Array<{ name: string; url: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// Helper function to clean and limit description length
export function optimizeDescription(
  description: string,
  maxLength: number = 160
): string {
  // Remove extra whitespace
  const cleaned = description.replace(/\s+/g, ' ').trim();
  
  // Truncate if too long
  if (cleaned.length <= maxLength) return cleaned;
  
  // Find last complete word before max length
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  return lastSpace > 0 
    ? truncated.substring(0, lastSpace) + '...'
    : truncated + '...';
}

// Helper function to generate canonical URL
export function generateCanonicalUrl(path: string): string {
  // Remove trailing slashes
  const cleanPath = path.replace(/\/+$/, '');
  
  // Ensure leading slash
  const pathWithSlash = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  
  return `${siteConfig.url}${pathWithSlash}`;
}

// Helper function to validate and clean keywords
export function validateKeywords(keywords: string[]): string[] {
  return keywords
    .filter(keyword => keyword && keyword.trim().length > 0)
    .map(keyword => keyword.trim().toLowerCase())
    .filter((keyword, index, self) => self.indexOf(keyword) === index) // Remove duplicates
    .slice(0, 10); // Limit to 10 keywords
}

// Helper to generate organization schema with custom data
export function generateOrganizationSchema(customData?: Partial<any>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${siteConfig.url}/#organization`,
    name: 'The Well Recruiting Solutions',
    url: siteConfig.url,
    logo: {
      '@type': 'ImageObject',
      url: `${siteConfig.url}/logo.png`,
    },
    ...customData,
  };
}

// Helper to generate person schema for authors
export function generatePersonSchema(person: {
  name: string;
  jobTitle?: string;
  image?: string;
  url?: string;
  sameAs?: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: person.name,
    ...(person.jobTitle && { jobTitle: person.jobTitle }),
    ...(person.image && { image: person.image }),
    ...(person.url && { url: person.url }),
    ...(person.sameAs && { sameAs: person.sameAs }),
    worksFor: {
      '@id': `${siteConfig.url}/#organization`,
    },
  };
}

// Helper to generate article schema
export function generateArticleSchema(article: {
  title: string;
  description: string;
  author: string;
  publishedTime: string;
  modifiedTime?: string;
  image?: string;
  url: string;
  keywords?: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    author: {
      '@type': 'Person',
      name: article.author,
    },
    datePublished: article.publishedTime,
    dateModified: article.modifiedTime || article.publishedTime,
    publisher: {
      '@id': `${siteConfig.url}/#organization`,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': article.url,
    },
    ...(article.image && {
      image: {
        '@type': 'ImageObject',
        url: article.image,
      },
    }),
    ...(article.keywords && {
      keywords: article.keywords.join(', '),
    }),
  };
}