import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'react-hot-toast'
import { ErrorBoundary } from '@/components/error/ErrorBoundary'
import { defaultMetadata } from '@/lib/seo/config'
import { JsonLd, organizationSchema, websiteSchema, softwareApplicationSchema } from '@/components/seo/JsonLd'
import { recruitmentServiceSchema, faqSchema } from '@/components/seo/schemas'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = defaultMetadata

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <JsonLd data={organizationSchema} id="organization-schema" />
        <JsonLd data={websiteSchema} id="website-schema" />
        <JsonLd data={softwareApplicationSchema} id="software-schema" />
        <JsonLd data={recruitmentServiceSchema} id="recruitment-schema" />
        <JsonLd data={faqSchema} id="faq-schema" />
      </head>
      <body className={`${inter.className} bg-gray-950 text-gray-100`}>
        <ErrorBoundary>
          <Providers>
            <Toaster 
              position="top-right"
              toastOptions={{
                style: {
                  background: 'rgb(17 24 39)',
                  color: 'rgb(243 244 246)',
                  border: '1px solid rgb(55 65 81)',
                },
              }}
            />
            {children}
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  )
}