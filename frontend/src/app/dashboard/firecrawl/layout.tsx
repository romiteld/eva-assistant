import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo/config';

export const metadata: Metadata = pageMetadata.firecrawl;

export default function FirecrawlLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}