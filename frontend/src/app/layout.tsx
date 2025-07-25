import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'react-hot-toast'
import { ErrorBoundary } from '@/components/error/ErrorBoundary'
import GlobalErrorBoundary from '@/components/error/GlobalErrorBoundary'
import { ErrorNotificationSystem } from '@/components/error/ErrorNotificationSystem'
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <JsonLd data={organizationSchema} id="organization-schema" />
        <JsonLd data={websiteSchema} id="website-schema" />
        <JsonLd data={softwareApplicationSchema} id="software-schema" />
        <JsonLd data={recruitmentServiceSchema} id="recruitment-schema" />
        <JsonLd data={faqSchema} id="faq-schema" />
      </head>
      <body className={`${inter.className} bg-gray-950 text-gray-100`}>
        <GlobalErrorBoundary>
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
              <ErrorNotificationSystem />
            </Providers>
          </ErrorBoundary>
        </GlobalErrorBoundary>
      </body>
    </html>
  )
}