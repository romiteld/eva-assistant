"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { handleMicrosoftCallback } from "@/lib/auth/microsoft-oauth";

export default function MicrosoftCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      if (error) {
        setError(`OAuth error: ${errorDescription || error}`);
        setLoading(false);
        return;
      }

      if (!code || !state) {
        setError("No authorization code or state received");
        setLoading(false);
        return;
      }

      try {
        // Use the centralized handleMicrosoftCallback function
        const tokenData = await handleMicrosoftCallback(code, state);
        
        // Get user info
        const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        });

        const userData = await userResponse.json();

        if (!userResponse.ok) {
          throw new Error('Failed to get user information');
        }
        
        // Store tokens server-side
        const storeResponse = await fetch("/api/auth/microsoft/store-tokens", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...tokenData,
            user: userData,
          }),
        });
        
        if (!storeResponse.ok) {
          console.error('Failed to store tokens');
        }

        // Parse state to get redirect URL
        const stateData = JSON.parse(atob(state));

        // Create session using the user data
        const sessionResponse = await fetch("/api/auth/microsoft/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userData: {
              email: userData.mail || userData.userPrincipalName,
              name: userData.displayName,
              microsoftId: userData.id,
            },
            redirectTo: stateData.redirectTo || "/dashboard",
          }),
        });

        const sessionData = await sessionResponse.json();

        if (sessionData.error) {
          throw new Error(sessionData.error);
        }

        // Redirect to success page
        router.push(sessionData.redirectUrl);
      } catch (error) {
        console.error("Error during OAuth callback:", error);
        setError(
          error instanceof Error ? error.message : "Authentication failed",
        );
        setLoading(false);
      }
    }

    handleCallback();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Authentication Error
            </h2>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => router.push("/login")}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
}
