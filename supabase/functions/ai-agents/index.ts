// AI Agents Handler - Coordinates specialized agents
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.23.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!)

// Agent definitions
const agents = {
  email: {
    model: 'gemini-2.5-pro',
    systemPrompt: `You are an expert email assistant for Steve Perry, CEO of The Well Recruiting Solutions. 
    You help draft professional emails for recruiting financial advisors. Always maintain a professional yet personable tone.
    Consider the context of advisor recruiting, compensation negotiations, and relationship building.`,
    temperature: 0.7
  },
  
  deal: {
    model: 'gemini-2.5-pro',
    systemPrompt: `You are a deal management specialist for financial advisor placements. 
    You track candidate progress, manage compensation negotiations, and ensure smooth placement processes.
    You have deep knowledge of financial advisor compensation structures, transition deals, and industry standards.`,
    temperature: 0.7
  },
  
  content: {
    model: 'gemini-2.5-flash',
    systemPrompt: `You are a content creation expert specializing in LinkedIn and social media content for the recruiting industry. 
    Create engaging, professional content that showcases expertise and attracts both candidates and clients.
    Focus on financial advisor recruiting, industry trends, and success stories.`,
    temperature: 0.9
  },
  
  research: {
    model: 'gemini-2.5-pro',
    systemPrompt: `You are a research analyst specializing in financial advisor recruiting. 
    You gather information about firms, advisors, and market trends to support placement decisions.
    You can analyze data from multiple sources and provide actionable insights.`,
    temperature: 0.6
  },
  
  scheduling: {
    model: 'gemini-2.5-flash',
    systemPrompt: `You are a scheduling coordinator who manages calendars, books meetings, and optimizes time management. 
    You integrate with Zoom and Outlook to create seamless scheduling experiences.
    Always consider time zones and provide clear meeting details.`,
    temperature: 0.7
  },
  
  candidate: {
    model: 'gemini-2.5-pro',
    systemPrompt: `You are a candidate relationship specialist who manages the entire candidate experience.
    You help with candidate sourcing, screening, interview preparation, and placement follow-up.
    Always maintain confidentiality and provide personalized guidance.`,
    temperature: 0.8
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { agent: agentType, prompt, context, tools, stream } = await req.json()
    
    // Validate agent type
    if (!agents[agentType]) {
      throw new Error(`Unknown agent type: ${agentType}`)
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from auth header
    const authHeader = req.headers.get('authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Get agent configuration
    const agentConfig = agents[agentType]
    const model = genAI.getGenerativeModel({ 
      model: agentConfig.model,
      generationConfig: {
        temperature: agentConfig.temperature,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    })

    // Build full prompt with context
    const fullPrompt = buildPromptWithContext(
      agentConfig.systemPrompt,
      prompt,
      context,
      tools
    )

    // Generate response
    let response: string
    
    if (stream) {
      // Handle streaming response
      const result = await model.generateContentStream(fullPrompt)
      
      const encoder = new TextEncoder()
      const body = new ReadableStream({
        async start(controller) {
          for await (const chunk of result.stream) {
            const text = chunk.text()
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      })

      return new Response(body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      })
    } else {
      // Handle regular response
      const result = await model.generateContent(fullPrompt)
      response = result.response.text()

      // Parse and execute any tool calls
      const toolCalls = parseToolCalls(response)
      if (toolCalls.length > 0) {
        const toolResults = await executeTools(toolCalls, user.id, supabase)
        
        // Generate final response with tool results
        const finalPrompt = `
        ${fullPrompt}
        
        Tool Results:
        ${JSON.stringify(toolResults, null, 2)}
        
        Please provide a final response incorporating these results.
        `
        
        const finalResult = await model.generateContent(finalPrompt)
        response = finalResult.response.text()
      }

      // Log conversation
      await supabase
        .from('agent_conversations')
        .insert({
          user_id: user.id,
          agent_type: agentType,
          prompt,
          response,
          context,
          tools_used: toolCalls.map(tc => tc.name),
          created_at: new Date().toISOString()
        })

      return new Response(
        JSON.stringify({ 
          response,
          agent: agentType,
          toolsExecuted: toolCalls
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

  } catch (error) {
    console.error('Agent error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function buildPromptWithContext(
  systemPrompt: string,
  userPrompt: string,
  context: any,
  tools: string[]
) {
  let fullPrompt = systemPrompt + '\n\n'
  
  // Add context if provided
  if (context) {
    fullPrompt += 'Context:\n'
    
    if (context.previousMessages) {
      fullPrompt += 'Previous conversation:\n'
      context.previousMessages.forEach((msg: any) => {
        fullPrompt += `${msg.role}: ${msg.content}\n`
      })
      fullPrompt += '\n'
    }
    
    if (context.candidateInfo) {
      fullPrompt += `Candidate Information:\n${JSON.stringify(context.candidateInfo, null, 2)}\n\n`
    }
    
    if (context.dealInfo) {
      fullPrompt += `Deal Information:\n${JSON.stringify(context.dealInfo, null, 2)}\n\n`
    }
    
    if (context.companyInfo) {
      fullPrompt += `Company Information:\n${JSON.stringify(context.companyInfo, null, 2)}\n\n`
    }
  }
  
  // Add available tools
  if (tools && tools.length > 0) {
    fullPrompt += `
Available tools you can use:
${tools.map(tool => `- ${tool}`).join('\n')}

To use a tool, format your response like:
<tool_call>
{
  "name": "tool_name",
  "parameters": {
    "param1": "value1"
  }
}
</tool_call>

You can use multiple tools in your response.
`
  }
  
  fullPrompt += `\nUser request: ${userPrompt}`
  
  return fullPrompt
}

function parseToolCalls(response: string): any[] {
  const toolCalls = []
  const toolCallRegex = /<tool_call>([\s\S]*?)<\/tool_call>/g
  
  let match
  while ((match = toolCallRegex.exec(response)) !== null) {
    try {
      const toolCall = JSON.parse(match[1])
      toolCalls.push(toolCall)
    } catch (error) {
      console.error('Error parsing tool call:', error)
    }
  }
  
  return toolCalls
}

async function executeTools(
  toolCalls: any[],
  userId: string,
  supabase: any
): Promise<any[]> {
  const results = []
  
  for (const toolCall of toolCalls) {
    try {
      let result
      
      switch (toolCall.name) {
        case 'search_candidates':
          result = await searchCandidates(toolCall.parameters, userId, supabase)
          break
          
        case 'schedule_meeting':
          result = await scheduleMeeting(toolCall.parameters, userId, supabase)
          break
          
        case 'send_email':
          result = await sendEmail(toolCall.parameters, userId, supabase)
          break
          
        case 'update_crm':
          result = await updateCRM(toolCall.parameters, userId, supabase)
          break
          
        case 'search_web':
          result = await searchWeb(toolCall.parameters)
          break
          
        case 'analyze_document':
          result = await analyzeDocument(toolCall.parameters, userId, supabase)
          break
          
        case 'generate_content':
          result = await generateContent(toolCall.parameters, userId, supabase)
          break
          
        default:
          result = { error: `Unknown tool: ${toolCall.name}` }
      }
      
      results.push({
        tool: toolCall.name,
        result
      })
    } catch (error) {
      results.push({
        tool: toolCall.name,
        error: error.message
      })
    }
  }
  
  return results
}

// Tool implementations
async function searchCandidates(params: any, userId: string, supabase: any) {
  const { query, filters } = params
  
  let queryBuilder = supabase
    .from('candidates')
    .select('*')
    .eq('user_id', userId)
  
  if (query) {
    queryBuilder = queryBuilder.textSearch('search_vector', query)
  }
  
  if (filters?.skills) {
    queryBuilder = queryBuilder.contains('skills', filters.skills)
  }
  
  if (filters?.status) {
    queryBuilder = queryBuilder.eq('status', filters.status)
  }
  
  if (filters?.yearsExperience) {
    queryBuilder = queryBuilder.gte('years_experience', filters.yearsExperience)
  }
  
  const { data, error } = await queryBuilder.limit(20)
  
  if (error) throw error
  
  return { candidates: data }
}

async function scheduleMeeting(params: any, userId: string, supabase: any) {
  // This would integrate with the Zoom API
  // For now, return a mock response
  return {
    success: true,
    meeting: {
      id: 'zoom-' + crypto.randomUUID(),
      topic: params.topic,
      startTime: params.startTime,
      duration: params.duration,
      joinUrl: 'https://zoom.us/j/123456789',
      password: '123456'
    }
  }
}

async function sendEmail(params: any, userId: string, supabase: any) {
  // This would integrate with the Outlook API
  // For now, return a mock response
  return {
    success: true,
    email: {
      id: 'email-' + crypto.randomUUID(),
      to: params.to,
      subject: params.subject,
      sentAt: new Date().toISOString()
    }
  }
}

async function updateCRM(params: any, userId: string, supabase: any) {
  // This would integrate with the Zoho CRM API
  // For now, return a mock response
  return {
    success: true,
    record: {
      id: 'crm-' + crypto.randomUUID(),
      module: params.module,
      action: params.action,
      updatedAt: new Date().toISOString()
    }
  }
}

async function searchWeb(params: any) {
  // This would integrate with Firecrawl API
  // For now, return a mock response
  return {
    results: [
      {
        title: 'Sample search result',
        url: 'https://example.com',
        snippet: 'This is a sample search result...'
      }
    ]
  }
}

async function analyzeDocument(params: any, userId: string, supabase: any) {
  // This would process documents with Gemini
  // For now, return a mock response
  return {
    analysis: {
      summary: 'Document summary...',
      keyPoints: ['Point 1', 'Point 2'],
      sentiment: 'positive',
      recommendedActions: ['Action 1', 'Action 2']
    }
  }
}

async function generateContent(params: any, userId: string, supabase: any) {
  const { type, topic, platform, tone } = params
  
  // Use Gemini to generate content
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  
  const prompt = `
  Generate ${type} content for ${platform} about: ${topic}
  Tone: ${tone || 'professional'}
  
  Make it engaging and appropriate for financial advisor recruiting.
  `
  
  const result = await model.generateContent(prompt)
  const content = result.response.text()
  
  // Store generated content
  await supabase
    .from('generated_content')
    .insert({
      user_id: userId,
      type,
      platform,
      topic,
      content,
      created_at: new Date().toISOString()
    })
  
  return { content }
}