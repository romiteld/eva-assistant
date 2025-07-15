import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { EmailAutomationRules } from '@/lib/automation/email-rules';
import { EmailDealParser } from '@/lib/email/deal-parser';
import { ZohoCRMClient } from '@/lib/integrations/zoho';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

// Force dynamic to prevent static rendering issues
export const dynamic = 'force-dynamic';

// Initialize Redis for queue management
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Webhook signature verification
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get webhook signature
    const signature = headers().get('x-webhook-signature');
    const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('EMAIL_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }
    
    // Get request body
    const body = await request.text();
    
    // Verify signature if provided
    if (signature && !verifyWebhookSignature(body, signature, webhookSecret)) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }
    
    // Parse the email data
    const emailData = JSON.parse(body);
    
    // Validate required fields
    if (!emailData.id || !emailData.from || !emailData.subject) {
      return NextResponse.json(
        { error: 'Missing required email fields' },
        { status: 400 }
      );
    }
    
    // Check if email is already being processed (prevent duplicates)
    const processingKey = `email:processing:${emailData.id}`;
    const isProcessing = await redis.get(processingKey);
    
    if (isProcessing) {
      return NextResponse.json(
        { message: 'Email already being processed', id: emailData.id },
        { status: 202 }
      );
    }
    
    // Mark email as being processed (with 5 minute TTL)
    await redis.setex(processingKey, 300, 'true');
    
    // Queue the email for processing
    const queueData = {
      id: emailData.id,
      from: emailData.from,
      to: emailData.to,
      cc: emailData.cc,
      bcc: emailData.bcc,
      subject: emailData.subject,
      body: emailData.body,
      bodyHtml: emailData.bodyHtml,
      attachments: emailData.attachments || [],
      receivedAt: emailData.receivedAt || new Date().toISOString(),
      messageId: emailData.messageId,
      inReplyTo: emailData.inReplyTo,
      references: emailData.references,
      headers: emailData.headers,
      source: emailData.source || 'webhook',
      priority: calculateEmailPriority(emailData),
      queuedAt: new Date().toISOString()
    };
    
    // Add to processing queue
    const queueKey = 'email:queue';
    await redis.zadd(queueKey, {
      score: queueData.priority,
      member: JSON.stringify(queueData)
    });
    
    // Trigger immediate processing for high-priority emails
    if (queueData.priority >= 8) {
      // Process inline for urgent emails
      try {
        const result = await processEmailInline(queueData);
        
        // Log webhook processing
        await logWebhookEvent({
          type: 'email_received',
          status: 'processed_inline',
          email_id: emailData.id,
          duration: Date.now() - startTime,
          priority: queueData.priority,
          result
        });
        
        return NextResponse.json({
          message: 'Email processed successfully',
          id: emailData.id,
          processed: true,
          duration: Date.now() - startTime,
          result
        });
      } catch (error) {
        console.error('Error processing high-priority email:', error);
        // Don't fail the webhook, let background processor handle it
      }
    }
    
    // Log webhook event
    await logWebhookEvent({
      type: 'email_received',
      status: 'queued',
      email_id: emailData.id,
      duration: Date.now() - startTime,
      priority: queueData.priority
    });
    
    return NextResponse.json({
      message: 'Email queued for processing',
      id: emailData.id,
      queued: true,
      priority: queueData.priority,
      position: await redis.zrank(queueKey, JSON.stringify(queueData))
    });
    
  } catch (error) {
    console.error('Email webhook error:', error);
    
    // Log error
    await logWebhookEvent({
      type: 'email_received',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime
    });
    
    return NextResponse.json(
      { error: 'Failed to process email webhook' },
      { status: 500 }
    );
  }
}

// Calculate email priority based on content and sender
function calculateEmailPriority(email: any): number {
  let priority = 5; // Default priority
  
  // Check for urgency indicators
  const urgentKeywords = ['urgent', 'asap', 'immediately', 'critical', 'emergency'];
  const content = `${email.subject} ${email.body}`.toLowerCase();
  
  for (const keyword of urgentKeywords) {
    if (content.includes(keyword)) {
      priority += 2;
      break;
    }
  }
  
  // Check for VIP senders (could be configured per user)
  const vipDomains = process.env.VIP_EMAIL_DOMAINS?.split(',') || [];
  const senderDomain = email.from.email.split('@')[1];
  
  if (vipDomains.includes(senderDomain)) {
    priority += 3;
  }
  
  // Check for deal-related keywords
  const dealKeywords = ['contract', 'proposal', 'agreement', 'deal', 'opportunity'];
  for (const keyword of dealKeywords) {
    if (content.includes(keyword)) {
      priority += 1;
      break;
    }
  }
  
  // Check if it's a reply (usually more important)
  if (email.inReplyTo || email.subject?.toLowerCase().startsWith('re:')) {
    priority += 1;
  }
  
  // Cap priority at 10
  return Math.min(priority, 10);
}

// Process email immediately (for high-priority emails)
async function processEmailInline(emailData: any) {
  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  // Get user ID from email recipient or default user
  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('email', emailData.to[0]?.email || process.env.DEFAULT_USER_EMAIL)
    .single();
  
  if (!userData) {
    throw new Error('User not found for email processing');
  }
  
  const userId = userData.id;
  
  // Initialize services
  const zoho = new ZohoClient(
    process.env.ZOHO_CLIENT_ID!,
    process.env.ZOHO_CLIENT_SECRET!,
    process.env.ZOHO_REFRESH_TOKEN!
  );
  
  const automationRules = new EmailAutomationRules(zoho, userId);
  
  // Process email through automation rules
  const result = await automationRules.processEmail(emailData);
  
  // Store email record
  const { error: emailError } = await supabase
    .from('processed_emails')
    .insert({
      id: emailData.id,
      user_id: userId,
      from_email: emailData.from.email,
      from_name: emailData.from.name,
      to_emails: emailData.to.map((t: any) => t.email),
      subject: emailData.subject,
      body: emailData.body,
      body_html: emailData.bodyHtml,
      attachments: emailData.attachments,
      received_at: emailData.receivedAt,
      processed_at: new Date().toISOString(),
      automation_result: result,
      priority: emailData.priority,
      source: 'webhook'
    });
  
  if (emailError) {
    console.error('Error storing email record:', emailError);
  }
  
  return result;
}

// Log webhook events for monitoring
async function logWebhookEvent(event: any) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    await supabase
      .from('webhook_logs')
      .insert({
        webhook_type: 'email',
        event_type: event.type,
        status: event.status,
        payload: event,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error logging webhook event:', error);
  }
}

// GET endpoint to check webhook status
export async function GET() {
  try {
    // Get queue status
    const queueLength = await redis.zcard('email:queue');
    const processingCount = await redis.keys('email:processing:*');
    
    // Get recent webhook logs
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: recentLogs } = await supabase
      .from('webhook_logs')
      .select('*')
      .eq('webhook_type', 'email')
      .order('created_at', { ascending: false })
      .limit(10);
    
    return NextResponse.json({
      status: 'active',
      queue: {
        length: queueLength,
        processing: processingCount.length
      },
      recentLogs: recentLogs || [],
      config: {
        webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/email`,
        secretConfigured: !!process.env.EMAIL_WEBHOOK_SECRET,
        vipDomains: process.env.VIP_EMAIL_DOMAINS?.split(',') || []
      }
    });
  } catch (error) {
    console.error('Error getting webhook status:', error);
    return NextResponse.json(
      { error: 'Failed to get webhook status' },
      { status: 500 }
    );
  }
}