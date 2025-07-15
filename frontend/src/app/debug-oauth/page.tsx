'use client'

import { useState, useEffect } from 'react'

// PKCE helper functions
function base64URLEncode(str: ArrayBuffer) {
  return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(str))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function sha256(plain: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return base64URLEncode(array.buffer);
}

async function generateCodeChallenge(codeVerifier: string) {
  const hashed = await sha256(codeVerifier);
  return base64URLEncode(hashed);
}

export default function DebugOAuth() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const testDirectOAuth = async () => {
    setLoading(true)
    
    // Generate PKCE values
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    // Store code verifier for later use
    sessionStorage.setItem('pkce_code_verifier', codeVerifier);
    
    // Construct the proper OAuth URL with PKCE
    const clientId = 'bfa77df6-6952-4d0f-9816-003b3101b9da'
    const tenantId = '29ee1479-b5f7-48c5-b665-7de9a8a9033e'
    const redirectUri = encodeURIComponent('http://localhost:3000/auth/callback')
    const scope = encodeURIComponent('openid email profile offline_access')
    
    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
      `client_id=${clientId}&` +
      `response_type=code&` +
      `redirect_uri=${redirectUri}&` +
      `response_mode=query&` +
      `scope=${scope}&` +
      `state=pkce-test&` +
      `code_challenge=${codeChallenge}&` +
      `code_challenge_method=S256`

    // Open in same window
    window.location.href = authUrl
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-8">Debug OAuth - Direct Microsoft Login</h1>
        
        <button
          onClick={testDirectOAuth}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Redirecting...' : 'Test Direct Microsoft OAuth'}
        </button>

        <div className="mt-8 p-4 bg-gray-900 rounded">
          <h2 className="text-lg font-semibold text-white mb-2">Configuration:</h2>
          <p className="text-gray-400">Client ID: bfa77df6-6952-4d0f-9816-003b3101b9da</p>
          <p className="text-gray-400">Tenant ID: 29ee1479-b5f7-48c5-b665-7de9a8a9033e</p>
          <p className="text-gray-400">Redirect URI: {typeof window !== 'undefined' ? window.location.origin : ''}/auth/microsoft/callback</p>
        </div>

        <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-600 rounded">
          <p className="text-yellow-400">
            This will bypass Supabase OAuth and go directly to Microsoft. 
            After login, you should be redirected to Supabase callback URL.
          </p>
        </div>
      </div>
    </div>
  )
}