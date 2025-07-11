'use client';

import Head from 'next/head';
import { usePathname } from 'next/navigation';
import { siteConfig } from '@/lib/seo/config';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  noindex?: boolean;
  canonical?: string;
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
    section?: string;
    tags?: string[];
  };
  twitter?: {
    card?: 'summary' | 'summary_large_image' | 'app' | 'player';
    site?: string;
    creator?: string;
  };
  additionalMetaTags?: Array<{
    property?: string;
    name?: string;
    content: string;
  }>;
  additionalLinkTags?: Array<{
    rel: string;
    href: string;
    sizes?: string;
    type?: string;
    color?: string;
  }>;
}

export function SEO({
  title,
  description = siteConfig.description,
  keywords = siteConfig.keywords,
  image = siteConfig.ogImage,
  noindex = false,
  canonical,
  article,
  twitter,
  additionalMetaTags = [],
  additionalLinkTags = [],
}: SEOProps) {
  const pathname = usePathname();
  const url = `${siteConfig.url}${pathname}`;
  
  const fullTitle = title 
    ? `${title} | ${siteConfig.shortName}` 
    : siteConfig.name;
    
  const canonicalUrl = canonical || url;
  
  // Ensure absolute URLs for images
  const ogImage = image.startsWith('http') 
    ? image 
    : `${siteConfig.url}${image}`;

  return (
    <Head>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords.join(', ')} />
      <meta name="author" content={siteConfig.authors[0].name} />
      <meta name="generator" content="Next.js" />
      
      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Language and Locale */}
      <meta httpEquiv="content-language" content="en-US" />
      <meta name="language" content="English" />
      
      {/* Viewport and Mobile */}
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      <meta name="theme-color" content={siteConfig.themeColor} />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content={siteConfig.shortName} />
      
      {/* Robots and Indexing */}
      {noindex ? (
        <meta name="robots" content="noindex,nofollow" />
      ) : (
        <>
          <meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1" />
          <meta name="googlebot" content="index,follow" />
          <meta name="bingbot" content="index,follow" />
        </>
      )}
      
      {/* Open Graph */}
      <meta property="og:site_name" content={siteConfig.name} />
      <meta property="og:type" content={article ? 'article' : 'website'} />
      <meta property="og:locale" content="en_US" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={fullTitle} />
      
      {/* Article specific Open Graph */}
      {article && (
        <>
          {article.publishedTime && (
            <meta property="article:published_time" content={article.publishedTime} />
          )}
          {article.modifiedTime && (
            <meta property="article:modified_time" content={article.modifiedTime} />
          )}
          {article.author && (
            <meta property="article:author" content={article.author} />
          )}
          {article.section && (
            <meta property="article:section" content={article.section} />
          )}
          {article.tags?.map((tag, index) => (
            <meta key={index} property="article:tag" content={tag} />
          ))}
        </>
      )}
      
      {/* Twitter Card */}
      <meta name="twitter:card" content={twitter?.card || 'summary_large_image'} />
      <meta name="twitter:site" content={twitter?.site || '@thewellrecruit'} />
      <meta name="twitter:creator" content={twitter?.creator || '@thewellrecruit'} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content={fullTitle} />
      
      {/* LinkedIn specific */}
      <meta property="linkedin:title" content={fullTitle} />
      <meta property="linkedin:description" content={description} />
      <meta property="linkedin:image" content={ogImage} />
      
      {/* Additional Meta Tags */}
      {additionalMetaTags.map((tag, index) => {
        if (tag.property) {
          return <meta key={index} property={tag.property} content={tag.content} />;
        }
        return <meta key={index} name={tag.name} content={tag.content} />;
      })}
      
      {/* Additional Link Tags */}
      {additionalLinkTags.map((tag, index) => (
        <link key={index} {...tag} />
      ))}
      
      {/* Favicon and Icons */}
      <link rel="icon" href="/favicon.ico" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="mask-icon" href="/safari-pinned-tab.svg" color={siteConfig.themeColor} />
      <link rel="manifest" href="/site.webmanifest" />
      
      {/* Preconnect to improve performance */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
      
      {/* Security headers */}
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      <meta httpEquiv="Content-Security-Policy" content="upgrade-insecure-requests" />
      <meta name="format-detection" content="telephone=no" />
    </Head>
  );
}