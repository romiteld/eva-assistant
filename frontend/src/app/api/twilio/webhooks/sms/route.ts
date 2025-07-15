import { NextRequest, NextResponse } from 'next/server'
import { createTwilioService } from '@/lib/services/twilio'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('X-Twilio-Signature') || ''
    const url = request.url
    
    // Parse form data
    const formData = new URLSearchParams(body)
    const params = Object.fromEntries(formData)
    
    // Validate webhook signature
    const twilioService = createTwilioService()
    const isValid = twilioService.validateWebhookSignature(
      signature,
      url,
      params
    )
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      )
    }
    
    // Process the incoming SMS
    const smsData = twilioService.processIncomingWebhook(params)
    
    console.log('Incoming SMS:', smsData)
    
    // Here you could:
    // - Save to database
    // - Trigger automated responses
    // - Route to appropriate handlers
    // - Update candidate records
    
    // Example: Auto-reply for specific keywords
    if (smsData.body.toLowerCase().includes('status')) {
      // Send automatic status update
      await twilioService.sendSMS(smsData.from, 
        'Thank you for your inquiry. We will review your application and get back to you within 24 hours.'
      )
    }
    
    if (smsData.body.toLowerCase().includes('interview')) {
      // Route to interview scheduling
      await twilioService.sendSMS(smsData.from, 
        'Thank you for your interest in scheduling an interview. A recruiter will contact you shortly to arrange a time.'
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('SMS webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}