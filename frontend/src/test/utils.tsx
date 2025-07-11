import React from 'react'
import { render as rtlRender, RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CustomRenderOptions } from '@/types/test-utils'

// Create a custom render function that includes providers
export function render(
  ui: React.ReactElement,
  options?: CustomRenderOptions
): RenderResult {
  return rtlRender(ui, options)
}

export function renderWithProviders(
  ui: React.ReactElement,
  { 
    initialState = {},
    route = '/',
    ...renderOptions 
  }: CustomRenderOptions = {}
): RenderResult {
  // Create a new QueryClient for each test
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })

  // Set up route if needed
  if (route !== '/') {
    window.history.pushState({}, 'Test page', route)
  }

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions })
}

// Re-export everything from React Testing Library
export * from '@testing-library/react'

// Re-export userEvent
export { default as userEvent } from '@testing-library/user-event'

// Test data factories
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
  expires_at: Date.now() + 3600000, // 1 hour from now
  ...overrides,
})