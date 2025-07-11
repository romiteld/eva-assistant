import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo/config';

export const metadata: Metadata = pageMetadata.resumeParser;

export default function ResumeParserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}