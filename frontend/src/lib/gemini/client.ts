import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini clients
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!)

// Model configurations
export const models = {
  // Gemini 2.5 Pro - For complex reasoning and analysis
  pro: genAI.getGenerativeModel({ 
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    },
  }),

  // Gemini 2.5 Flash - For quick responses and high volume
  flash: genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 4096,
    },
  }),

  // Gemini 2.5 Flash Live - For real-time conversations
  flashLive: genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash-live',
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 2048,
    },
  }),
}

// Gemini Live API WebSocket connection
export class GeminiLiveClient {
  private ws: WebSocket | null = null
  private apiKey: string
  private onMessage: ((data: any) => void) | null = null
  private onError: ((error: any) => void) | null = null
  private mediaStream: MediaStream | null = null

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  connect() {
    // Connect to Gemini Live API WebSocket
    // Note: This is a simplified example - actual endpoint would be different
    const wsUrl = `wss://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${this.apiKey}`
    
    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      console.log('Connected to Gemini Live API')
      this.sendConfig()
    }

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (this.onMessage) {
        this.onMessage(data)
      }
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      if (this.onError) {
        this.onError(error)
      }
    }

    this.ws.onclose = () => {
      console.log('Disconnected from Gemini Live API')
    }
  }

  private sendConfig() {
    if (!this.ws) return

    const config = {
      type: 'config',
      config: {
        model: 'gemini-2.5-flash-live',
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 2048,
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: 'search_candidates',
                description: 'Search for candidates in the database',
                parameters: {
                  type: 'object',
                  properties: {
                    query: { type: 'string' },
                    filters: { type: 'object' }
                  }
                }
              },
              {
                name: 'schedule_meeting',
                description: 'Schedule a meeting with Zoom integration',
                parameters: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    attendees: { type: 'array', items: { type: 'string' } },
                    datetime: { type: 'string' },
                    duration: { type: 'number' }
                  }
                }
              },
              {
                name: 'send_email',
                description: 'Send an email via Outlook',
                parameters: {
                  type: 'object',
                  properties: {
                    to: { type: 'string' },
                    subject: { type: 'string' },
                    body: { type: 'string' }
                  }
                }
              }
            ]
          }
        ]
      }
    }

    this.ws.send(JSON.stringify(config))
  }

  sendAudio(audioData: ArrayBuffer) {
    if (!this.ws) return

    const message = {
      type: 'audio',
      audio: {
        data: btoa(String.fromCharCode(...new Uint8Array(audioData))),
        mimeType: 'audio/pcm;rate=16000'
      }
    }

    this.ws.send(JSON.stringify(message))
  }

  sendVideo(frameData: ArrayBuffer) {
    if (!this.ws) return

    const message = {
      type: 'video',
      video: {
        data: btoa(String.fromCharCode(...new Uint8Array(frameData))),
        mimeType: 'image/jpeg'
      }
    }

    this.ws.send(JSON.stringify(message))
  }

  sendScreenShare(stream: MediaStream) {
    this.mediaStream = stream
    
    // Capture frames and send them
    const video = document.createElement('video')
    video.srcObject = stream
    video.play()

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    const captureFrame = () => {
      if (!ctx || !this.mediaStream) return

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)

      canvas.toBlob((blob) => {
        if (blob) {
          blob.arrayBuffer().then((buffer) => {
            this.sendVideo(buffer)
          })
        }
      }, 'image/jpeg', 0.8)

      if (this.mediaStream.active) {
        setTimeout(captureFrame, 100) // 10 fps
      }
    }

    video.onloadedmetadata = () => {
      captureFrame()
    }
  }

  onMessageReceived(callback: (data: any) => void) {
    this.onMessage = callback
  }

  onErrorReceived(callback: (error: any) => void) {
    this.onError = callback
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }
  }
}

// Helper functions for different use cases
export const geminiHelpers = {
  // Generate content with thinking mode
  async generateWithThinking(prompt: string, useFlash: boolean = false) {
    const model = useFlash ? models.flash : models.pro
    
    const thinkingPrompt = `
    <thinking>
    Think through this step by step before responding.
    </thinking>

    ${prompt}
    `

    const result = await model.generateContent(thinkingPrompt)
    return result.response.text()
  },

  // Generate structured data
  async generateStructuredData(prompt: string, schema: any) {
    const structuredPrompt = `
    ${prompt}

    Return your response as valid JSON matching this schema:
    ${JSON.stringify(schema, null, 2)}
    `

    const result = await models.pro.generateContent(structuredPrompt)
    const text = result.response.text()
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    throw new Error('No valid JSON found in response')
  },

  // Analyze image with Gemini
  async analyzeImage(imageData: ArrayBuffer, prompt: string) {
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: btoa(String.fromCharCode(...new Uint8Array(imageData)))
      }
    }

    const result = await models.pro.generateContent([prompt, imagePart])
    return result.response.text()
  },

  // Generate embeddings for vector search
  async generateEmbedding(text: string) {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-3' })
    const result = await model.embedContent(text)
    return result.embedding.values
  },

  // Stream response for real-time updates
  async streamResponse(prompt: string, onChunk: (text: string) => void) {
    const result = await models.flash.generateContentStream(prompt)
    
    for await (const chunk of result.stream) {
      const chunkText = chunk.text()
      onChunk(chunkText)
    }
  },

  // Generate conversation response with context
  async generateConversationResponse(message: string, conversationHistory: Array<{role: string, content: string}> = []) {
    // Build conversation context
    const context = conversationHistory.slice(-10).map(msg => 
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n\n')

    const prompt = `You are EVA, an AI recruiting assistant. You help with recruiting tasks, candidate management, email drafting, and scheduling.

Previous conversation:
${context}

User: ${message}

Provide a helpful, professional response. If the user is asking about specific candidates, tasks, or data, acknowledge that you can help but may need more specific information.`

    const result = await models.flash.generateContent(prompt)
    return result.response.text()
  }
}

// System prompts for different agents
export const systemPrompts = {
  emailAgent: `You are an expert email assistant for a recruiting firm CEO. You help draft professional emails, summarize conversations, and manage email workflows. Always maintain a professional yet personable tone.`,
  
  dealAgent: `You are a deal management specialist for recruiting placements. You track candidate progress, manage compensation negotiations, and ensure smooth placement processes.`,
  
  contentAgent: `You are a content creation expert specializing in LinkedIn and social media content for the recruiting industry. Create engaging, professional content that showcases expertise and attracts both candidates and clients.`,
  
  researchAgent: `You are a research analyst specializing in financial advisor recruiting. You gather information about firms, advisors, and market trends to support placement decisions.`,
  
  schedulingAgent: `You are a scheduling coordinator who manages calendars, books meetings, and optimizes time management. You integrate with Zoom and Outlook to create seamless scheduling experiences.`
}