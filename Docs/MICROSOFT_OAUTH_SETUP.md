# Microsoft OAuth Setup for Supabase

## Steps to Configure Microsoft OAuth in Supabase

### 1. Configure Microsoft OAuth in Supabase Dashboard

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/ztakznzshlvqobzbuewb/auth/providers
2. Find "Azure (Microsoft)" in the list of providers
3. Enable it by toggling the switch
4. Fill in these values:
   - **Client ID**: `bfa77df6-6952-4d0f-9816-003b3101b9da`
   - **Client Secret**: `z.z8Q~KRb~Qek1dewl8OC6wzqjdypY6Xh8hTeamA`
   - **Azure Tenant URL**: `https://login.microsoftonline.com/29ee1479-b5f7-48c5-b665-7de9a8a9033e`

### 2. Update Azure App Registration Redirect URI

In your Azure Portal (https://portal.azure.com):

1. Go to Azure Active Directory → App registrations
2. Find your app registration
3. Go to Authentication → Platform configurations → Web
4. Update or add the redirect URI to:
   ```
   https://ztakznzshlvqobzbuewb.supabase.co/auth/v1/callback
   ```
5. For local development, also add:
   ```
   http://localhost:3000/auth/v1/callback
   ```
6. Save the changes

### 3. Important Notes

- The callback URL for Supabase OAuth is different from NextAuth
- Supabase handles the OAuth flow internally
- Users will be created in your Supabase auth.users table automatically
- The provider will be listed as 'azure' in the user metadata

### 4. Testing

1. Go to http://localhost:3000/login
2. Click "Sign in with Microsoft"
3. You should be redirected to Microsoft login
4. After successful login, you'll be redirected back to your dashboard

### 5. Troubleshooting

If you get an error:
- Check that the redirect URI in Azure matches exactly
- Ensure the Client ID and Secret are correct
- Check Supabase logs at: https://supabase.com/dashboard/project/ztakznzshlvqobzbuewb/logs/auth