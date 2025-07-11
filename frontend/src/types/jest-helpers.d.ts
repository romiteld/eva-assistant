// Helper types for Jest mocks

// Generic mock function type
export type MockFunction<T extends (...args: any[]) => any> = jest.MockedFunction<T>

// Mock module type helper
export type MockedModule<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? jest.MockedFunction<T[K]>
    : T[K] extends object
    ? MockedModule<T[K]>
    : T[K]
}

// Supabase mock types
export interface MockSupabaseClient {
  auth: {
    getUser: jest.Mock
    getSession: jest.Mock
    signInWithOtp: jest.Mock
    signInWithOAuth: jest.Mock
    signOut: jest.Mock
    onAuthStateChange: jest.Mock
  }
  from: jest.Mock
  storage: {
    from: jest.Mock
  }
  realtime: {
    channel: jest.Mock
  }
}

// Helper to create typed mocks
export function asMock<T extends (...args: any[]) => any>(
  fn: T
): jest.MockedFunction<T> {
  return fn as jest.MockedFunction<T>
}

// Type-safe mock factory
export function createMock<T>(
  implementation?: Partial<T>
): jest.Mocked<T> {
  const mock = {} as jest.Mocked<T>
  
  if (implementation) {
    Object.entries(implementation).forEach(([key, value]) => {
      if (typeof value === 'function') {
        (mock as any)[key] = jest.fn(value)
      } else {
        (mock as any)[key] = value
      }
    })
  }
  
  return mock
}

// Common test types
export interface TestContext {
  user: MockUser
  session: MockSession
  router: MockRouter
}

export interface MockUser {
  id: string
  email: string
  profile?: {
    full_name?: string
    avatar_url?: string | null
  }
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

export interface MockRouter {
  push: jest.Mock
  replace: jest.Mock
  back: jest.Mock
  forward: jest.Mock
  refresh: jest.Mock
  prefetch: jest.Mock
}