import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Check if Twilio is configured
    const requiredEnvVars = [
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN', 
      'TWILIO_PHONE_NUMBER'
    ]
    
    const missingVars = requiredEnvVars.filter(key => !process.env[key])
    
    if (missingVars.length > 0) {
      return NextResponse.json(
        { error: `Missing required environment variables: ${missingVars.join(', ')}` },
        { status: 400 }
      )
    }
    
    // Return sanitized configuration
    return NextResponse.json({
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER,
      voiceUrl: process.env.TWILIO_VOICE_URL,
      statusCallbackUrl: process.env.TWILIO_STATUS_CALLBACK_URL || process.env.NEXT_PUBLIC_APP_URL,
      configured: true
    })
  } catch (error) {
    console.error('Twilio config error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate Twilio credentials
    const { accountSid, authToken, phoneNumber } = body
    
    if (!accountSid || !authToken || !phoneNumber) {
      return NextResponse.json(
        { error: 'Missing required Twilio credentials' },
        { status: 400 }
      )
    }
    
    // Test the credentials by making a simple API call
    const twilio = require('twilio')(accountSid, authToken)
    
    try {
      await twilio.accounts(accountSid).fetch()
      
      return NextResponse.json({
        success: true,
        message: 'Twilio credentials validated successfully'
      })
    } catch (twilioError) {
      return NextResponse.json(
        { error: 'Invalid Twilio credentials' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('Twilio config validation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}