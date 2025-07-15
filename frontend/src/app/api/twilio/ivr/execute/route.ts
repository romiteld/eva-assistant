import { NextRequest, NextResponse } from 'next/server'
import { createTwilioService } from '@/lib/services/twilio'
import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    
    if (!isValid && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      )
    }
    
    // Get call details
    const callSid = params.CallSid
    const from = params.From
    const to = params.To
    const digits = params.Digits
    const currentStep = params.currentStep || 'welcome'
    
    // Get active IVR flow for this phone number
    const { data: activeFlow } = await supabase
      .from('ivr_flows')
      .select('*')
      .eq('is_active', true)
      .eq('phone_number_sid', params.To)
      .single()
    
    if (!activeFlow) {
      // Default response if no active flow
      const response = new twilio.twiml.VoiceResponse()
      response.say('Thank you for calling The Well Recruiting Solutions. Our office is currently closed.')
      response.hangup()
      
      return new NextResponse(response.toString(), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      })
    }
    
    // Execute the current step
    const response = await executeIVRStep(activeFlow, currentStep, digits, params)
    
    // Log IVR interaction
    await logIVRInteraction({
      call_sid: callSid,
      flow_id: activeFlow.id,
      step_id: currentStep,
      user_input: digits,
      from_number: from,
      to_number: to,
      created_at: new Date().toISOString()
    })
    
    return new NextResponse(response, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    })
    
  } catch (error) {
    console.error('IVR execution error:', error)
    
    // Return error response
    const response = new twilio.twiml.VoiceResponse()
    response.say('We apologize for the inconvenience. Please try again later.')
    response.hangup()
    
    return new NextResponse(response.toString(), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    })
  }
}

async function executeIVRStep(
  flow: any,
  currentStepId: string,
  userInput: string | undefined,
  params: Record<string, any>
): Promise<string> {
  const VoiceResponse = twilio.twiml.VoiceResponse
  const response = new VoiceResponse()
  
  // Find the current step
  const steps = flow.steps as any[]
  let currentStep = steps.find(s => s.id === currentStepId)
  
  // If user input provided, determine next step
  if (userInput && currentStep?.nextSteps) {
    const nextStepId = currentStep.nextSteps[userInput] || currentStep.nextSteps.default
    if (nextStepId) {
      currentStep = steps.find(s => s.id === nextStepId)
    }
  }
  
  if (!currentStep) {
    // No valid step found, return to main menu or hang up
    response.say('Invalid selection. Returning to main menu.')
    currentStep = steps.find(s => s.id === 'main_menu') || steps[0]
  }
  
  // Execute step based on type
  switch (currentStep.type) {
    case 'welcome':
      response.say(currentStep.message)
      if (currentStep.nextSteps?.default) {
        response.redirect({
          method: 'POST'
        }, `/api/twilio/ivr/execute?currentStep=${currentStep.nextSteps.default}`)
      }
      break
      
    case 'menu':
      const menuGather = response.gather({
        numDigits: currentStep.options?.numDigits || 1,
        timeout: currentStep.options?.timeout || 10,
        action: `/api/twilio/ivr/execute?currentStep=${currentStep.id}`,
        method: 'POST'
      })
      menuGather.say(currentStep.message)
      
      // Add timeout redirect
      response.say('We did not receive your selection.')
      response.redirect({
        method: 'POST'
      }, `/api/twilio/ivr/execute?currentStep=${currentStep.id}`)
      break
      
    case 'gather':
      const gatherInput = response.gather({
        numDigits: currentStep.options?.numDigits || 10,
        timeout: currentStep.options?.timeout || 15,
        finishOnKey: currentStep.options?.finishOnKey || '#',
        action: currentStep.options?.action || `/api/twilio/ivr/process-input?stepId=${currentStep.id}`,
        method: 'POST'
      })
      gatherInput.say(currentStep.message)
      
      response.say('We did not receive your input.')
      response.redirect({
        method: 'POST'
      }, `/api/twilio/ivr/execute?currentStep=main_menu`)
      break
      
    case 'record':
      response.say(currentStep.message)
      response.record({
        maxLength: currentStep.options?.maxLength || 60,
        timeout: currentStep.options?.timeout || 5,
        finishOnKey: currentStep.options?.finishOnKey || '#',
        recordingStatusCallback: '/api/twilio/webhooks/recording',
        transcribe: true,
        transcribeCallback: '/api/twilio/webhooks/transcription',
        action: currentStep.options?.action || `/api/twilio/ivr/recording-complete?stepId=${currentStep.id}`,
        method: 'POST'
      })
      
      response.say('Thank you for your message. Goodbye.')
      response.hangup()
      break
      
    case 'transfer':
      response.say(currentStep.message)
      const dial = response.dial({
        action: '/api/twilio/webhooks/call-status',
        method: 'POST',
        timeout: 30,
        record: 'record-from-answer',
        recordingStatusCallback: '/api/twilio/webhooks/recording'
      })
      
      if (currentStep.options?.transferNumber) {
        dial.number(currentStep.options.transferNumber)
      } else {
        // Default transfer number
        dial.number(process.env.TWILIO_DEFAULT_TRANSFER_NUMBER || '+1234567890')
      }
      break
      
    case 'hangup':
      response.say(currentStep.message)
      response.hangup()
      break
      
    default:
      response.say('Thank you for calling. Goodbye.')
      response.hangup()
  }
  
  return response.toString()
}

async function logIVRInteraction(data: any) {
  try {
    await supabase
      .from('ivr_interactions')
      .insert([data])
  } catch (error) {
    console.error('Error logging IVR interaction:', error)
  }
}