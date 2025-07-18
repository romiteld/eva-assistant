# Integration Fix Plan - Priority Order

## Critical Issues Summary

1. **LinkedIn Integration (25% health)** - User hasn't authenticated
2. **Microsoft 365 Calendar** - Missing permissions in scope
3. **Twilio Phone System** - Not configured
4. **Agent Orchestrator** - UI exists but Edge Function not deployed
5. **Webhook Signatures** - Missing for several providers

## 1. LinkedIn OAuth Integration Fix

### Issue
- OAuth flow implemented but user hasn't authenticated
- Missing client credentials in environment

### Fix Steps

1. **Update Environment Variables**
```bash
# Add to .env.local
NEXT_PUBLIC_LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
```

2. **Add LinkedIn Login Button to Dashboard**
```typescript
// frontend/src/components/dashboard/IntegrationStatus.tsx
import { signInWithLinkedInPKCE } from '@/lib/auth/linkedin-oauth';

export function IntegrationStatus() {
  const handleLinkedInConnect = () => {
    signInWithLinkedInPKCE();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>LinkedIn Integration</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={handleLinkedInConnect}>
          Connect LinkedIn Account
        </Button>
      </CardContent>
    </Card>
  );
}
```

3. **Fix LinkedIn Callback Route Error Handling**
```typescript
// frontend/src/app/auth/linkedin/callback/route.ts - Line 88
// Fix the webhook token validation
const webhookToken = process.env.LINKEDIN_WEBHOOK_SECRET;
if (!webhookToken && process.env.NODE_ENV === 'production') {
  console.error('LINKEDIN_WEBHOOK_SECRET not configured');
  return NextResponse.redirect(
    new URL('/auth/error?message=Configuration error', request.url)
  );
}
```

## 2. Microsoft 365 Calendar Permissions Fix

### Issue
- Missing calendar permissions in OAuth scope
- Token refresh not including all required scopes

### Fix
```typescript
// frontend/src/lib/microsoft/graph-client.ts - Line 53
// Update the scope to include all required permissions
scope: 'openid profile email offline_access User.Read Mail.ReadWrite Mail.Send MailboxSettings.Read Calendars.ReadWrite OnlineMeetings.ReadWrite Contacts.ReadWrite Sites.Read.All Files.ReadWrite.All Channel.ReadBasic.All Team.ReadBasic.All Chat.ReadWrite',
```

## 3. Twilio Phone System Configuration

### Issue
- Twilio credentials not configured
- Webhook signatures not validated properly

### Fix Steps

1. **Add Twilio Environment Variables**
```bash
# Add to .env.local
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
NEXT_PUBLIC_TWILIO_PHONE_NUMBER=+1234567890
TWILIO_VOICE_URL=https://your-app.com/api/twilio/voice
TWILIO_STATUS_CALLBACK_URL=https://your-app.com/api/twilio/status
```

2. **Create Twilio Configuration UI**
```typescript
// frontend/src/app/dashboard/settings/twilio/page.tsx
'use client';

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function TwilioSettingsPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState({
    accountSid: '',
    authToken: '',
    phoneNumber: '',
  });

  const handleSave = async () => {
    try {
      const response = await fetch('/api/settings/twilio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error('Failed to save configuration');

      toast({
        title: 'Twilio configuration saved',
        description: 'Your phone system is now configured',
      });
    } catch (error) {
      toast({
        title: 'Configuration failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Twilio Phone System</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Twilio Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="accountSid">Account SID</Label>
              <Input
                id="accountSid"
                type="text"
                value={config.accountSid}
                onChange={(e) => setConfig({ ...config, accountSid: e.target.value })}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            
            <div>
              <Label htmlFor="authToken">Auth Token</Label>
              <Input
                id="authToken"
                type="password"
                value={config.authToken}
                onChange={(e) => setConfig({ ...config, authToken: e.target.value })}
                placeholder="Your Twilio Auth Token"
              />
            </div>
            
            <div>
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={config.phoneNumber}
                onChange={(e) => setConfig({ ...config, phoneNumber: e.target.value })}
                placeholder="+1234567890"
              />
            </div>
            
            <Button onClick={handleSave} className="w-full">
              Save Configuration
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
```

## 4. Agent Orchestrator Edge Function Deployment

### Issue
- Edge Function exists but not deployed
- Missing CORS configuration

### Fix Steps

1. **Deploy the Edge Function**
```bash
# From project root
cd supabase
supabase functions deploy agent-orchestrator
```

2. **Add CORS configuration**
```typescript
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};
```

3. **Fix Agent Orchestrator Service Client**
```typescript
// frontend/src/lib/services/agent-orchestrator.ts - Line 43
// Add better error handling for Edge Function calls
async listAgents(): Promise<Agent[]> {
  try {
    const { data, error } = await this.supabase.functions.invoke('agent-orchestrator', {
      body: { action: 'list', userId: this.userId }
    });

    if (error) {
      // Check if it's a 404 (function not deployed)
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        throw new Error('Agent Orchestrator Edge Function not deployed. Please run: supabase functions deploy agent-orchestrator');
      }
      throw error;
    }

    return data?.agents || [];
  } catch (error) {
    console.error('Failed to list agents:', error);
    // Return mock data if Edge Function not available
    if (error.message?.includes('not deployed')) {
      return this.getMockAgents();
    }
    throw error;
  }
},
```

## 5. Webhook Signature Implementation

### Issue
- Several webhooks missing signature validation
- Security vulnerability for unauthenticated webhooks

### Fix for Microsoft Graph Webhooks
```typescript
// frontend/src/app/api/microsoft/webhooks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withWebhookValidation } from '@/middleware/webhook-validation';
import crypto from 'crypto';

async function handleMicrosoftWebhook(request: NextRequest, body: any) {
  // Microsoft uses validation tokens, not signatures
  const validationToken = request.nextUrl.searchParams.get('validationToken');
  
  if (validationToken) {
    // Respond to validation request
    return new Response(validationToken, {
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // Process the webhook
  const { value } = body;
  
  for (const notification of value) {
    console.log('Microsoft notification:', notification);
    
    // Handle different resource types
    switch (notification.resourceData?.['@odata.type']) {
      case '#microsoft.graph.message':
        await handleEmailNotification(notification);
        break;
      case '#microsoft.graph.event':
        await handleCalendarNotification(notification);
        break;
    }
  }

  return NextResponse.json({ success: true });
}

export const POST = withWebhookValidation(handleMicrosoftWebhook, 'microsoft');
```

### Add Webhook Secret Generation Script
```typescript
// scripts/generate-webhook-secrets.js
const crypto = require('crypto');

const secrets = {
  ZOHO_WEBHOOK_TOKEN: crypto.randomBytes(32).toString('hex'),
  EMAIL_WEBHOOK_SECRET: crypto.randomBytes(32).toString('hex'),
  ZOOM_WEBHOOK_SECRET_TOKEN: crypto.randomBytes(32).toString('hex'),
  MICROSOFT_WEBHOOK_SECRET: crypto.randomBytes(32).toString('hex'),
  LINKEDIN_WEBHOOK_SECRET: crypto.randomBytes(32).toString('hex'),
};

console.log('Add these to your .env.local file:\n');
Object.entries(secrets).forEach(([key, value]) => {
  console.log(`${key}=${value}`);
});
```

## Implementation Priority

1. **Day 1: LinkedIn OAuth**
   - Add environment variables
   - Create integration status UI
   - Test OAuth flow

2. **Day 2: Microsoft Calendar Permissions**
   - Update OAuth scopes
   - Test calendar API calls
   - Verify token refresh

3. **Day 3: Agent Orchestrator**
   - Deploy Edge Function
   - Add fallback for development
   - Test real-time updates

4. **Day 4: Twilio Configuration**
   - Create settings UI
   - Add environment variables
   - Test webhook signatures

5. **Day 5: Webhook Security**
   - Generate webhook secrets
   - Update all webhook handlers
   - Add monitoring for failed validations

## Testing Checklist

- [ ] LinkedIn OAuth flow completes successfully
- [ ] Microsoft Calendar events can be created with Teams meetings
- [ ] Agent Orchestrator shows real-time progress
- [ ] Twilio can send/receive SMS and calls
- [ ] All webhooks validate signatures correctly

## Monitoring

Add integration health checks:
```typescript
// frontend/src/lib/monitoring/integration-health.ts
export async function checkIntegrationHealth() {
  const health = {
    linkedin: await checkLinkedInAuth(),
    microsoft: await checkMicrosoftScopes(),
    twilio: await checkTwilioConfig(),
    agentOrchestrator: await checkEdgeFunction(),
    webhooks: await checkWebhookSecrets(),
  };
  
  return health;
}
```