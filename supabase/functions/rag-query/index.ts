// Enhanced RAG Query Edge Function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.23.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!)

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30
const requestCounts = new Map<string, { count: number; resetTime: number }>()

// Retry configuration
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000
const BACKOFF_MULTIPLIER = 2

// Query configuration
const QUERY_CONFIG = {
  defaultMatchCount: 5,
  maxMatchCount: 20,
  defaultMatchThreshold: 0.7,
  minMatchThreshold: 0.5,
  contextWindowSize: 4096,
  maxResponseTokens: 2048,
}

// Cache configuration
const CACHE_TTL_MS = 300000 // 5 minutes
const queryCache = new Map<string, { result: any; timestamp: number }>()

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const requestId = crypto.randomUUID()
  const startTime = Date.now()

  try {
    // Parse and validate request
    const body = await parseRequestBody(req)
    const validatedParams = validateQueryParams(body)
    const { query, userId, conversationId, options } = validatedParams

    // Rate limiting check
    if (!checkRateLimit(userId)) {
      throw new RateLimitError('Rate limit exceeded. Please try again later.')
    }

    // Check cache
    const cacheKey = generateCacheKey(query, userId, options)
    const cachedResult = getCachedResult(cacheKey)
    if (cachedResult) {
      return createSuccessResponse(cachedResult, requestId, corsHeaders)
    }

    // Initialize Supabase
    const supabase = await initializeSupabase()

    // Verify user
    await retryWithBackoff(
      () => verifyUser(supabase, userId),
      'User verification'
    )

    // Process query
    const result = await processRAGQuery(
      supabase,
      query,
      userId,
      conversationId,
      options,
      requestId
    )

    // Cache result
    setCachedResult(cacheKey, result)

    // Log analytics
    await logAnalytics(supabase, {
      user_id: userId,
      event_type: 'rag_query_success',
      event_data: {
        request_id: requestId,
        query_length: query.length,
        results_found: result.sources.length,
        conversation_id: conversationId,
        processing_time_ms: Date.now() - startTime,
        cached: false,
      }
    })

    return createSuccessResponse(result, requestId, corsHeaders)

  } catch (error) {
    console.error(`[${requestId}] RAG query error:`, error)
    
    // Log error analytics
    try {
      const supabase = await initializeSupabase()
      await logAnalytics(supabase, {
        user_id: body?.userId,
        event_type: 'rag_query_error',
        event_data: {
          request_id: requestId,
          error_type: error.constructor.name,
          error_message: error.message,
          processing_time_ms: Date.now() - startTime,
        }
      })
    } catch (logError) {
      console.error(`[${requestId}] Failed to log error:`, logError)
    }

    return createErrorResponse(error, requestId, corsHeaders)
  }
})

// Main RAG query processing
async function processRAGQuery(
  supabase: any,
  query: string,
  userId: string,
  conversationId: string | undefined,
  options: any,
  requestId: string
) {
  // Generate query embedding
  const queryEmbedding = await generateQueryEmbedding(query)

  // Search for similar documents with retry
  const searchResults = await retryWithBackoff(
    () => performVectorSearch(supabase, queryEmbedding, options),
    'Vector search'
  )

  if (!searchResults || searchResults.length === 0) {
    return {
      query,
      results: [],
      answer: "I couldn't find any relevant information in the knowledge base for your query.",
      sources: [],
      metadata: {
        total_results: 0,
        threshold_used: options.matchThreshold,
      }
    }
  }

  // Enhance results with document metadata
  const enhancedResults = await enhanceSearchResults(searchResults, supabase)

  // Apply advanced reranking
  let finalResults = enhancedResults
  if (options.rerank) {
    finalResults = await performAdvancedReranking(query, enhancedResults, options)
  }

  // Build optimized context
  const context = await buildOptimizedContext(finalResults, options)

  // Get conversation history if available
  const conversationHistory = conversationId 
    ? await getConversationHistory(supabase, conversationId)
    : null

  // Generate comprehensive answer
  const answer = await generateComprehensiveAnswer(
    query,
    context,
    conversationHistory,
    requestId
  )

  // Store conversation if ID provided
  if (conversationId) {
    await storeConversation(supabase, conversationId, userId, query, answer)
  }

  // Extract and deduplicate sources
  const sources = extractUniqueSources(finalResults.slice(0, options.matchCount))

  return {
    query,
    results: options.includeMetadata ? finalResults.slice(0, options.matchCount) : undefined,
    answer,
    sources,
    metadata: {
      total_results: searchResults.length,
      final_results: finalResults.length,
      reranked: options.rerank,
      threshold_used: options.matchThreshold,
      conversation_included: !!conversationHistory,
    }
  }
}

// Enhanced vector search with better error handling
async function performVectorSearch(supabase: any, embedding: number[], options: any) {
  const { data, error } = await supabase
    .rpc('vector_search', {
      query_embedding: embedding,
      match_count: Math.min(options.matchCount * 3, 50), // Get extra for reranking
      match_threshold: options.matchThreshold,
      table_name: 'document_embeddings'
    })

  if (error) {
    throw new ProcessingError(`Vector search failed: ${error.message}`)
  }

  return data || []
}

// Advanced reranking with multiple strategies
async function performAdvancedReranking(query: string, results: any[], options: any) {
  // Prepare results for reranking
  const scoredResults = results.map(result => ({
    ...result,
    scores: {
      vector: result.similarity || 0,
      keyword: 0,
      semantic: 0,
      position: 0,
    }
  }))

  // Keyword matching score
  const queryTokens = tokenizeQuery(query)
  scoredResults.forEach(result => {
    const contentTokens = tokenizeQuery(result.content)
    const keywordScore = calculateKeywordOverlap(queryTokens, contentTokens)
    result.scores.keyword = keywordScore
  })

  // Semantic similarity using term frequency
  scoredResults.forEach(result => {
    const semanticScore = calculateSemanticSimilarity(query, result.content)
    result.scores.semantic = semanticScore
  })

  // Position-based scoring (prefer earlier chunks in documents)
  scoredResults.forEach(result => {
    const positionScore = 1 / (1 + (result.metadata?.chunk_index || 0) * 0.1)
    result.scores.position = positionScore
  })

  // Calculate combined score with weights
  const weights = {
    vector: 0.4,
    keyword: 0.3,
    semantic: 0.2,
    position: 0.1,
  }

  scoredResults.forEach(result => {
    result.finalScore = Object.entries(weights).reduce((sum, [key, weight]) => {
      return sum + (result.scores[key] * weight)
    }, 0)
  })

  // Sort by combined score
  scoredResults.sort((a, b) => b.finalScore - a.finalScore)

  return scoredResults
}

// Build optimized context with smart truncation
async function buildOptimizedContext(results: any[], options: any): Promise<string> {
  const contextParts: string[] = []
  let totalTokens = 0
  const maxTokens = options.contextWindowSize || QUERY_CONFIG.contextWindowSize

  for (const [index, result] of results.entries()) {
    const source = result.document?.filename || 'Unknown source'
    const chunkHeader = `[Source ${index + 1}: ${source}]`
    const chunkContent = result.content
    
    // Estimate tokens (rough approximation)
    const chunkTokens = Math.ceil((chunkHeader.length + chunkContent.length) / 4)
    
    if (totalTokens + chunkTokens > maxTokens) {
      // Truncate if necessary
      const remainingTokens = maxTokens - totalTokens
      const truncatedContent = chunkContent.substring(0, remainingTokens * 4)
      contextParts.push(`${chunkHeader}\n${truncatedContent}...[truncated]`)
      break
    }
    
    contextParts.push(`${chunkHeader}\n${chunkContent}`)
    totalTokens += chunkTokens
  }

  return contextParts.join('\n\n---\n\n')
}

// Generate comprehensive answer with better prompting
async function generateComprehensiveAnswer(
  query: string,
  context: string,
  conversationHistory: string | null,
  requestId: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: QUERY_CONFIG.maxResponseTokens,
    }
  })

  const systemPrompt = `You are EVA (Executive Virtual Assistant), a knowledgeable AI assistant with access to a comprehensive knowledge base. Your responses should be:

1. **Accurate**: Base your answers strictly on the provided context
2. **Comprehensive**: Cover all relevant aspects from the sources
3. **Well-structured**: Use clear paragraphs, bullet points, or numbered lists as appropriate
4. **Source-aware**: Reference specific sources when making claims
5. **Honest**: Clearly state when information is not available in the context

Important guidelines:
- If the context doesn't contain relevant information, acknowledge this clearly
- Maintain consistency with previous conversation history when provided
- Use professional but conversational language
- Format responses for easy readability
- Highlight key insights or recommendations when applicable`

  const userPrompt = `${systemPrompt}

Context from Knowledge Base:
${context}
${conversationHistory ? `\nPrevious Conversation:\n${conversationHistory}` : ''}

User Question: ${query}

Please provide a comprehensive answer based on the above context. Structure your response clearly and cite sources where appropriate.`

  try {
    const result = await model.generateContent(userPrompt)
    return result.response.text()
  } catch (error) {
    console.error(`[${requestId}] Answer generation error:`, error)
    throw new ProcessingError('Failed to generate answer from context')
  }
}

// Helper Functions

async function parseRequestBody(req: Request) {
  try {
    return await req.json()
  } catch (error) {
    throw new ValidationError('Invalid JSON in request body')
  }
}

function validateQueryParams(body: any) {
  const { query, userId, conversationId, options = {} } = body

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new ValidationError('Query must be a non-empty string')
  }

  if (!userId || typeof userId !== 'string') {
    throw new ValidationError('User ID must be provided')
  }

  // Validate and sanitize options
  const validatedOptions = {
    matchCount: Math.min(
      Math.max(options.matchCount || QUERY_CONFIG.defaultMatchCount, 1),
      QUERY_CONFIG.maxMatchCount
    ),
    matchThreshold: Math.min(
      Math.max(options.matchThreshold || QUERY_CONFIG.defaultMatchThreshold, QUERY_CONFIG.minMatchThreshold),
      1.0
    ),
    includeMetadata: options.includeMetadata !== false,
    rerank: options.rerank !== false,
    contextWindowSize: options.contextWindowSize || QUERY_CONFIG.contextWindowSize,
  }

  return { query, userId, conversationId, options: validatedOptions }
}

async function initializeSupabase() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new ConfigurationError('Missing Supabase configuration')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

async function verifyUser(supabase: any, userId: string) {
  const { data: user, error } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('id', userId)
    .single()
  
  if (error || !user) {
    throw new AuthenticationError('User not found or unauthorized')
  }
  
  return user
}

async function generateQueryEmbedding(query: string): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'embedding-001' })
    const result = await model.embedContent(query)
    return result.embedding.values
  } catch (error) {
    throw new ProcessingError(`Failed to generate query embedding: ${error.message}`)
  }
}

async function enhanceSearchResults(results: any[], supabase: any) {
  const documentIds = [...new Set(results.map(r => r.document_id).filter(Boolean))]
  
  if (documentIds.length === 0) return results

  const { data: documents } = await supabase
    .from('documents')
    .select('id, filename, file_type, created_at, metadata')
    .in('id', documentIds)

  const docMap = new Map(documents?.map((d: any) => [d.id, d]) || [])

  return results.map(result => ({
    ...result,
    document: docMap.get(result.document_id) || null,
  }))
}

async function getConversationHistory(supabase: any, conversationId: string): Promise<string | null> {
  const { data: messages } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(10)
  
  if (!messages || messages.length === 0) return null
  
  return messages
    .map((m: any) => `${m.role}: ${m.content}`)
    .join('\n')
}

async function storeConversation(
  supabase: any,
  conversationId: string,
  userId: string,
  query: string,
  answer: string
) {
  // Store user message
  await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'user',
      content: query,
    })

  // Store assistant response
  await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: answer,
    })

  // Update conversation metadata
  await supabase
    .from('conversations')
    .update({
      updated_at: new Date().toISOString(),
      tokens_used: supabase.rpc('increment', { x: 100 }), // Rough estimate
    })
    .eq('id', conversationId)
}

function extractUniqueSources(results: any[]) {
  const sourceMap = new Map()
  
  results.forEach(result => {
    if (result.document) {
      const key = result.document.id
      if (!sourceMap.has(key)) {
        sourceMap.set(key, {
          id: result.document.id,
          filename: result.document.filename,
          file_type: result.document.file_type,
          relevance: result.finalScore || result.similarity,
          chunks_used: 1,
          metadata: result.document.metadata,
        })
      } else {
        const existing = sourceMap.get(key)
        existing.chunks_used += 1
        existing.relevance = Math.max(existing.relevance, result.finalScore || result.similarity)
      }
    }
  })
  
  return Array.from(sourceMap.values()).sort((a, b) => b.relevance - a.relevance)
}

// Text processing utilities
function tokenizeQuery(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2)
  )
}

function calculateKeywordOverlap(queryTokens: Set<string>, contentTokens: Set<string>): number {
  const intersection = [...queryTokens].filter(token => contentTokens.has(token))
  return intersection.length / queryTokens.size
}

function calculateSemanticSimilarity(query: string, content: string): number {
  // Simple TF-IDF-like scoring
  const queryLower = query.toLowerCase()
  const contentLower = content.toLowerCase()
  
  // Check for exact phrase matches
  if (contentLower.includes(queryLower)) return 1.0
  
  // Calculate word-level similarity
  const queryWords = queryLower.split(/\s+/)
  const matchedWords = queryWords.filter(word => contentLower.includes(word))
  
  return matchedWords.length / queryWords.length
}

// Caching functions
function generateCacheKey(query: string, userId: string, options: any): string {
  return `${userId}:${query}:${JSON.stringify(options)}`
}

function getCachedResult(key: string): any | null {
  const cached = queryCache.get(key)
  if (!cached) return null
  
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    queryCache.delete(key)
    return null
  }
  
  return cached.result
}

function setCachedResult(key: string, result: any) {
  // Limit cache size
  if (queryCache.size > 1000) {
    const firstKey = queryCache.keys().next().value
    queryCache.delete(firstKey)
  }
  
  queryCache.set(key, {
    result,
    timestamp: Date.now(),
  })
}

// Rate limiting
function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userLimit = requestCounts.get(userId)
  
  if (!userLimit || now > userLimit.resetTime) {
    requestCounts.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    })
    return true
  }
  
  if (userLimit.count >= MAX_REQUESTS_PER_WINDOW) {
    return false
  }
  
  userLimit.count++
  return true
}

// Retry logic
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  operation: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error
  let delay = RETRY_DELAY_MS
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      console.error(`${operation} attempt ${attempt + 1} failed:`, error.message)
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay))
        delay *= BACKOFF_MULTIPLIER
      }
    }
  }
  
  throw new ProcessingError(`${operation} failed after ${maxRetries + 1} attempts: ${lastError.message}`)
}

// Analytics logging
async function logAnalytics(supabase: any, eventData: any) {
  try {
    await supabase
      .from('analytics_events')
      .insert(eventData)
  } catch (error) {
    console.error('Analytics logging failed:', error)
  }
}

// Response helpers
function createSuccessResponse(result: any, requestId: string, headers: any) {
  return new Response(
    JSON.stringify({
      success: true,
      request_id: requestId,
      ...result,
    }),
    { 
      headers: { ...headers, 'Content-Type': 'application/json' },
      status: 200
    }
  )
}

function createErrorResponse(error: Error, requestId: string, headers: any) {
  const statusCode = getErrorStatusCode(error)
  return new Response(
    JSON.stringify({ 
      error: error.message,
      error_type: error.constructor.name,
      request_id: requestId,
    }),
    { 
      status: statusCode,
      headers: { ...headers, 'Content-Type': 'application/json' }
    }
  )
}

function getErrorStatusCode(error: Error): number {
  if (error instanceof ValidationError) return 400
  if (error instanceof AuthenticationError) return 401
  if (error instanceof NotFoundError) return 404
  if (error instanceof RateLimitError) return 429
  if (error instanceof ConfigurationError) return 500
  if (error instanceof ProcessingError) return 500
  return 500
}

// Custom error classes
class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

class AuthenticationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

class RateLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RateLimitError'
  }
}

class ConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigurationError'
  }
}

class ProcessingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProcessingError'
  }
}