// Recruitment-specific JSON-LD schemas

export const recruitmentServiceSchema = {
  '@context': 'https://schema.org',
  '@type': 'EmploymentAgency',
  name: 'The Well Recruiting Solutions',
  description: 'Specialized financial advisor recruitment services powered by AI technology',
  url: 'https://eva.thewellrecruiting.com',
  logo: 'https://eva.thewellrecruiting.com/logo.png',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'US',
  },
  serviceType: 'Financial Advisor Recruitment',
  areaServed: {
    '@type': 'Country',
    name: 'United States',
  },
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Recruitment Services',
    itemListElement: [
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'AI-Powered Candidate Screening',
          description: 'Automated resume parsing and candidate evaluation using AI',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Interview Automation',
          description: 'AI-driven interview scheduling and question generation',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Lead Generation',
          description: 'Intelligent sourcing of financial advisor candidates',
        },
      },
    ],
  },
};

export const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is EVA?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'EVA (Executive Virtual Assistant) is an AI-powered recruitment platform specifically designed for financial advisor recruiting. It automates screening, scheduling, and candidate management processes.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does AI help in recruitment?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Our AI technology automates resume parsing, conducts initial screenings through voice agents, generates interview questions, and provides predictive analytics to identify the best candidates.',
      },
    },
    {
      '@type': 'Question',
      name: 'What integrations does EVA support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'EVA integrates with Microsoft 365 (Outlook, Teams, SharePoint), LinkedIn, Zoho CRM, Twilio for communications, and provides web scraping capabilities for comprehensive candidate research.',
      },
    },
  ],
};

export const breadcrumbSchema = (items: Array<{ name: string; url: string }>) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url,
  })),
});

export const jobPostingSchema = (job: {
  title: string;
  description: string;
  datePosted: string;
  validThrough?: string;
  employmentType?: string;
  salary?: {
    currency: string;
    minValue: number;
    maxValue: number;
  };
}) => ({
  '@context': 'https://schema.org',
  '@type': 'JobPosting',
  title: job.title,
  description: job.description,
  datePosted: job.datePosted,
  validThrough: job.validThrough,
  employmentType: job.employmentType || 'FULL_TIME',
  hiringOrganization: {
    '@type': 'Organization',
    name: 'Financial Services Firm',
    sameAs: 'https://eva.thewellrecruiting.com',
  },
  jobLocation: {
    '@type': 'Place',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'US',
    },
  },
  ...(job.salary && {
    baseSalary: {
      '@type': 'MonetaryAmount',
      currency: job.salary.currency,
      value: {
        '@type': 'QuantitativeValue',
        minValue: job.salary.minValue,
        maxValue: job.salary.maxValue,
        unitText: 'YEAR',
      },
    },
  }),
});

export const personSchema = (person: {
  name: string;
  jobTitle: string;
  image?: string;
  url?: string;
}) => ({
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: person.name,
  jobTitle: person.jobTitle,
  image: person.image,
  url: person.url,
  worksFor: {
    '@type': 'Organization',
    name: 'The Well Recruiting Solutions',
  },
});

export const eventSchema = (event: {
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  location?: string;
  eventAttendanceMode?: 'OfflineEventAttendanceMode' | 'OnlineEventAttendanceMode' | 'MixedEventAttendanceMode';
}) => ({
  '@context': 'https://schema.org',
  '@type': 'Event',
  name: event.name,
  description: event.description,
  startDate: event.startDate,
  endDate: event.endDate || event.startDate,
  eventAttendanceMode: `https://schema.org/${event.eventAttendanceMode || 'OnlineEventAttendanceMode'}`,
  location: event.location || {
    '@type': 'VirtualLocation',
    url: 'https://eva.thewellrecruiting.com',
  },
  organizer: {
    '@type': 'Organization',
    name: 'The Well Recruiting Solutions',
    url: 'https://eva.thewellrecruiting.com',
  },
});

export const reviewSchema = {
  '@context': 'https://schema.org',
  '@type': 'Review',
  itemReviewed: {
    '@type': 'SoftwareApplication',
    name: 'EVA - Executive Virtual Assistant',
  },
  reviewRating: {
    '@type': 'Rating',
    ratingValue: '4.8',
    bestRating: '5',
  },
  author: {
    '@type': 'Organization',
    name: 'Financial Advisory Firm',
  },
  reviewBody: 'EVA has transformed our recruitment process. The AI-powered screening saves us hours every week, and the integration with our existing tools is seamless.',
};