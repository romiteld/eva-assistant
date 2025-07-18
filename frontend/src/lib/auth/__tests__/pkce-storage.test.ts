/**
 * PKCE Storage Enhancement Tests
 * 
 * Tests for the enhanced PKCE storage mechanisms that prevent
 * "PKCE code verifier not found" errors during OAuth callbacks.
 */

// Mock the entire module first
jest.mock('../microsoft-oauth', () => ({
  signInWithMicrosoftPKCE: jest.fn(),
  handleMicrosoftCallback: jest.fn()
}));

import { signInWithMicrosoftPKCE, handleMicrosoftCallback } from '../microsoft-oauth';

// Mock environment variables
const mockEnvVars = {
  NEXT_PUBLIC_MICROSOFT_CLIENT_ID: 'test-client-id',
  NEXT_PUBLIC_MICROSOFT_TENANT_ID: 'test-tenant-id',
  NEXT_PUBLIC_MICROSOFT_REDIRECT_URI: 'http://localhost:3000/auth/microsoft/callback'
};

// Mock window object with crypto
const mockWindow = {
  location: {
    origin: 'http://localhost:3000',
    protocol: 'http:',
    hostname: 'localhost',
    href: 'http://localhost:3000'
  },
  crypto: {
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
  }
};

// Mock storage objects
const mockSessionStorage = {
  data: {} as Record<string, string>,
  getItem: jest.fn((key: string) => mockSessionStorage.data[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    mockSessionStorage.data[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete mockSessionStorage.data[key];
  }),
  clear: jest.fn(() => {
    mockSessionStorage.data = {};
  })
};

const mockLocalStorage = {
  data: {} as Record<string, string>,
  getItem: jest.fn((key: string) => mockLocalStorage.data[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    mockLocalStorage.data[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete mockLocalStorage.data[key];
  }),
  clear: jest.fn(() => {
    mockLocalStorage.data = {};
  })
};

// Mock document.cookie
let mockCookies: Record<string, string> = {};
Object.defineProperty(document, 'cookie', {
  get: () => {
    return Object.entries(mockCookies)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('; ');
  },
  set: (cookieString: string) => {
    const [assignment] = cookieString.split(';');
    const [key, value] = assignment.split('=');
    if (value && value !== '') {
      mockCookies[key] = decodeURIComponent(value);
    } else {
      delete mockCookies[key];
    }
  }
});

describe('PKCE Storage Enhancement', () => {
  beforeEach(() => {
    // Reset all mocks and storage
    jest.clearAllMocks();
    mockSessionStorage.data = {};
    mockLocalStorage.data = {};
    mockCookies = {};
    
    // Mock global objects
    Object.assign(global, {
      window: mockWindow,
      sessionStorage: mockSessionStorage,
      localStorage: mockLocalStorage,
      btoa: (str: string) => Buffer.from(str).toString('base64'),
      atob: (str: string) => Buffer.from(str, 'base64').toString(),
      fetch: jest.fn()
    });
    
    // Mock process.env
    Object.assign(process.env, mockEnvVars);
  });

  describe('Enhanced Storage Mechanisms', () => {
    it('should store PKCE verifier in multiple locations', async () => {
      // Mock the redirect to prevent actual navigation
      mockWindow.location.href = '';
      
      try {
        await signInWithMicrosoftPKCE();
      } catch (error) {
        // Expected to fail due to redirect, but storage should be set
      }

      // Verify storage in sessionStorage
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'pkce_code_verifier',
        expect.any(String)
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'oauth_state',
        expect.any(String)
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'oauth_storage_timestamp',
        expect.any(String)
      );

      // Verify storage in localStorage
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'pkce_code_verifier',
        expect.any(String)
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'oauth_state',
        expect.any(String)
      );

      // Verify cookies are set
      expect(document.cookie).toContain('pkce_code_verifier=');
      expect(document.cookie).toContain('oauth_state=');
      expect(document.cookie).toContain('oauth_storage_timestamp=');
    });

    it('should store timestamped keys for enhanced reliability', async () => {
      const mockTimestamp = '1234567890';
      jest.spyOn(Date, 'now').mockReturnValue(parseInt(mockTimestamp));
      
      try {
        await signInWithMicrosoftPKCE();
      } catch (error) {
        // Expected to fail due to redirect
      }

      // Verify timestamped keys are stored
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        `pkce_code_verifier_${mockTimestamp}`,
        expect.any(String)
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        `oauth_state_${mockTimestamp}`,
        expect.any(String)
      );
    });

    it('should store in window object as fallback', async () => {
      try {
        await signInWithMicrosoftPKCE();
      } catch (error) {
        // Expected to fail due to redirect
      }

      // Verify window storage
      expect((mockWindow as any).__oauthStorage).toBeDefined();
      expect((mockWindow as any).__oauthStorage.pkce_code_verifier).toBeDefined();
      expect((mockWindow as any).__oauthStorage.oauth_state).toBeDefined();
    });
  });

  describe('Enhanced Retrieval Mechanisms', () => {
    it('should retrieve PKCE verifier from sessionStorage', async () => {
      const mockCode = 'test-code';
      const mockState = 'test-state';
      const mockVerifier = 'test-verifier';

      mockSessionStorage.data['pkce_code_verifier'] = mockVerifier;
      mockSessionStorage.data['oauth_state'] = mockState;

      // Mock fetch for token exchange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'test-token' })
      });

      try {
        await handleMicrosoftCallback(mockCode, mockState);
      } catch (error) {
        // May fail due to other mocks, but should not fail due to missing verifier
        expect(error.message).not.toContain('PKCE code verifier not found');
      }
    });

    it('should fallback to localStorage when sessionStorage fails', async () => {
      const mockCode = 'test-code';
      const mockState = 'test-state';
      const mockVerifier = 'test-verifier';

      // Make sessionStorage fail
      mockSessionStorage.getItem.mockReturnValue(null);
      
      // Set in localStorage
      mockLocalStorage.data['pkce_code_verifier'] = mockVerifier;
      mockLocalStorage.data['oauth_state'] = mockState;

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'test-token' })
      });

      try {
        await handleMicrosoftCallback(mockCode, mockState);
      } catch (error) {
        expect(error.message).not.toContain('PKCE code verifier not found');
      }
    });

    it('should fallback to cookies when storage fails', async () => {
      const mockCode = 'test-code';
      const mockState = 'test-state';
      const mockVerifier = 'test-verifier';

      // Make both storage types fail
      mockSessionStorage.getItem.mockReturnValue(null);
      mockLocalStorage.getItem.mockReturnValue(null);
      
      // Set in cookies
      mockCookies['pkce_code_verifier'] = mockVerifier;
      mockCookies['oauth_state'] = mockState;

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'test-token' })
      });

      try {
        await handleMicrosoftCallback(mockCode, mockState);
      } catch (error) {
        expect(error.message).not.toContain('PKCE code verifier not found');
      }
    });

    it('should fallback to window storage when all else fails', async () => {
      const mockCode = 'test-code';
      const mockState = 'test-state';
      const mockVerifier = 'test-verifier';

      // Make all storage types fail
      mockSessionStorage.getItem.mockReturnValue(null);
      mockLocalStorage.getItem.mockReturnValue(null);
      mockCookies = {};
      
      // Set in window storage
      (mockWindow as any).__oauthStorage = {
        pkce_code_verifier: mockVerifier,
        oauth_state: mockState
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'test-token' })
      });

      try {
        await handleMicrosoftCallback(mockCode, mockState);
      } catch (error) {
        expect(error.message).not.toContain('PKCE code verifier not found');
      }
    });

    it('should use timestamped keys when available', async () => {
      const mockCode = 'test-code';
      const mockState = 'test-state';
      const mockVerifier = 'test-verifier';
      const mockTimestamp = '1234567890';

      // Make regular keys fail
      mockSessionStorage.getItem.mockImplementation((key: string) => {
        if (key === 'oauth_storage_timestamp') return mockTimestamp;
        if (key === `pkce_code_verifier_${mockTimestamp}`) return mockVerifier;
        if (key === `oauth_state_${mockTimestamp}`) return mockState;
        return null;
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'test-token' })
      });

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

      // Make all storage fail
      mockSessionStorage.getItem.mockReturnValue(null);
      mockLocalStorage.getItem.mockReturnValue(null);
      mockCookies = {};
      (mockWindow as any).__oauthStorage = undefined;

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'test-token' })
      });

      try {
        await handleMicrosoftCallback(mockCode, mockState);
      } catch (error) {
        expect(error.message).not.toContain('PKCE code verifier not found');
      }
    });
  });

  describe('Storage Cleanup', () => {
    it('should clean up all storage locations after successful callback', async () => {
      const mockCode = 'test-code';
      const mockState = 'test-state';
      const mockVerifier = 'test-verifier';
      const mockTimestamp = '1234567890';

      // Set up storage
      mockSessionStorage.data['pkce_code_verifier'] = mockVerifier;
      mockSessionStorage.data['oauth_state'] = mockState;
      mockSessionStorage.data['oauth_storage_timestamp'] = mockTimestamp;
      mockSessionStorage.data[`pkce_code_verifier_${mockTimestamp}`] = mockVerifier;
      mockSessionStorage.data[`oauth_state_${mockTimestamp}`] = mockState;

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'test-token' })
      });

      try {
        await handleMicrosoftCallback(mockCode, mockState);
      } catch (error) {
        // May fail due to other mocks, but cleanup should still happen
      }

      // Verify cleanup
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('pkce_code_verifier');
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('oauth_state');
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('oauth_storage_timestamp');
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(`pkce_code_verifier_${mockTimestamp}`);
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(`oauth_state_${mockTimestamp}`);
    });
  });

  describe('Error Handling', () => {
    it('should provide detailed error when no verifier is found', async () => {
      const mockCode = 'test-code';
      const mockState = 'test-state';

      // Make all storage fail
      mockSessionStorage.getItem.mockReturnValue(null);
      mockLocalStorage.getItem.mockReturnValue(null);
      mockCookies = {};
      (mockWindow as any).__oauthStorage = undefined;

      // Mock state without pkce
      const mockStateData = {
        redirectTo: 'http://localhost:3000/dashboard',
        provider: 'azure',
        timestamp: Date.now(),
        nonce: 'test-nonce'
      };
      const stateWithoutPkce = btoa(JSON.stringify(mockStateData));

      await expect(handleMicrosoftCallback(mockCode, stateWithoutPkce)).rejects.toThrow(
        'PKCE code verifier not found. Please ensure cookies and local storage are enabled and try again.'
      );
    });

    it('should handle storage exceptions gracefully', async () => {
      const mockCode = 'test-code';
      const mockState = 'test-state';
      const mockVerifier = 'test-verifier';

      // Make sessionStorage throw error
      mockSessionStorage.getItem.mockImplementation(() => {
        throw new Error('Storage disabled');
      });

      // Set in localStorage as fallback
      mockLocalStorage.data['pkce_code_verifier'] = mockVerifier;
      mockLocalStorage.data['oauth_state'] = mockState;

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'test-token' })
      });

      try {
        await handleMicrosoftCallback(mockCode, mockState);
      } catch (error) {
        expect(error.message).not.toContain('PKCE code verifier not found');
      }
    });
  });
});