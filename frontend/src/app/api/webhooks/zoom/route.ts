import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { zoomService } from '@/lib/services/zoom';

const ZOOM_WEBHOOK_SECRET_TOKEN = process.env.ZOOM_WEBHOOK_SECRET_TOKEN!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-zm-signature');
    const timestamp = request.headers.get('x-zm-request-timestamp');

    // Verify webhook signature
    if (signature && timestamp && !verifyWebhookSignature(body, signature, timestamp)) {
      console.error('Invalid Zoom webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);

    // Handle URL validation (required by Zoom)
    if (event.event === 'endpoint.url_validation') {
      const hashForValidate = crypto
        .createHmac('sha256', ZOOM_WEBHOOK_SECRET_TOKEN)
        .update(event.payload.plainToken)
        .digest('hex');

      return NextResponse.json({
        plainToken: event.payload.plainToken,
        encryptedToken: hashForValidate
      });
    }

    // Process webhook event
    await zoomService.handleWebhook(event);

    return NextResponse.json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Error processing Zoom webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function verifyWebhookSignature(body: string, signature: string, timestamp: string): boolean {
  const message = `v0:${timestamp}:${body}`;
  const hash = crypto
    .createHmac('sha256', ZOOM_WEBHOOK_SECRET_TOKEN)
    .update(message)
    .digest('hex');
  const expectedSignature = `v0=${hash}`;
  
  return expectedSignature === signature;
}