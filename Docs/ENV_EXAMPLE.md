# Environment Variables Example for Microsoft Entra ID

Add these to your `.env.local` file, replacing the placeholders with the actual values Carlos provided:

```bash
# Microsoft Entra ID Configuration (OAuth 2.0)
ENTRA_CLIENT_ID=00001111-aaaa-2222-bbbb-3333cccc4444
ENTRA_CLIENT_SECRET=abc123def456ghi789jkl012mno345pqr678stu901
ENTRA_TENANT_ID=90288a9b-97df-4c6d-b025-95713f21cef9
NEXT_PUBLIC_ENTRA_CLIENT_ID=00001111-aaaa-2222-bbbb-3333cccc4444
NEXT_PUBLIC_ENTRA_TENANT_ID=90288a9b-97df-4c6d-b025-95713f21cef9

# NextAuth Configuration
NEXTAUTH_SECRET=i3c9zUSh/3O5IvU0GBKe0N4OIywjSgLtQI5v7K4m7vk=
NEXTAUTH_URL=http://localhost:3000
```

## Where to find the values Carlos sent:

- **Client ID**: Look for "Application (client) ID" or just "client ID"
- **Tenant ID**: Look for "Directory (tenant) ID" or just "tenant ID"
- **Secret Value**: Look for "Value" under the secret section (not the Secret ID)

## Example from Carlos's message format:
```
app registration
client ID: 00001111-aaaa-2222-bbbb-3333cccc4444
Tenant ID: 90288a9b-97df-4c6d-b025-95713f21cef9
Secret ID: [you don't need this one]
Value: abc123def456ghi789jkl012mno345pqr678stu901 [← this is ENTRA_CLIENT_SECRET]
```

After adding these values:
1. Save the `.env.local` file
2. Restart your dev server
3. Test at http://localhost:3000/test-microsoft
