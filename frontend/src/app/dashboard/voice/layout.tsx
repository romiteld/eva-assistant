import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo/config';

export const metadata: Metadata = pageMetadata.voice;

export default function VoiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}