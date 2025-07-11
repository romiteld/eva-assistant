import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo/config';

export const metadata: Metadata = pageMetadata.recruiterIntel;

export default function RecruiterIntelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}