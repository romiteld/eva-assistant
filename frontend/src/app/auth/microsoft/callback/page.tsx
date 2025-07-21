"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function MicrosoftCallbackPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  useEffect(() => {
    // This page should not be reached in the normal flow
    // The server-side callback route should handle everything
    // If we're here, it means something went wrong
    if (error) {
      // Redirect to login with error
      window.location.href = `/login?error=${error}&error_description=${encodeURIComponent(errorDescription || '')}`;
    } else {
      // If no error, the server should have redirected us already
      // This is a fallback
      window.location.href = '/dashboard';
    }
  }, [error, errorDescription]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Processing authentication...</p>
      </div>
    </div>
  );
}