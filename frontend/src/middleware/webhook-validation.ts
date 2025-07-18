import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import twilio from 'twilio';

export interface WebhookConfig {
  provider: 'zoho' | 'twilio' | 'email' | 'zoom' | 'microsoft' | 'linkedin';
  secretEnvVar: string;
  signatureHeader: string;
  signatureFormat?: 'hex' | 'base64';
  algorithm?: 'sha256' | 'sha1';
  requireSignature?: boolean;
}

const WEBHOOK_CONFIGS: Record<string, WebhookConfig> = {
  zoho: {
    provider: 'zoho',
    secretEnvVar: 'ZOHO_WEBHOOK_TOKEN',
    signatureHeader: 'x-zoho-webhook-signature',
    signatureFormat: 'hex',
    algorithm: 'sha256',
    requireSignature: true,
  },
  twilio: {
    provider: 'twilio',
    secretEnvVar: 'TWILIO_AUTH_TOKEN',
    signatureHeader: 'x-twilio-signature',
    requireSignature: true,
  },
  email: {
    provider: 'email',
    secretEnvVar: 'EMAIL_WEBHOOK_SECRET',
    signatureHeader: 'x-webhook-signature',
    signatureFormat: 'hex',
    algorithm: 'sha256',
    requireSignature: true,
  },
  zoom: {
    provider: 'zoom',
    secretEnvVar: 'ZOOM_WEBHOOK_SECRET_TOKEN',
    signatureHeader: 'x-zm-signature',
    signatureFormat: 'hex',
    algorithm: 'sha256',
    requireSignature: true,
  },
  microsoft: {
    provider: 'microsoft',
    secretEnvVar: 'MICROSOFT_WEBHOOK_SECRET',
    signatureHeader: 'x-microsoft-signature',
    signatureFormat: 'base64',
    algorithm: 'sha256',
    requireSignature: false, // Microsoft Graph webhooks use validation tokens instead
  },
  linkedin: {
    provider: 'linkedin',
    secretEnvVar: 'LINKEDIN_WEBHOOK_SECRET',
    signatureHeader: 'x-linkedin-signature',
    signatureFormat: 'hex',
    algorithm: 'sha256',
    requireSignature: true,
  },
};

/**
 * Validate webhook signature based on provider
 */
export async function validateWebhookSignature(
  request: NextRequest,
  config: WebhookConfig,
  body: string
): Promise<boolean> {
  const secret = process.env[config.secretEnvVar];
  
  // In development, allow webhooks without signature if secret not configured
  if (!secret) {
    if (process.env.NODE_ENV === 'development' && !config.requireSignature) {
      console.warn(`${config.provider} webhook secret not configured - allowing in development`);
      return true;
    }
    console.error(`${config.secretEnvVar} not configured`);
    return false;
  }

  const signature = request.headers.get(config.signatureHeader);
  
  if (!signature) {
    console.error(`Missing ${config.signatureHeader} header`);
    return false;
  }

  // Special handling for Twilio
  if (config.provider === 'twilio') {
    return validateTwilioSignature(request, body, signature, secret);
  }

  // Special handling for Zoom
  if (config.provider === 'zoom') {
    return validateZoomSignature(request, body, signature, secret);
  }

  // Standard HMAC validation
  return validateHmacSignature(body, signature, secret, config);
}

/**
 * Standard HMAC signature validation
 */
function validateHmacSignature(
  body: string,
  signature: string,
  secret: string,
  config: WebhookConfig
): boolean {
  const algorithm = config.algorithm || 'sha256';
  const format = config.signatureFormat || 'hex';
  
  const hmac = crypto.createHmac(algorithm, secret);
  hmac.update(body);
  const expectedSignature = hmac.digest(format);
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, format),
      Buffer.from(expectedSignature, format)
    );
  } catch (error) {
    console.error('Signature comparison error:', error);
    return false;
  }
}

/**
 * Twilio-specific signature validation
 */
function validateTwilioSignature(
  request: NextRequest,
  body: string,
  signature: string,
  authToken: string
): boolean {
  try {
    const url = request.url;
    
    // Parse form data for Twilio webhooks
    const params = Object.fromEntries(new URLSearchParams(body));
    
    // Use Twilio's built-in validation
    return twilio.validateRequest(
      authToken,
      signature,
      url,
      params
    );
  } catch (error) {
    console.error('Twilio signature validation error:', error);
    return false;
  }
}

/**
 * Zoom-specific signature validation
 */
function validateZoomSignature(
  request: NextRequest,
  body: string,
  signature: string,
  secret: string
): boolean {
  try {
    // Zoom uses a specific format: v0=hash
    const parts = signature.split('=');
    if (parts.length !== 2 || parts[0] !== 'v0') {
      return false;
    }
    
    const timestamp = request.headers.get('x-zm-request-timestamp');
    if (!timestamp) {
      console.error('Missing x-zm-request-timestamp header');
      return false;
    }
    
    // Zoom signature = HMAC(timestamp.body, secret)
    const message = `v0:${timestamp}:${body}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(message);
    const expectedSignature = `v0=${hmac.digest('hex')}`;
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Zoom signature validation error:', error);
    return false;
  }
}

/**
 * Middleware to validate webhook signatures
 */
export function withWebhookValidation(
  handler: (request: NextRequest, body: any) => Promise<NextResponse>,
  provider: keyof typeof WEBHOOK_CONFIGS
) {
  return async (request: NextRequest) => {
    const config = WEBHOOK_CONFIGS[provider];
    
    if (!config) {
      console.error(`Unknown webhook provider: ${provider}`);
      return NextResponse.json(
        { error: 'Invalid webhook configuration' },
        { status: 500 }
      );
    }

    try {
      // Read body as text for signature validation
      const body = await request.text();
      
      // Validate signature
      const isValid = await validateWebhookSignature(request, config, body);
      
      if (!isValid && config.requireSignature) {
        console.error(`Invalid ${provider} webhook signature`);
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        );
      }
      
      // Parse body based on content type
      let parsedBody: any;
      const contentType = request.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        parsedBody = JSON.parse(body);
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        parsedBody = Object.fromEntries(new URLSearchParams(body));
      } else {
        parsedBody = body;
      }
      
      // Call the handler with parsed body
      return handler(request, parsedBody);
      
    } catch (error) {
      console.error(`${provider} webhook error:`, error);
      return NextResponse.json(
        { error: 'Webhook processing failed' },
        { status: 500 }
      );
    }
  };
}

/**
 * Log webhook event for monitoring
 */
export async function logWebhookEvent(
  provider: string,
  eventType: string,
  status: 'success' | 'error' | 'invalid_signature',
  payload?: any,
  error?: string
) {
  try {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${provider}] Webhook ${eventType}: ${status}`, {
        payload,
        error,
        timestamp: new Date().toISOString(),
      });
    }
    
    // In production, you might want to send to a logging service
    // Example: await logger.info('webhook_event', { provider, eventType, status, payload, error });
    
  } catch (err) {
    console.error('Failed to log webhook event:', err);
  }
}