# Quick Fix Instructions

## 1. Update your `.env.local` file

Replace the placeholder values with the actual credentials from Carlos:

```bash
# Microsoft Entra ID Configuration
ENTRA_CLIENT_ID=<client-id-from-carlos>
ENTRA_CLIENT_SECRET=<secret-value-from-carlos>
ENTRA_TENANT_ID=<tenant-id-from-carlos>
NEXT_PUBLIC_ENTRA_CLIENT_ID=<same-client-id-from-carlos>
NEXT_PUBLIC_ENTRA_TENANT_ID=<same-tenant-id-from-carlos>

# NextAuth Configuration
NEXTAUTH_SECRET=i3c9zUSh/3O5IvU0GBKe0N4OIywjSgLtQI5v7K4m7vk=
NEXTAUTH_URL=http://localhost:3000
```

## 2. Restart your development server

1. Stop the current server (Ctrl+C)
2. Run `npm run dev` again

## 3. Test the integration

### Option A: Sign out first
1. Visit: http://localhost:3000/api/auth/signout
2. Go to: http://localhost:3000/login
3. Click "Sign in with Microsoft"

### Option B: Direct test page
Visit: http://localhost:3000/test-microsoft

This will show:
- Your current auth status
- Microsoft integration status
- Allow you to connect Microsoft account
- Test Graph API endpoints

## Troubleshooting

If you see any errors:
1. Make sure all environment variables are set correctly
2. Check the browser console for errors
3. Verify the callback URLs match what Carlos registered

The error you saw has been fixed - it was related to the auth state subscription handler.
