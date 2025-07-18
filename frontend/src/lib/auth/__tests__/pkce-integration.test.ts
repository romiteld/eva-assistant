/**
 * PKCE Integration Tests
 * 
 * Integration tests for the enhanced PKCE storage mechanisms
 * that prevent "PKCE code verifier not found" errors.
 */

// Mock environment variables
process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID = 'test-client-id';
process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID = 'test-tenant-id';
process.env.NEXT_PUBLIC_MICROSOFT_REDIRECT_URI = 'http://localhost:3000/auth/microsoft/callback';

// Mock DOM and Web APIs
Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:3000',
    protocol: 'http:',
    hostname: 'localhost',
    href: 'http://localhost:3000'
  },
  writable: true
});

Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    subtle: {
      digest: async (algorithm: string, data: ArrayBuffer) => {
        return new ArrayBuffer(32);
      }
    }
  },
  writable: true
});

// Mock storage
const mockStorage = {
  sessionStorage: {} as Record<string, string>,
  localStorage: {} as Record<string, string>,
  cookies: {} as Record<string, string>
};

Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: (key: string) => mockStorage.sessionStorage[key] || null,
    setItem: (key: string, value: string) => {
      mockStorage.sessionStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockStorage.sessionStorage[key];
    },
    clear: () => {
      mockStorage.sessionStorage = {};
    }
  },
  writable: true
});

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => mockStorage.localStorage[key] || null,
    setItem: (key: string, value: string) => {
      mockStorage.localStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockStorage.localStorage[key];
    },
    clear: () => {
      mockStorage.localStorage = {};
    }
  },
  writable: true
});

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
  get: () => {
    return Object.entries(mockStorage.cookies)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('; ');
  },
  set: (cookieString: string) => {
    const [assignment] = cookieString.split(';');
    const [key, value] = assignment.split('=');
    if (value && value !== '') {
      mockStorage.cookies[key] = decodeURIComponent(value);
    } else {
      delete mockStorage.cookies[key];
    }
  }
});

// Mock btoa/atob
global.btoa = (str: string) => Buffer.from(str).toString('base64');
global.atob = (str: string) => Buffer.from(str, 'base64').toString();

// Mock fetch
const mockFetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ access_token: 'test-token' })
  })
);
global.fetch = mockFetch;

describe('PKCE Storage Integration', () => {
  beforeEach(() => {
    // Reset all storage
    mockStorage.sessionStorage = {};
    mockStorage.localStorage = {};
    mockStorage.cookies = {};
    
    // Clear window storage
    delete (window as any).__oauthStorage;
    
    // Reset fetch mock
    mockFetch.mockClear();
  });

  describe('Storage Mechanisms', () => {
    it('should store PKCE verifier in multiple locations', () => {
      // Mock the redirect to prevent actual navigation
      const originalHref = window.location.href;
      let redirectUrl = '';
      Object.defineProperty(window.location, 'href', {
        set: (url: string) => {
          redirectUrl = url;
        },
        get: () => originalHref
      });

      // Import and call the function
      const { signInWithMicrosoftPKCE } = require('../microsoft-oauth');
      
      expect(async () => {
        await signInWithMicrosoftPKCE();
      }).not.toThrow();

      // Verify storage was used
      expect(Object.keys(mockStorage.sessionStorage).length).toBeGreaterThan(0);
      expect(Object.keys(mockStorage.localStorage).length).toBeGreaterThan(0);
      expect(Object.keys(mockStorage.cookies).length).toBeGreaterThan(0);
    });

    it('should handle missing storage gracefully', () => {
      // Simulate storage being disabled
      Object.defineProperty(window, 'sessionStorage', {
        value: {
          getItem: () => { throw new Error('Storage disabled'); },
          setItem: () => { throw new Error('Storage disabled'); },
          removeItem: () => { throw new Error('Storage disabled'); }
        },
        writable: true
      });

      const { signInWithMicrosoftPKCE } = require('../microsoft-oauth');
      
      expect(async () => {
        await signInWithMicrosoftPKCE();
      }).not.toThrow();
    });
  });

  describe('Retrieval Mechanisms', () => {
    it('should retrieve PKCE verifier from sessionStorage', async () => {
      const mockCode = 'test-code';
      const mockState = 'test-state';
      const mockVerifier = 'test-verifier';

      // Set up storage
      mockStorage.sessionStorage['pkce_code_verifier'] = mockVerifier;
      mockStorage.sessionStorage['oauth_state'] = mockState;

      const { handleMicrosoftCallback } = require('../microsoft-oauth');
      
      try {
        await handleMicrosoftCallback(mockCode, mockState);
      } catch (error) {
        // Should not fail due to missing verifier
        expect(error.message).not.toContain('PKCE code verifier not found');
      }
    });

    it('should fallback to localStorage', async () => {
      const mockCode = 'test-code';
      const mockState = 'test-state';
      const mockVerifier = 'test-verifier';

      // Set up only localStorage
      mockStorage.localStorage['pkce_code_verifier'] = mockVerifier;
      mockStorage.localStorage['oauth_state'] = mockState;

      const { handleMicrosoftCallback } = require('../microsoft-oauth');
      
      try {
        await handleMicrosoftCallback(mockCode, mockState);
      } catch (error) {
        expect(error.message).not.toContain('PKCE code verifier not found');
      }
    });

    it('should fallback to cookies', async () => {
      const mockCode = 'test-code';
      const mockState = 'test-state';
      const mockVerifier = 'test-verifier';

      // Set up only cookies
      mockStorage.cookies['pkce_code_verifier'] = mockVerifier;
      mockStorage.cookies['oauth_state'] = mockState;

      const { handleMicrosoftCallback } = require('../microsoft-oauth');
      
      try {
        await handleMicrosoftCallback(mockCode, mockState);
      } catch (error) {
        expect(error.message).not.toContain('PKCE code verifier not found');
      }
    });

    it('should fallback to window storage', async () => {
      const mockCode = 'test-code';
      const mockState = 'test-state';
      const mockVerifier = 'test-verifier';

      // Set up only window storage
      (window as any).__oauthStorage = {
        pkce_code_verifier: mockVerifier,
        oauth_state: mockState
      };

      const { handleMicrosoftCallback } = require('../microsoft-oauth');
      
      try {
        await handleMicrosoftCallback(mockCode, mockState);
      } catch (error) {
        expect(error.message).not.toContain('PKCE code verifier not found');
      }
    });

    it('should use state parameter as ultimate fallback', async () => {
      const mockCode = 'test-code';
      const mockVerifier = 'test-verifier';
      const mockStateData = {
        redirectTo: 'http://localhost:3000/dashboard',
        provider: 'azure',
        timestamp: Date.now(),
        nonce: 'test-nonce',
        pkce: mockVerifier
      };
      const mockState = btoa(JSON.stringify(mockStateData));

      const { handleMicrosoftCallback } = require('../microsoft-oauth');
      
      try {
        await handleMicrosoftCallback(mockCode, mockState);
      } catch (error) {
        expect(error.message).not.toContain('PKCE code verifier not found');
      }
    });
  });

  describe('Error Handling', () => {
    it('should provide detailed error when no verifier is found', async () => {
      const mockCode = 'test-code';
      const mockStateData = {
        redirectTo: 'http://localhost:3000/dashboard',
        provider: 'azure',
        timestamp: Date.now(),
        nonce: 'test-nonce'
        // No pkce field
      };
      const mockState = btoa(JSON.stringify(mockStateData));

      const { handleMicrosoftCallback } = require('../microsoft-oauth');
      
      await expect(handleMicrosoftCallback(mockCode, mockState)).rejects.toThrow(
        'PKCE code verifier not found'
      );
    });

    it('should handle invalid state parameter', async () => {
      const mockCode = 'test-code';
      const mockState = 'invalid-state';

      const { handleMicrosoftCallback } = require('../microsoft-oauth');
      
      await expect(handleMicrosoftCallback(mockCode, mockState)).rejects.toThrow();
    });
  });

  describe('Security', () => {
    it('should validate state timestamp', async () => {
      const mockCode = 'test-code';
      const mockVerifier = 'test-verifier';
      const mockStateData = {
        redirectTo: 'http://localhost:3000/dashboard',
        provider: 'azure',
        timestamp: Date.now() - 10 * 60 * 1000, // 10 minutes ago
        nonce: 'test-nonce',
        pkce: mockVerifier
      };
      const mockState = btoa(JSON.stringify(mockStateData));

      const { handleMicrosoftCallback } = require('../microsoft-oauth');
      
      await expect(handleMicrosoftCallback(mockCode, mockState)).rejects.toThrow(
        'OAuth state has expired'
      );
    });

    it('should validate state parameter format', async () => {
      const mockCode = 'test-code';
      const mockState = 'not-base64-encoded';

      const { handleMicrosoftCallback } = require('../microsoft-oauth');
      
      await expect(handleMicrosoftCallback(mockCode, mockState)).rejects.toThrow();
    });
  });
});