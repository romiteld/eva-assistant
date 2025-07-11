import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo/config';

export const metadata: Metadata = pageMetadata.tasks;

export default function TasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}