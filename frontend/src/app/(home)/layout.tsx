import { pageMetadata } from '@/lib/seo/config';

export const metadata = pageMetadata.home;

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}