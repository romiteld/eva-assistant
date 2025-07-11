import { ReactElement } from 'react'
import { RenderOptions, RenderResult } from '@testing-library/react'
import { queries } from '@testing-library/dom'

export interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialState?: Record<string, any>
  route?: string
}

export function render(
  ui: ReactElement,
  options?: CustomRenderOptions
): RenderResult<typeof queries, HTMLElement, HTMLElement>

export function renderWithProviders(
  ui: ReactElement,
  options?: CustomRenderOptions
): RenderResult<typeof queries, HTMLElement, HTMLElement>

// User event helpers
export interface UserEventOptions {
  delay?: number
  skipHover?: boolean
  skipClick?: boolean
  skipAutoClose?: boolean
}

// Mock data types
export interface MockUser {
  id: string
  email: string
  profile?: {
    full_name?: string
    avatar_url?: string | null
  }
}

export interface MockTask {
  id: string
  user_id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: number
  created_at: string
  updated_at: string
}

export interface MockSession {
  user: {
    id: string
    email: string
  }
  access_token: string
  refresh_token: string
  expires_at?: number
}