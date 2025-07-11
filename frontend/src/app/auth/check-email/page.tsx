'use client'

import { useSearchParams } from 'next/navigation';
import { Mail } from 'lucide-react';

export default function CheckEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const redirect = searchParams.get('redirect') || '/dashboard';

  // Store the redirect URL for after email verification
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('auth_redirect', redirect);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <Mail className="mx-auto h-16 w-16 text-green-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Check Your Email</h2>
          <p className="text-gray-600 mb-2">
            We&apos;ve sent a magic link to:
          </p>
          <p className="font-medium text-gray-900 mb-4">{email}</p>
          <p className="text-sm text-gray-500">
            Click the link in your email to complete sign in with your Microsoft account.
          </p>
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Your Microsoft account has been verified. 
              The email link will connect it to your EVA Assistant account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}