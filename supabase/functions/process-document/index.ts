// Enhanced Document Processing Edge Function for RAG System
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.23.0'
import { Document } from 'https://esm.sh/langchain/document'
import { RecursiveCharacterTextSplitter } from 'https://esm.sh/langchain/text_splitter'
import * as pdfParse from 'https://esm.sh/pdf-parse@1.1.1'
import * as mammoth from 'https://esm.sh/mammoth@1.6.0'
import * as xlsx from 'https://esm.sh/xlsx@0.20.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Gemini for embeddings
const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!)

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10
const requestCounts = new Map<string, { count: number; resetTime: number }>()

// Retry configuration
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000
const BACKOFF_MULTIPLIER = 2

// Chunking configuration
const CHUNK_CONFIG = {
  chunkSize: 1500,
  chunkOverlap: 300,
  separators: ['\n\n', '\n', '.', '!', '?', ';', ',', ' ', ''],
  maxChunkSize: 2000,
  minChunkSize: 100,
}

// Enhanced serve function with error handling
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const requestId = crypto.randomUUID()
  const startTime = Date.now()

  try {
    // Parse request body
    const body = await parseRequestBody(req)
    const { documentId, userId, options = {} } = body
    
    if (!documentId || !userId) {
      throw new ValidationError('Missing required parameters: documentId and userId')
    }

    // Rate limiting check
    if (!checkRateLimit(userId)) {
      throw new RateLimitError('Rate limit exceeded. Please try again later.')
    }

    // Initialize Supabase with error handling
    const supabase = await initializeSupabase()

    // Verify user with retry
    const user = await retryWithBackoff(
      () => verifyUser(supabase, userId),
      'User verification'
    )

    // Process document with comprehensive error handling
    const result = await processDocument(
      supabase,
      documentId,
      userId,
      options,
      requestId
    )

    // Log successful processing
    await logAnalytics(supabase, {
      user_id: userId,
      event_type: 'document_processed_success',
      event_data: {
        document_id: documentId,
        request_id: requestId,
        processing_time_ms: Date.now() - startTime,
        ...result.metadata,
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        request_id: requestId,
        ...result,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error(`[${requestId}] Document processing error:`, error)
    
    // Log error analytics
    try {
      const supabase = await initializeSupabase()
      await logAnalytics(supabase, {
        user_id: body?.userId,
        event_type: 'document_processed_error',
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

    // Return appropriate error response
    const statusCode = getErrorStatusCode(error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        error_type: error.constructor.name,
        request_id: requestId,
      }),
      { 
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Main document processing function
async function processDocument(
  supabase: any,
  documentId: string,
  userId: string,
  options: any,
  requestId: string
) {
  // Fetch document metadata with retry
  const document = await retryWithBackoff(
    () => fetchDocument(supabase, documentId, userId),
    'Document fetch'
  )

  // Check if already processed
  if (document.embeddings_generated && !options.forceReprocess) {
    return {
      document_id: documentId,
      message: 'Document already processed',
      metadata: {
        chunks_count: document.metadata?.chunk_count || 0,
        cached: true,
      }
    }
  }

  // Download file with retry and validation
  const fileData = await retryWithBackoff(
    () => downloadFile(supabase, document.file_path),
    'File download'
  )

  // Validate file security
  await validateFileSecurity(fileData, document)

  // Extract text with proper error handling
  const extractedText = await extractTextSafely(fileData, document)

  if (!extractedText || extractedText.trim().length === 0) {
    throw new ProcessingError('No text content found in document')
  }

  // Create chunks with optimized strategy
  const chunks = await createOptimizedChunks(extractedText, document)

  // Generate and store embeddings with batching
  const embeddingResults = await processEmbeddings(
    supabase,
    chunks,
    documentId,
    requestId
  )

  // Update document status
  await updateDocumentStatus(
    supabase,
    documentId,
    extractedText,
    chunks,
    embeddingResults
  )

  return {
    document_id: documentId,
    chunks_processed: embeddingResults.successful,
    chunks_failed: embeddingResults.failed,
    metadata: {
      text_length: extractedText.length,
      chunk_count: chunks.length,
      processing_errors: embeddingResults.errors,
    }
  }
}

// Enhanced text extraction with proper libraries
async function extractTextSafely(fileData: Blob, document: any): Promise<string> {
  try {
    switch (document.file_type) {
      case 'text/plain':
      case 'text/markdown':
      case 'text/csv':
        return await fileData.text()
      
      case 'application/pdf':
        return await extractTextFromPDF(fileData)
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return await extractTextFromDOCX(fileData)
      
      case 'application/vnd.ms-excel':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        return await extractTextFromSpreadsheet(fileData)
      
      default:
        throw new ProcessingError(`Unsupported file type: ${document.file_type}`)
    }
  } catch (error) {
    console.error('Text extraction error:', error)
    throw new ProcessingError(`Failed to extract text: ${error.message}`)
  }
}

// PDF text extraction
async function extractTextFromPDF(fileData: Blob): Promise<string> {
  try {
    const buffer = await fileData.arrayBuffer()
    const data = await pdfParse(buffer)
    return data.text
  } catch (error) {
    throw new ProcessingError(`PDF extraction failed: ${error.message}`)
  }
}

// DOCX text extraction
async function extractTextFromDOCX(fileData: Blob): Promise<string> {
  try {
    const buffer = await fileData.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer: buffer })
    return result.value
  } catch (error) {
    throw new ProcessingError(`DOCX extraction failed: ${error.message}`)
  }
}

// Spreadsheet text extraction
async function extractTextFromSpreadsheet(fileData: Blob): Promise<string> {
  try {
    const buffer = await fileData.arrayBuffer()
    const workbook = xlsx.read(buffer, { type: 'array' })
    
    let text = ''
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName]
      const csv = xlsx.utils.sheet_to_csv(sheet)
      text += `\nSheet: ${sheetName}\n${csv}\n`
    })
    
    return text
  } catch (error) {
    throw new ProcessingError(`Spreadsheet extraction failed: ${error.message}`)
  }
}

// Optimized chunking strategy
async function createOptimizedChunks(text: string, document: any): Promise<Document[]> {
  // Adjust chunk size based on document type and content
  let chunkConfig = { ...CHUNK_CONFIG }
  
  // For technical documents, use larger chunks
  if (document.metadata?.technical || text.includes('```')) {
    chunkConfig.chunkSize = 2000
    chunkConfig.chunkOverlap = 400
  }
  
  // For conversational content, use smaller chunks
  if (document.metadata?.conversational || document.file_type === 'text/plain') {
    chunkConfig.chunkSize = 1000
    chunkConfig.chunkOverlap = 200
  }

  const splitter = new RecursiveCharacterTextSplitter(chunkConfig)
  const chunks = await splitter.createDocuments([text])
  
  // Post-process chunks to ensure quality
  return chunks.filter(chunk => {
    const content = chunk.pageContent.trim()
    return content.length >= chunkConfig.minChunkSize && 
           content.length <= chunkConfig.maxChunkSize
  }).map((chunk, index) => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      chunk_index: index,
      chunk_size: chunk.pageContent.length,
      word_count: chunk.pageContent.split(/\s+/).length,
    }
  }))
}

// Process embeddings with batching and retry
async function processEmbeddings(
  supabase: any,
  chunks: Document[],
  documentId: string,
  requestId: string
) {
  const model = genAI.getGenerativeModel({ model: 'embedding-001' })
  const batchSize = 5
  const results = { successful: 0, failed: 0, errors: [] }
  
  // Process in batches
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    const batchPromises = batch.map(async (chunk) => {
      try {
        // Generate embedding with retry
        const embedding = await retryWithBackoff(
          async () => {
            const result = await model.embedContent(chunk.pageContent)
            return result.embedding.values
          },
          `Embedding generation for chunk ${chunk.metadata.chunk_index}`
        )
        
        // Store in database
        await retryWithBackoff(
          () => supabase
            .from('document_embeddings')
            .insert({
              document_id: documentId,
              chunk_index: chunk.metadata.chunk_index,
              content: chunk.pageContent,
              embedding: embedding,
              metadata: chunk.metadata,
            }),
          `Embedding storage for chunk ${chunk.metadata.chunk_index}`
        )
        
        results.successful++
        return { success: true }
      } catch (error) {
        console.error(`[${requestId}] Chunk ${chunk.metadata.chunk_index} error:`, error)
        results.failed++
        results.errors.push({
          chunk_index: chunk.metadata.chunk_index,
          error: error.message,
        })
        return { success: false, error }
      }
    })
    
    // Wait for batch to complete
    await Promise.all(batchPromises)
    
    // Rate limiting between batches
    if (i + batchSize < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  return results
}

// Helper Functions

async function parseRequestBody(req: Request) {
  try {
    return await req.json()
  } catch (error) {
    throw new ValidationError('Invalid JSON in request body')
  }
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

async function fetchDocument(supabase: any, documentId: string, userId: string) {
  const { data: document, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .eq('user_id', userId)
    .single()
  
  if (error || !document) {
    throw new NotFoundError('Document not found')
  }
  
  return document
}

async function downloadFile(supabase: any, filePath: string) {
  const { data, error } = await supabase.storage
    .from('documents')
    .download(filePath)
  
  if (error || !data) {
    throw new ProcessingError('Failed to download file')
  }
  
  return data
}

async function validateFileSecurity(fileData: Blob, document: any) {
  // Check file size
  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
  if (fileData.size > MAX_FILE_SIZE) {
    throw new ValidationError('File size exceeds maximum allowed size')
  }
  
  // Validate MIME type
  const allowedTypes = [
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]
  
  if (!allowedTypes.includes(document.file_type)) {
    throw new ValidationError('File type not allowed')
  }
  
  // Additional security checks could be added here
  return true
}

async function updateDocumentStatus(
  supabase: any,
  documentId: string,
  extractedText: string,
  chunks: Document[],
  embeddingResults: any
) {
  const { error } = await supabase
    .from('documents')
    .update({
      processed: true,
      embeddings_generated: embeddingResults.successful > 0,
      metadata: {
        text_length: extractedText.length,
        chunk_count: chunks.length,
        chunks_successful: embeddingResults.successful,
        chunks_failed: embeddingResults.failed,
        processed_at: new Date().toISOString(),
        processing_errors: embeddingResults.errors,
      }
    })
    .eq('id', documentId)

  if (error) {
    throw new ProcessingError('Failed to update document status')
  }
}

// Rate limiting implementation
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

// Retry with exponential backoff
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
    // Don't throw - analytics shouldn't break the main flow
  }
}

// Error status code mapping
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