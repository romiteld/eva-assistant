// Utility to clear OAuth storage
export function clearOAuthStorage() {
  // Clear sessionStorage
  const sessionKeys = ['pkce_code_verifier', 'oauth_state', 'oauth_storage_timestamp'];
  sessionKeys.forEach(key => {
    sessionStorage.removeItem(key);
  });
  
  // Clear timestamped keys from sessionStorage
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && (key.includes('pkce_code_verifier_') || key.includes('oauth_state_'))) {
      sessionStorage.removeItem(key);
    }
  }
  
  // Clear localStorage
  const localKeys = ['pkce_code_verifier', 'oauth_state', 'oauth_storage_timestamp'];
  localKeys.forEach(key => {
    localStorage.removeItem(key);
  });
  
  // Clear timestamped keys from localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('pkce_code_verifier_') || key.includes('oauth_state_'))) {
      localStorage.removeItem(key);
    }
  }
  
  // Clear cookies
  document.cookie = 'pkce_code_verifier=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'oauth_state=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'oauth_storage_timestamp=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  
  // Clear window storage
  if (typeof window !== 'undefined' && (window as any).__oauthStorage) {
    delete (window as any).__oauthStorage;
  }
  
  console.log('OAuth storage cleared successfully');
}

// Auto-execute if run directly in browser console
if (typeof window !== 'undefined' && typeof module === 'undefined') {
  clearOAuthStorage();
}