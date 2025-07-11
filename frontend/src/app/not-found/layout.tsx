import { Metadata } from 'next';
import { generatePageMetadata } from '@/lib/seo/config';

export const metadata: Metadata = generatePageMetadata(
  '404 - Page Not Found',
  'The page you are looking for does not exist. Please check the URL or navigate back to the dashboard.',
  ['404', 'not found', 'missing page'],
  true // noindex for 404 pages
);

export default function NotFoundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}