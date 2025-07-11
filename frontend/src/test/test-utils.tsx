import React, { ReactElement, ReactNode } from 'react'
import { render as rtlRender, RenderOptions, RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'

// Create a custom render function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
}

interface AllTheProvidersProps {
  children: ReactNode
  queryClient?: QueryClient
}

function AllTheProviders({ children, queryClient }: AllTheProvidersProps) {
  const client = queryClient || new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  })

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster position="top-right" />
    </QueryClientProvider>
  )
}

function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions
): RenderResult {
  const { queryClient, ...renderOptions } = options || {}
  
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders queryClient={queryClient}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  })
}

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// Mock data factories
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  profile: {
    full_name: 'Test User',
    avatar_url: null,
  },
  ...overrides,
})

export const createMockTask = (overrides = {}) => ({
  id: 'task-1',
  user_id: 'test-user-id',
  title: 'Test Task',
  description: 'Test Description',
  status: 'pending' as const,
  priority: 0.5,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

export const createMockSession = (overrides = {}) => ({
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
  },
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  ...overrides,
})

// Helper to wait for async operations
export const waitForLoadingToFinish = () =>
  waitFor(() => {
    const loadingElements = [
      ...screen.queryAllByTestId(/loading/i),
      ...screen.queryAllByText(/loading/i),
    ]
    loadingElements.forEach((element) => {
      expect(element).not.toBeInTheDocument()
    })
  })

// Type-safe mock implementations
export const mockRouterPush = jest.fn()
export const mockRouterReplace = jest.fn()
export const mockRouterBack = jest.fn()

export const createMockRouter = () => ({
  push: mockRouterPush,
  replace: mockRouterReplace,
  back: mockRouterBack,
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
})

import { screen, waitFor } from '@testing-library/react'