import { Metadata } from 'next';
import { generatePageMetadata } from '@/lib/seo/config';

export const metadata: Metadata = generatePageMetadata(
  'Error',
  'An unexpected error occurred. Please try again or contact support if the problem persists.',
  ['error', 'technical issue', 'support'],
  true // noindex for error pages
);

export default function ErrorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}