import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo/config';

export const metadata: Metadata = pageMetadata.contentStudio;

export default function ContentStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}