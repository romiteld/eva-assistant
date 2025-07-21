"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearOAuthStorage } from "@/utils/clear-oauth-storage";
import { signInWithMicrosoftPKCE } from "@/lib/auth/microsoft-oauth";

export default function AuthDebugPage() {
  const router = useRouter();
  const [storageInfo, setStorageInfo] = useState<any>({});
  const [cleared, setCleared] = useState(false);

  const checkStorage = () => {
    const info = {
      sessionStorage: {
        oauth_state: sessionStorage.getItem("oauth_state"),
        pkce_code_verifier: sessionStorage.getItem("pkce_code_verifier"),
        timestamp: sessionStorage.getItem("oauth_storage_timestamp"),
        allKeys: Object.keys(sessionStorage),
      },
      localStorage: {
        oauth_state: localStorage.getItem("oauth_state"),
        pkce_code_verifier: localStorage.getItem("pkce_code_verifier"),
        timestamp: localStorage.getItem("oauth_storage_timestamp"),
        allKeys: Object.keys(localStorage),
      },
      cookies: document.cookie,
      windowStorage: typeof window !== 'undefined' && (window as any).__oauthStorage,
      currentUrl: window.location.href,
      hostname: window.location.hostname,
      isLocal: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
    };
    setStorageInfo(info);
  };

  useEffect(() => {
    checkStorage();
  }, []);

  const handleClearStorage = () => {
    clearOAuthStorage();
    setCleared(true);
    setTimeout(() => {
      checkStorage();
      setCleared(false);
    }, 1000);
  };

  const handleTestLogin = async () => {
    try {
      await signInWithMicrosoftPKCE();
    } catch (error) {
      console.error("Login error:", error);
      alert(`Login error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">OAuth Debug Page</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="space-x-4">
            <button
              onClick={handleClearStorage}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Clear OAuth Storage
            </button>
            <button
              onClick={checkStorage}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Refresh Storage Info
            </button>
            <button
              onClick={handleTestLogin}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Test Microsoft Login
            </button>
            <button
              onClick={() => router.push("/login")}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Go to Login Page
            </button>
          </div>
          {cleared && (
            <p className="mt-4 text-green-600 font-semibold">
              Storage cleared successfully!
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Storage Information</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(storageInfo, null, 2)}
          </pre>
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">Troubleshooting Tips:</h3>
          <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
            <li>If you see "State mismatch" errors, click "Clear OAuth Storage" and try again</li>
            <li>Make sure cookies and local storage are enabled in your browser</li>
            <li>Check that you're not in incognito/private mode</li>
            <li>If using an ad blocker, try disabling it temporarily</li>
            <li>The "isLocal" field shows if you're in development mode</li>
          </ul>
        </div>
      </div>
    </div>
  );
}