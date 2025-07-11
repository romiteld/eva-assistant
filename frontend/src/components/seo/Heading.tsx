import { createElement, ReactNode } from 'react';

interface HeadingProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: ReactNode;
  className?: string;
  id?: string;
}

const defaultClasses = {
  1: 'text-4xl font-bold tracking-tight',
  2: 'text-3xl font-semibold tracking-tight',
  3: 'text-2xl font-semibold',
  4: 'text-xl font-medium',
  5: 'text-lg font-medium',
  6: 'text-base font-medium',
};

export function Heading({ level, children, className = '', id }: HeadingProps) {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  const defaultClass = defaultClasses[level];
  
  return createElement(
    Tag,
    {
      id,
      className: `${defaultClass} ${className}`.trim(),
    },
    children
  );
}

// Convenience components for specific heading levels
export const H1 = (props: Omit<HeadingProps, 'level'>) => <Heading level={1} {...props} />;
export const H2 = (props: Omit<HeadingProps, 'level'>) => <Heading level={2} {...props} />;
export const H3 = (props: Omit<HeadingProps, 'level'>) => <Heading level={3} {...props} />;
export const H4 = (props: Omit<HeadingProps, 'level'>) => <Heading level={4} {...props} />;
export const H5 = (props: Omit<HeadingProps, 'level'>) => <Heading level={5} {...props} />;
export const H6 = (props: Omit<HeadingProps, 'level'>) => <Heading level={6} {...props} />;