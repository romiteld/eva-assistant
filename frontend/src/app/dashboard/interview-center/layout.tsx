import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo/config';

export const metadata: Metadata = pageMetadata.interviewCenter;

export default function InterviewCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}