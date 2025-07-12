import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';

// Zoom webhook verification
function verifyWebhook(body: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  const expectedSignature = hmac.digest('hex');
  return signature === expectedSignature;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = headers();
    const signature = headersList.get('x-zm-signature');
    const timestamp = headersList.get('x-zm-request-timestamp');
    
    // Verify webhook if signature is present
    if (signature && process.env.ZOOM_WEBHOOK_SECRET) {
      const isValid = verifyWebhook(
        `v0:${timestamp}:${body}`,
        signature,
        process.env.ZOOM_WEBHOOK_SECRET
      );
      
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }
    
    const data = JSON.parse(body);
    
    // Handle different event types
    switch (data.event) {
      case 'bot_notification':
        // Handle chat messages
        await handleChatMessage(data);
        break;
        
      case 'bot_installed':
        // Handle bot installation
        console.log('Bot installed for account:', data.payload.accountId);
        break;
        
      case 'bot_uninstalled':
        // Handle bot uninstallation
        console.log('Bot uninstalled for account:', data.payload.accountId);
        break;
        
      default:
        console.log('Unhandled event type:', data.event);
    }
    
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Zoom chat webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleChatMessage(data: any) {
  const { cmd, userId, accountId, channelName } = data.payload;
  
  // Example: Handle interview-related commands
  if (cmd?.toLowerCase().includes('interview')) {
    // TODO: Implement interview scheduling logic
    console.log('Interview command received:', cmd);
  }
  
  // Add more command handlers as needed
}

// Zoom requires a GET endpoint for webhook validation
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    status: 'ok',
    message: 'EVA Assistant Zoom Chat Bot' 
  });
}