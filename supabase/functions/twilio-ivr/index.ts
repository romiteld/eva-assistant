import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import twilio from 'https://esm.sh/twilio@4.19.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface IVRRequest {
  CallSid: string
  From: string
  To: string
  Direction: string
  CallerName?: string
  Digits?: string
  SpeechResult?: string
  step?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get the webhook signature
    const signature = req.headers.get('X-Twilio-Signature')
    if (!signature) {
      return new Response('Unauthorized: Missing signature', { status: 401 })
    }
    
    // Parse the request
    const formData = await req.formData()
    const body: IVRRequest = {}
    for (const [key, value] of formData.entries()) {
      body[key as keyof IVRRequest] = value as string
    }
    
    // Validate the webhook signature
    const url = req.url
    const params = Object.fromEntries(formData.entries())
    const isValid = twilio.validateRequest(
      twilioAuthToken,
      signature,
      url,
      params
    )
    
    if (!isValid) {
      return new Response('Unauthorized: Invalid signature', { status: 401 })
    }
    
    // Get URL parameters
    const urlParams = new URL(req.url).searchParams
    const step = urlParams.get('step') || body.step || 'welcome'
    
    // Generate appropriate TwiML response based on step
    const twiml = new twilio.twiml.VoiceResponse()
    
    switch (step) {
      case 'welcome':
        twiml.say({
          voice: 'alice',
          language: 'en-US'
        }, 'Welcome to The Well Recruiting Solutions.')
        twiml.redirect('/twilio-ivr?step=main_menu')
        break
        
      case 'main_menu':
        const gather = twiml.gather({
          numDigits: 1,
          timeout: 10,
          action: '/twilio-ivr/selection',
        })
        gather.say({
          voice: 'alice',
          language: 'en-US'
        }, 'Press 1 to check your application status. Press 2 to schedule an interview. Press 3 to leave a message. Press 0 to speak with a recruiter.')
        
        // If no input, repeat the menu
        twiml.redirect('/twilio-ivr?step=main_menu')
        break
        
      case 'selection':
        const digit = body.Digits
        
        switch (digit) {
          case '1':
            await handleApplicationStatus(twiml, body, supabase)
            break
          case '2':
            await handleScheduleInterview(twiml, body, supabase)
            break
          case '3':
            await handleLeaveMessage(twiml, body, supabase)
            break
          case '0':
            await handleTransferToRecruiter(twiml, body, supabase)
            break
          default:
            twiml.say({
              voice: 'alice',
              language: 'en-US'
            }, 'Invalid selection.')
            twiml.redirect('/twilio-ivr?step=main_menu')
        }
        break
        
      case 'check_application':
        await checkApplicationStatus(twiml, body, supabase)
        break
        
      default:
        twiml.say({
          voice: 'alice',
          language: 'en-US'
        }, 'Thank you for calling The Well Recruiting Solutions. Goodbye.')
        twiml.hangup()
    }
    
    return new Response(twiml.toString(), {
      headers: {
        'Content-Type': 'text/xml',
        ...corsHeaders,
      },
    })
  } catch (error) {
    console.error('Error in IVR:', error)
    const twiml = new twilio.twiml.VoiceResponse()
    twiml.say('We apologize for the technical difficulty. Please call back later.')
    twiml.hangup()
    
    return new Response(twiml.toString(), {
      headers: {
        'Content-Type': 'text/xml',
        ...corsHeaders,
      },
    })
  }
})

async function handleApplicationStatus(
  twiml: any,
  body: IVRRequest,
  supabase: any
) {
  const gather = twiml.gather({
    numDigits: 6,
    finishOnKey: '#',
    timeout: 15,
    action: '/twilio-ivr?step=check_application',
  })
  gather.say({
    voice: 'alice',
    language: 'en-US'
  }, 'Please enter your 6-digit application ID followed by the pound key.')
  
  twiml.say('No input received.')
  twiml.redirect('/twilio-ivr?step=main_menu')
}

async function checkApplicationStatus(
  twiml: any,
  body: IVRRequest,
  supabase: any
) {
  const applicationId = body.Digits
  
  // Look up application in database
  const { data: application, error } = await supabase
    .from('applications')
    .select('status, candidate_name, position')
    .eq('application_id', applicationId)
    .single()
  
  if (error || !application) {
    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, 'Application ID not found. Please check your ID and try again.')
  } else {
    let statusMessage = `Hello ${application.candidate_name}. Your application for the ${application.position} position is currently ${application.status}.`
    
    switch (application.status) {
      case 'under_review':
        statusMessage += ' Our team is reviewing your qualifications and will contact you soon.'
        break
      case 'interview_scheduled':
        statusMessage += ' Please check your email for interview details.'
        break
      case 'pending_decision':
        statusMessage += ' We are finalizing our decision and will contact you within 48 hours.'
        break
      case 'offer_extended':
        statusMessage += ' Congratulations! Please check your email for offer details.'
        break
      case 'rejected':
        statusMessage += ' We appreciate your interest but have decided to move forward with other candidates.'
        break
    }
    
    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, statusMessage)
  }
  
  twiml.say('Press any key to return to the main menu.')
  twiml.redirect('/twilio-ivr?step=main_menu')
}

async function handleScheduleInterview(
  twiml: any,
  body: IVRRequest,
  supabase: any
) {
  twiml.say({
    voice: 'alice',
    language: 'en-US'
  }, 'To schedule an interview, please leave your name and preferred time after the beep.')
  
  twiml.record({
    maxLength: 60,
    transcribe: true,
    transcribeCallback: '/twilio-webhook',
    action: '/twilio-ivr?step=interview_recorded',
  })
  
  // Save the recording intent
  await supabase
    .from('twilio_webhook_events')
    .insert({
      event_type: 'interview_request',
      resource_type: 'call',
      resource_sid: body.CallSid,
      account_sid: 'pending',
      payload: {
        from: body.From,
        type: 'interview_scheduling'
      },
      processed: false,
    })
}

async function handleLeaveMessage(
  twiml: any,
  body: IVRRequest,
  supabase: any
) {
  twiml.say({
    voice: 'alice',
    language: 'en-US'
  }, 'Please leave your message after the beep.')
  
  twiml.record({
    maxLength: 120,
    transcribe: true,
    transcribeCallback: '/twilio-webhook',
    action: '/twilio-ivr?step=message_recorded',
  })
  
  // Save the recording intent
  await supabase
    .from('twilio_webhook_events')
    .insert({
      event_type: 'voicemail',
      resource_type: 'call',
      resource_sid: body.CallSid,
      account_sid: 'pending',
      payload: {
        from: body.From,
        type: 'general_message'
      },
      processed: false,
    })
}

async function handleTransferToRecruiter(
  twiml: any,
  body: IVRRequest,
  supabase: any
) {
  // Get available recruiter from database or configuration
  const recruiterPhone = Deno.env.get('RECRUITER_PHONE_NUMBER') || '+1234567890'
  
  twiml.say({
    voice: 'alice',
    language: 'en-US'
  }, 'Connecting you to a recruiter. Please hold.')
  
  const dial = twiml.dial({
    callerId: body.To,
    timeout: 30,
    action: '/twilio-ivr?step=transfer_complete',
  })
  dial.number(recruiterPhone)
  
  // Log the transfer attempt
  await supabase
    .from('twilio_webhook_events')
    .insert({
      event_type: 'transfer_to_recruiter',
      resource_type: 'call',
      resource_sid: body.CallSid,
      account_sid: 'pending',
      payload: {
        from: body.From,
        transferred_to: recruiterPhone,
      },
      processed: false,
    })
}