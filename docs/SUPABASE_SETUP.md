# Supabase Configuration for EVA Assistant

## Required Redirect URLs

You need to configure the following redirect URLs in your Supabase project dashboard:

### 1. Go to Supabase Dashboard
Navigate to: https://supabase.com/dashboard/project/ztakznzshlvqobzbuewb/auth/url-configuration

### 2. Site URL
Set the Site URL to your production domain:
```
https://eva.thewell.solutions
```

### 3. Redirect URLs (Additional)
Add ALL of the following URLs to allow authentication from different environments:

#### Production URLs:
```
https://eva.thewell.solutions/**
https://eva.thewell.solutions/auth/callback
https://eva.thewell.solutions/auth/confirm
```

#### Vercel Preview URLs:
```
https://*-romiteld.vercel.app/**
https://*-thewell.vercel.app/**
https://eva-assistant-*.vercel.app/**
```

#### Local Development:
```
http://localhost:3000/**
http://localhost:3001/**
```

### 4. Email Templates
Ensure your Magic Link email template uses the redirect URL:

Go to: https://supabase.com/dashboard/project/ztakznzshlvqobzbuewb/auth/templates

Update the "Magic Link" template to:
```html
<h2>Magic Link</h2>

<p>Follow this link to login:</p>
<p><a href="{{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Log In</a></p>
```

### 5. OAuth Providers
For Microsoft/LinkedIn OAuth, ensure these redirect URLs are configured:

#### Microsoft Azure AD:
```
https://eva.thewell.solutions/auth/microsoft/callback
https://eva.thewell.solutions/api/auth/microsoft/callback
```

#### LinkedIn:
```
https://eva.thewell.solutions/auth/linkedin/callback
https://eva.thewell.solutions/api/auth/linkedin/callback
```

## Environment Variables for Vercel

Set these in your Vercel project settings:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ztakznzshlvqobzbuewb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SITE_URL=https://eva.thewell.solutions
```

## Testing

1. Test magic link login from production: https://eva.thewell.solutions/login
2. Test from a Vercel preview deployment
3. Test OAuth providers (Microsoft, LinkedIn)

## Troubleshooting

If magic links aren't working:
1. Check browser console for CSP errors
2. Verify redirect URLs in Supabase match exactly
3. Check email template uses {{ .RedirectTo }}
4. Ensure NEXT_PUBLIC_SITE_URL is set in Vercel