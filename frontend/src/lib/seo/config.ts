import { Metadata } from 'next'

export const siteConfig = {
  name: 'EVA - Executive Virtual Assistant',
  shortName: 'EVA',
  description: 'AI-powered recruitment platform for financial advisor recruiting. Streamline your hiring process with intelligent automation, voice agents, and comprehensive candidate management.',
  tagline: 'Transform Your Recruiting Workflow with AI',
  url: process.env.NEXT_PUBLIC_APP_URL || 'https://eva.thewellrecruiting.com',
  ogImage: '/og-image.png',
  logo: '/logo.png',
  favicon: '/favicon.ico',
  themeColor: '#1e293b',
  backgroundColor: '#020617',
  linkedInHandle: 'the-well-recruiting-solutions',
  keywords: [
    'financial advisor recruiting',
    'AI recruitment platform',
    'executive virtual assistant',
    'automated recruiting',
    'candidate management',
    'recruitment automation',
    'financial services hiring',
    'advisor recruitment',
    'talent acquisition',
    'recruiting technology',
    'AI interview scheduling',
    'resume parsing',
    'lead generation',
    'recruitment CRM',
  ],
  authors: [
    {
      name: 'The Well Recruiting Solutions',
      url: 'https://thewellrecruiting.com',
    },
  ],
}

export const defaultMetadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.shortName}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: siteConfig.authors,
  creator: 'The Well Recruiting Solutions',
  publisher: 'The Well Recruiting Solutions',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: siteConfig.url,
    languages: {
      'en-US': siteConfig.url,
    },
  },
  category: 'technology',
  classification: 'Business Software',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.name,
    description: siteConfig.description,
    site: '@thewellrecruit',
    creator: '@thewellrecruit',
    images: [siteConfig.ogImage],
  },
  robots: {
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
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png' },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/safari-pinned-tab.svg',
      },
    ],
  },
  manifest: '/site.webmanifest',
}

export function generatePageMetadata(
  title: string,
  description: string,
  keywords?: string[],
  noIndex?: boolean
): Metadata {
  const pageKeywords = keywords 
    ? [...siteConfig.keywords, ...keywords]
    : siteConfig.keywords

  return {
    title,
    description,
    keywords: pageKeywords,
    openGraph: {
      title: `${title} | ${siteConfig.shortName}`,
      description,
      type: 'website',
      locale: 'en_US',
      url: siteConfig.url,
      siteName: siteConfig.name,
      images: [
        {
          url: siteConfig.ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${siteConfig.shortName}`,
      description,
      site: '@thewellrecruit',
      creator: '@thewellrecruit',
      images: [siteConfig.ogImage],
    },
    robots: noIndex ? {
      index: false,
      follow: false,
    } : {
      index: true,
      follow: true,
    },
  }
}

export const pageMetadata = {
  home: generatePageMetadata(
    'Home',
    'Transform your financial advisor recruiting with EVA - an AI-powered platform that automates screening, scheduling, and candidate management.',
    ['home', 'recruitment platform', 'AI assistant']
  ),
  dashboard: generatePageMetadata(
    'Dashboard',
    'Access your recruitment dashboard to manage candidates, track applications, and monitor your hiring pipeline.',
    ['dashboard', 'recruitment dashboard', 'candidate tracking']
  ),
  login: generatePageMetadata(
    'Login',
    'Sign in to your EVA account to access your recruitment tools and candidate management system.',
    ['login', 'sign in', 'authentication']
  ),
  signup: generatePageMetadata(
    'Sign Up',
    'Create your EVA account and start transforming your recruitment process with AI-powered automation.',
    ['sign up', 'register', 'create account']
  ),
  voice: generatePageMetadata(
    'Voice Agent',
    'Interact with candidates using our AI-powered voice agent for natural conversations and automated screening.',
    ['voice agent', 'AI voice', 'automated screening', 'voice interviews']
  ),
  leadGeneration: generatePageMetadata(
    'Lead Generation',
    'Discover and qualify potential financial advisor candidates with AI-powered lead generation and Zoho CRM integration.',
    ['lead generation', 'candidate sourcing', 'CRM integration', 'Zoho']
  ),
  contentStudio: generatePageMetadata(
    'AI Content Studio',
    'Create compelling recruitment content with predictive analytics and AI-powered content generation.',
    ['content creation', 'AI content', 'recruitment marketing', 'predictive analytics']
  ),
  resumeParser: generatePageMetadata(
    'Resume Parser',
    'Automatically parse and analyze resumes to extract key information and match candidates to opportunities.',
    ['resume parsing', 'CV analysis', 'candidate screening', 'document processing']
  ),
  interviewCenter: generatePageMetadata(
    'AI Interview Center',
    'Schedule and manage interviews with intelligent automation, calendar integration, and AI-generated questions.',
    ['interview scheduling', 'calendar integration', 'interview automation', 'Teams meetings']
  ),
  recruiterIntel: generatePageMetadata(
    'Recruiter Intel',
    'Access analytics and insights to optimize your recruitment process and track performance metrics.',
    ['recruitment analytics', 'performance metrics', 'insights', 'data analysis']
  ),
  tasks: generatePageMetadata(
    'Task Management',
    'Manage your recruitment tasks and workflows with our integrated task management system.',
    ['task management', 'workflow automation', 'productivity', 'recruitment tasks']
  ),
  outreach: generatePageMetadata(
    'Outreach Campaigns',
    'Create and manage targeted outreach campaigns to engage with potential candidates.',
    ['outreach campaigns', 'email campaigns', 'candidate engagement', 'marketing automation']
  ),
  orchestrator: generatePageMetadata(
    'Agent Orchestrator',
    'Monitor and manage AI agents working on your recruitment tasks in real-time.',
    ['AI orchestration', 'agent management', 'automation monitoring', 'workflow orchestration']
  ),
  firecrawl: generatePageMetadata(
    'Web Intelligence',
    'Extract candidate information from the web with advanced scraping and search capabilities.',
    ['web scraping', 'data extraction', 'candidate research', 'web intelligence']
  ),
  linkedin: generatePageMetadata(
    'LinkedIn Integration',
    'Connect with LinkedIn to enrich candidate profiles and streamline professional networking.',
    ['LinkedIn integration', 'social recruiting', 'professional networking', 'candidate enrichment']
  ),
  twilio: generatePageMetadata(
    'Communication Center',
    'Manage SMS and voice communications with candidates using integrated Twilio services.',
    ['SMS messaging', 'voice calls', 'communication platform', 'Twilio integration']
  ),
  sharepoint: generatePageMetadata(
    'SharePoint Files',
    'Access and manage recruitment documents stored in SharePoint with seamless integration.',
    ['SharePoint integration', 'document management', 'file storage', 'Microsoft 365']
  ),
  settings: generatePageMetadata(
    'Settings',
    'Configure your EVA account settings, integrations, and preferences.',
    ['settings', 'configuration', 'account management', 'preferences']
  ),
}