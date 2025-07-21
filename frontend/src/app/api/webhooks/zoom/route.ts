import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { zoomService } from '@/lib/services/zoom';
import { zoomServerToServerService } from '@/lib/services/zoom-server-to-server';
import { withRateLimit } from '@/middleware/rate-limit';

const ZOOM_WEBHOOK_SECRET_TOKEN = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
const ZOOM_API_KEY = process.env.ZOOM_API_KEY;

export const POST = withRateLimit(async (request: NextRequest) => {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-zm-signature');
    const timestamp = request.headers.get('x-zm-request-timestamp');
    const authHeader = request.headers.get('authorization');

    // For Server-to-Server OAuth, verify the API key in auth header
    if (ZOOM_API_KEY && authHeader) {
      const providedApiKey = authHeader.replace('Bearer ', '');
      if (providedApiKey !== ZOOM_API_KEY) {
        console.error('Invalid Zoom API key in webhook');
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      }
    }

    // Verify webhook signature if webhook secret is configured
    if (ZOOM_WEBHOOK_SECRET_TOKEN && signature && timestamp && !verifyWebhookSignature(body, signature, timestamp)) {
      console.error('Invalid Zoom webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);

    // Handle URL validation (required by Zoom)
    if (event.event === 'endpoint.url_validation') {
      if (ZOOM_WEBHOOK_SECRET_TOKEN) {
        const hashForValidate = crypto
          .createHmac('sha256', ZOOM_WEBHOOK_SECRET_TOKEN)
          .update(event.payload.plainToken)
          .digest('hex');

        return NextResponse.json({
          plainToken: event.payload.plainToken,
          encryptedToken: hashForValidate
        });
      } else if (ZOOM_API_KEY) {
        // For Server-to-Server OAuth, use API key for validation
        const hashForValidate = crypto
          .createHmac('sha256', ZOOM_API_KEY)
          .update(event.payload.plainToken)
          .digest('hex');

        return NextResponse.json({
          plainToken: event.payload.plainToken,
          encryptedToken: hashForValidate
        });
      }
    }

    // Process webhook event with appropriate service
    if (ZOOM_API_KEY && !ZOOM_WEBHOOK_SECRET_TOKEN) {
      // Use Server-to-Server service
      await zoomServerToServerService.handleWebhook(event);
    } else {
      // Use traditional OAuth service
      await zoomService.handleWebhook(event);
    }

    return NextResponse.json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Error processing Zoom webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, 'webhook');

function verifyWebhookSignature(body: string, signature: string, timestamp: string): boolean {
  if (!ZOOM_WEBHOOK_SECRET_TOKEN) return false;
  
  const message = `v0:${timestamp}:${body}`;
  const hash = crypto
    .createHmac('sha256', ZOOM_WEBHOOK_SECRET_TOKEN)
    .update(message)
    .digest('hex');
  const expectedSignature = `v0=${hash}`;
  
  return expectedSignature === signature;
}