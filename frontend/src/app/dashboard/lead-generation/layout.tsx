import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo/config';

export const metadata: Metadata = pageMetadata.leadGeneration;

export default function LeadGenerationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}