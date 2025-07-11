'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { JsonLd } from './JsonLd';
import { breadcrumbSchema } from './schemas';

interface BreadcrumbItem {
  name: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  // Ensure home is always the first item
  const breadcrumbItems = [
    { name: 'Home', href: '/' },
    ...items,
  ];

  // Generate schema items with full URLs
  const schemaItems = breadcrumbItems.map((item, index) => ({
    name: item.name,
    url: item.href 
      ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://eva.thewellrecruiting.com'}${item.href}`
      : `${process.env.NEXT_PUBLIC_APP_URL || 'https://eva.thewellrecruiting.com'}${breadcrumbItems.slice(0, index + 1).map(i => i.href).filter(Boolean).join('')}`,
  }));

  return (
    <>
      <JsonLd data={breadcrumbSchema(schemaItems)} id="breadcrumb-schema" />
      <nav aria-label="Breadcrumb" className={`flex items-center space-x-1 text-sm ${className}`}>
        <ol className="flex items-center space-x-1">
          {breadcrumbItems.map((item, index) => {
            const isLast = index === breadcrumbItems.length - 1;
            
            return (
              <li key={index} className="flex items-center">
                {index > 0 && (
                  <ChevronRight className="w-4 h-4 mx-1 text-gray-400" aria-hidden="true" />
                )}
                {item.href && !isLast ? (
                  <Link
                    href={item.href}
                    className="text-gray-400 hover:text-gray-200 transition-colors flex items-center"
                  >
                    {index === 0 && <Home className="w-4 h-4 mr-1" />}
                    <span>{item.name}</span>
                  </Link>
                ) : (
                  <span className="text-gray-200 flex items-center" aria-current={isLast ? 'page' : undefined}>
                    {index === 0 && <Home className="w-4 h-4 mr-1" />}
                    {item.name}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}