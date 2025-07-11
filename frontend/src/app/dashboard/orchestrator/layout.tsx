import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo/config';

export const metadata: Metadata = pageMetadata.orchestrator;

export default function OrchestratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}