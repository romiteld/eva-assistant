import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getZohoCache } from '@/lib/zoho/cache-manager';
import crypto from 'crypto';
import { withRateLimit } from '@/middleware/rate-limit';

// Webhook event types we handle
const SUPPORTED_EVENTS = [
  'Leads.create',
  'Leads.update',
  'Leads.delete',
  'Contacts.create',
  'Contacts.update',
  'Contacts.delete',
  'Deals.create',
  'Deals.update',
  'Deals.delete',
  'Tasks.create',
  'Tasks.update',
  'Tasks.delete'
];

/**
 * POST /api/zoho/webhooks - Handle Zoho CRM webhooks
 */
export const POST = withRateLimit(async (request: NextRequest) => {
  try {
    const body = await request.text();
    const headers = Object.fromEntries(request.headers.entries());
    
    // Verify webhook signature
    const isValid = await verifyWebhookSignature(body, headers);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    // Parse webhook payload
    const payload = JSON.parse(body);
    console.log('Webhook received:', payload);
    
    // Process the webhook
    await processWebhook(payload);
    
    // Zoho expects a 200 OK response
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Return 200 to prevent Zoho from retrying
    return NextResponse.json({ success: false });
  }
}, 'webhook');

/**
 * GET /api/zoho/webhooks - Webhook verification endpoint
 */
export async function GET(request: NextRequest) {
  // Zoho sends a verification request when setting up webhooks
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get('challenge');
  
  if (challenge) {
    // Echo back the challenge for verification
    return new Response(challenge, {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  return NextResponse.json({ 
    status: 'ready',
    supported_events: SUPPORTED_EVENTS 
  });
}

/**
 * Verify webhook signature
 */
async function verifyWebhookSignature(
  body: string,
  headers: Record<string, string>
): Promise<boolean> {
  const webhookToken = process.env.ZOHO_WEBHOOK_TOKEN;
  if (!webhookToken) {
    console.warn('ZOHO_WEBHOOK_TOKEN not configured');
    // Only allow in development mode
    return process.env.NODE_ENV === 'development';
  }
  
  const signature = headers['x-zoho-webhook-signature'] || headers['x-zoho-signature'];
  if (!signature) {
    console.warn('No Zoho webhook signature found in headers');
    return false;
  }
  
  // Calculate expected signature
  const hmac = crypto.createHmac('sha256', webhookToken);
  hmac.update(body);
  const expectedSignature = hmac.digest('hex');
  
  // Compare signatures using constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Process webhook event
 */
async function processWebhook(payload: any) {
  const supabase = await createClient();
  const cache = getZohoCache();
  
  // Extract event details
  const { event_type, data, user_id, org_id } = payload;
  
  if (!SUPPORTED_EVENTS.includes(event_type)) {
    console.log(`Ignoring unsupported event: ${event_type}`);
    return;
  }
  
  // Log webhook event
  const { error: logError } = await supabase
    .from('zoho_webhook_logs')
    .insert({
      event_type,
      payload,
      user_id,
      org_id,
      processed_at: new Date().toISOString()
    });
  
  if (logError) {
    console.error('Error logging webhook:', logError);
  }
  
  // Invalidate relevant caches
  const [module] = event_type.split('.');
  await cache.invalidateModule(module);
  
  // Handle specific events
  switch (event_type) {
    case 'Leads.create':
      await handleLeadCreated(data, user_id);
      break;
      
    case 'Deals.create':
      await handleDealCreated(data, user_id);
      break;
      
    case 'Deals.update':
      await handleDealUpdated(data, user_id);
      break;
      
    // Add more event handlers as needed
  }
}

/**
 * Handle new lead creation
 */
async function handleLeadCreated(lead: any, userId: string) {
  const supabase = await createClient();
  
  // Example: Send notification
  await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'lead_created',
      title: 'New Lead Created',
      message: `New lead "${lead.Full_Name}" has been added to your CRM`,
      data: { lead_id: lead.id, lead_name: lead.Full_Name },
      read: false
    });
  
  // Example: Trigger lead enrichment
  if (lead.Email) {
    // Queue enrichment task
    const { error } = await supabase
      .from('zoho_request_queue')
      .insert({
        user_id: userId,
        org_id: lead.org_id,
        endpoint: `/Leads/${lead.id}`,
        method: 'PUT',
        payload: { 
          trigger: ['workflow'],
          data: [{ 
            id: lead.id,
            Enrichment_Status: 'pending' 
          }]
        },
        priority: 7,
        callback_id: `enrich_lead_${lead.id}`
      });
    
    if (error) {
      console.error('Error queuing enrichment:', error);
    }
  }
}

/**
 * Handle new deal creation
 */
async function handleDealCreated(deal: any, userId: string) {
  const supabase = await createClient();
  
  // Track deal creation time
  const creationTime = new Date().getTime() - new Date(deal.Created_Time).getTime();
  
  // Update analytics
  await supabase
    .from('deal_creation_analytics')
    .insert({
      user_id: userId,
      deal_id: deal.id,
      deal_name: deal.Deal_Name,
      amount: deal.Amount || 0,
      stage: deal.Stage,
      creation_time_ms: creationTime,
      created_at: new Date().toISOString()
    });
  
  // Send notification if creation was fast (< 30 seconds)
  if (creationTime < 30000) {
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'fast_deal_creation',
        title: '⚡ Lightning Fast Deal!',
        message: `Deal "${deal.Deal_Name}" created in ${Math.round(creationTime / 1000)}s`,
        data: { deal_id: deal.id, creation_time: creationTime },
        read: false
      });
  }
}

/**
 * Handle deal update
 */
async function handleDealUpdated(deal: any, userId: string) {
  const supabase = await createClient();
  
  // Check if stage changed
  if (deal.Stage && deal.Previous_Stage && deal.Stage !== deal.Previous_Stage) {
    // Track stage progression
    await supabase
      .from('deal_stage_transitions')
      .insert({
        user_id: userId,
        deal_id: deal.id,
        from_stage: deal.Previous_Stage,
        to_stage: deal.Stage,
        transitioned_at: new Date().toISOString()
      });
    
    // Send notification for important stage changes
    if (deal.Stage === 'Closed Won') {
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'deal_won',
          title: '🎉 Deal Won!',
          message: `Congratulations! "${deal.Deal_Name}" has been closed`,
          data: { 
            deal_id: deal.id, 
            amount: deal.Amount,
            stage: deal.Stage 
          },
          read: false
        });
    }
  }
}

/**
 * Create the webhook logs table if it doesn't exist
 */
async function ensureWebhookLogsTable() {
  const supabase = await createClient();
  
  // This would typically be in a migration, but adding here for completeness
  const { error } = await supabase.rpc('create_webhook_logs_table_if_not_exists');
  
  if (error) {
    console.error('Error ensuring webhook logs table:', error);
  }
}