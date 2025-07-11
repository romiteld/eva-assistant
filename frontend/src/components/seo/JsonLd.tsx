import Script from 'next/script';

interface JsonLdProps {
  data: Record<string, any> | Record<string, any>[];
  id?: string;
}

export function JsonLd({ data, id = 'json-ld' }: JsonLdProps) {
  const jsonData = Array.isArray(data) ? data : [data];
  
  return (
    <Script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonData.length === 1 ? jsonData[0] : jsonData),
      }}
    />
  );
}

export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://eva.thewellrecruiting.com/#organization',
  name: 'The Well Recruiting Solutions',
  alternateName: 'EVA - Executive Virtual Assistant',
  url: 'https://thewellrecruiting.com',
  logo: {
    '@type': 'ImageObject',
    url: 'https://eva.thewellrecruiting.com/logo.png',
    width: '512',
    height: '512',
  },
  image: 'https://eva.thewellrecruiting.com/og-image.png',
  description: 'AI-powered recruitment platform for financial advisor recruiting, streamlining hiring with intelligent automation',
  foundingDate: '2020',
  founder: {
    '@type': 'Person',
    name: 'The Well Recruiting Team',
  },
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'US',
    addressRegion: 'United States',
  },
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['English'],
      areaServed: 'US',
      contactOption: ['TollFree', 'HearingImpairedSupported'],
    },
    {
      '@type': 'ContactPoint',
      contactType: 'sales',
      availableLanguage: ['English'],
      areaServed: 'US',
    },
  ],
  sameAs: [
    'https://www.linkedin.com/company/the-well-recruiting-solutions',
    'https://twitter.com/thewellrecruit',
  ],
  parentOrganization: {
    '@type': 'Organization',
    name: 'The Well Recruiting Solutions',
  },
};

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://eva.thewellrecruiting.com/#website',
  name: 'EVA - Executive Virtual Assistant',
  url: 'https://eva.thewellrecruiting.com',
  description: 'Transform your financial advisor recruiting with AI-powered automation',
  publisher: {
    '@id': 'https://eva.thewellrecruiting.com/#organization',
  },
  potentialAction: [
    {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://eva.thewellrecruiting.com/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  ],
  inLanguage: 'en-US',
};

export const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  '@id': 'https://eva.thewellrecruiting.com/#software',
  name: 'EVA - Executive Virtual Assistant',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'RecruitmentSoftware',
  operatingSystem: 'Web, Windows, macOS, Linux, iOS, Android',
  browserRequirements: 'Chrome 90+, Firefox 88+, Safari 14+, Edge 90+',
  permissions: 'internet, microphone, camera',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    priceValidUntil: '2025-12-31',
    availability: 'https://schema.org/InStock',
    seller: {
      '@id': 'https://eva.thewellrecruiting.com/#organization',
    },
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '127',
    reviewCount: '89',
    bestRating: '5',
    worstRating: '1',
  },
  description: 'AI-powered recruitment platform for financial advisor recruiting with voice agents, automated screening, and comprehensive candidate management.',
  screenshot: [
    'https://eva.thewellrecruiting.com/screenshots/dashboard.png',
    'https://eva.thewellrecruiting.com/screenshots/voice-agent.png',
    'https://eva.thewellrecruiting.com/screenshots/lead-generation.png',
  ],
  featureList: [
    'AI Voice Agent with Gemini Live API',
    'Automated Resume Parsing and Analysis',
    'Intelligent Interview Scheduling with Calendar Integration',
    'AI-Powered Lead Generation with CRM Sync',
    'AI Content Creation Studio with Predictive Analytics',
    'Multi-Agent Orchestration System',
    'Microsoft 365 Full Integration',
    'LinkedIn Professional Network Integration',
    'Twilio Communication Platform',
    'SharePoint Document Management',
    'Real-time Collaboration Tools',
    'Advanced Analytics and Reporting',
  ],
  softwareVersion: '2.0',
  datePublished: '2023-01-01',
  dateModified: '2024-12-10',
  creator: {
    '@id': 'https://eva.thewellrecruiting.com/#organization',
  },
  maintainer: {
    '@id': 'https://eva.thewellrecruiting.com/#organization',
  },
  requirements: [
    'Modern web browser with JavaScript enabled',
    'Stable internet connection',
    'Microphone for voice features (optional)',
    'Microsoft 365 account for full integration (optional)',
  ],
};