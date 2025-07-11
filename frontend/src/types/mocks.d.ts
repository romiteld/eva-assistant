// Mock type declarations for tests

declare module '@/test/setup-msw' {
  import { SetupServer } from 'msw/node'
  
  export const server: SetupServer
  export const handlers: Array<import('msw').RequestHandler>
}

// Vitest types
declare module 'vitest' {
  export interface TestContext {
    // Add any custom test context properties here
  }
}

// Jest mock types
declare global {
  var jest: {
    fn: typeof jest.fn
    mock: typeof jest.mock
    unmock: typeof jest.unmock
    doMock: typeof jest.doMock
    dontMock: typeof jest.dontMock
    clearAllMocks: typeof jest.clearAllMocks
    resetAllMocks: typeof jest.resetAllMocks
    restoreAllMocks: typeof jest.restoreAllMocks
    mocked: typeof jest.mocked
    spyOn: typeof jest.spyOn
    replaceProperty: typeof jest.replaceProperty
  }

  namespace NodeJS {
    interface Global {
      fetch: jest.Mock
      IntersectionObserver: typeof IntersectionObserver
      ResizeObserver: typeof ResizeObserver
    }
  }
}

// Mock window types
interface MockMediaQueryList {
  matches: boolean
  media: string
  onchange: null
  addListener: jest.Mock
  removeListener: jest.Mock
  addEventListener: jest.Mock
  removeEventListener: jest.Mock
  dispatchEvent: jest.Mock
}

declare global {
  interface Window {
    matchMedia: jest.Mock<MockMediaQueryList, [string]>
  }
}

// Export empty object to make this a module
export {}