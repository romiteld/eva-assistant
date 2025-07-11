import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo/config';

export const metadata: Metadata = pageMetadata.outreach;

export default function OutreachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}