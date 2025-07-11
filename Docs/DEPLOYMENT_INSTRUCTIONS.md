# EVA Assistant RAG System - Deployment Instructions

## Overview

This document provides comprehensive deployment instructions for the EVA Assistant RAG (Retrieval-Augmented Generation) system, including all edge functions and required configurations.

## Prerequisites

1. **Supabase Project**
   - Active Supabase project with appropriate plan
   - Access to project settings and API keys

2. **Environment Variables**
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_ANON_KEY`: Public anonymous key
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role key (for edge functions)
   - `GEMINI_API_KEY`: Google Gemini API key for AI features

3. **Local Development Tools**
   - Supabase CLI installed (`npm install -g supabase`)
   - Node.js 18+ and npm/pnpm
   - Git for version control

## Database Setup

### 1. Apply Database Schema

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

### 2. Enable Required Extensions

The schema automatically enables:
- `uuid-ossp`: For UUID generation
- `vector`: For vector similarity search
- `pg_stat_statements`: For query performance monitoring

### 3. Create Storage Buckets

```sql
-- Run in SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);
```

### 4. Set Up RLS Policies

RLS policies are included in the schema but verify they're enabled:

```sql
-- Verify RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

## Edge Functions Deployment

### 1. Configure Environment Variables

Create `.env.local` file:

```bash
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
```

### 2. Deploy Edge Functions

Deploy all three enhanced edge functions:

```bash
# Deploy document processing function
supabase functions deploy process-document \
  --project-ref your-project-ref

# Deploy RAG query function
supabase functions deploy rag-query \
  --project-ref your-project-ref

# Deploy realtime stream function
supabase functions deploy realtime-stream \
  --project-ref your-project-ref
```

### 3. Set Function Secrets

```bash
# Set Gemini API key for all functions
supabase secrets set GEMINI_API_KEY=your-gemini-api-key \
  --project-ref your-project-ref
```

### 4. Configure Function Permissions

Update function permissions in Supabase Dashboard:
- Go to Edge Functions section
- For each function, set:
  - Authentication: Required (JWT verification enabled)
  - CORS: Configure allowed origins

## Frontend Deployment

### 1. Install Dependencies

```bash
cd frontend
pnpm install
```

### 2. Configure Environment

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_GEMINI_API_KEY=your-gemini-api-key
```

### 3. Build and Deploy

```bash
# Build the application
pnpm build

# For Vercel deployment
vercel --prod

# For self-hosted
pnpm start
```

## Production Configuration

### 1. Rate Limiting Configuration

Edge functions include built-in rate limiting:
- **process-document**: 10 requests/minute per user
- **rag-query**: 30 requests/minute per user
- **realtime-stream**: 5 concurrent connections per user

To adjust, modify the constants in each function:

```typescript
const RATE_LIMIT_WINDOW_MS = 60000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30 // Adjust as needed
```

### 2. Security Configuration

#### CORS Headers
Update CORS headers in each function for production:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://your-domain.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

#### File Upload Security
Configure allowed file types and sizes:

```typescript
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const allowedTypes = [
  'text/plain',
  'application/pdf',
  'application/msword',
  // Add more as needed
]
```

### 3. Performance Optimization

#### Chunk Configuration
Adjust chunking strategy based on your use case:

```typescript
const CHUNK_CONFIG = {
  chunkSize: 1500,        // Ideal for general documents
  chunkOverlap: 300,      // Ensures context continuity
  maxChunkSize: 2000,     // Maximum chunk size
  minChunkSize: 100,      // Minimum chunk size
}
```

#### Embedding Batch Size
Optimize based on API limits:

```typescript
const batchSize = 5 // Process 5 chunks at a time
```

#### Query Cache TTL
Adjust cache duration:

```typescript
const CACHE_TTL_MS = 300000 // 5 minutes
```

### 4. Monitoring and Analytics

#### Enable Logging
All functions log to Supabase Logs:
- Function invocations
- Error details
- Performance metrics

#### Analytics Events
Track usage in `analytics_events` table:
- Document processing stats
- Query patterns
- Error rates

#### Set Up Alerts
Configure alerts in Supabase Dashboard:
- Function errors > threshold
- Rate limit violations
- Storage usage

## Scaling Considerations

### 1. Database Optimization

#### Vector Index Performance
Monitor and optimize vector searches:

```sql
-- Check index usage
SELECT * FROM pg_stat_user_indexes 
WHERE indexrelname LIKE '%embedding%';

-- Vacuum regularly
VACUUM ANALYZE document_embeddings;
```

#### Connection Pooling
Configure Supabase connection pooler for high traffic.

### 2. Edge Function Scaling

#### Concurrent Executions
Default limits:
- 1000 concurrent executions per function
- Increase via Supabase support for enterprise

#### Memory Limits
- 150MB per execution
- Optimize payload sizes

### 3. Storage Optimization

#### Document Storage
- Use Supabase Storage for files
- Implement lifecycle policies for old documents
- Consider CDN for frequently accessed files

## Troubleshooting

### Common Issues

1. **Function Timeout**
   - Increase timeout in function config
   - Optimize chunk processing batch size

2. **Rate Limit Errors**
   - Adjust rate limits based on usage
   - Implement client-side retry logic

3. **Vector Search Performance**
   - Reduce match_count parameter
   - Increase match_threshold
   - Optimize index configuration

4. **WebSocket Connection Issues**
   - Check connection limits
   - Verify authentication tokens
   - Monitor connection stability

### Debug Mode

Enable debug logging:

```typescript
const DEBUG = Deno.env.get('DEBUG') === 'true'
if (DEBUG) console.log('Debug info:', data)
```

### Health Checks

Implement health check endpoints:

```typescript
if (req.url.endsWith('/health')) {
  return new Response('OK', { status: 200 })
}
```

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review error logs
   - Check rate limit violations
   - Monitor storage usage

2. **Monthly**
   - Update dependencies
   - Review and optimize slow queries
   - Clean up old analytics data

3. **Quarterly**
   - Security audit
   - Performance review
   - Cost optimization

### Backup Strategy

1. **Database Backups**
   - Supabase automatic daily backups
   - Additional manual backups before major updates

2. **Document Backups**
   - Replicate storage bucket to external service
   - Maintain version history

## Support and Resources

- **Supabase Documentation**: https://supabase.com/docs
- **Gemini API Documentation**: https://ai.google.dev/
- **Project Repository**: [Your GitHub repo]
- **Issue Tracker**: [Your issue tracker]

## Version History

- **v1.0.0** - Initial production-ready release
  - Enhanced error handling and retry logic
  - Advanced chunking strategies
  - Comprehensive rate limiting
  - Production security configurations