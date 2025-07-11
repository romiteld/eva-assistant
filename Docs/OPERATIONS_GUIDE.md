# EVA Assistant Operations Guide

This comprehensive guide covers the operational aspects of the EVA Assistant system, including deployment procedures, monitoring configuration, performance tuning, troubleshooting, and maintenance.

## Table of Contents

1. [System Overview](#system-overview)
2. [Deployment Procedures](#deployment-procedures)
3. [Monitoring and Alerting](#monitoring-and-alerting)
4. [Performance Tuning](#performance-tuning)
5. [Troubleshooting Procedures](#troubleshooting-procedures)
6. [Maintenance and Upgrades](#maintenance-and-upgrades)
7. [Security Operations](#security-operations)
8. [Disaster Recovery](#disaster-recovery)

---

## System Overview

The EVA Assistant is a Next.js-based application with the following key components:

- **Frontend**: React-based UI with TypeScript
- **Backend**: Next.js API routes with serverless functions
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Supabase Realtime for live updates
- **Integrations**: Firecrawl, Gemini AI, Microsoft 365, Twilio, etc.
- **Monitoring**: Built-in metrics collection and alerting

### Architecture Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│  API Routes     │────▶│   Supabase      │
│   (Frontend)    │     │  (Backend)      │     │   (Database)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                        │
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Monitoring      │     │  Integrations   │     │   Real-time     │
│ Dashboard       │     │  (External)     │     │   Updates       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Deployment Procedures

### Prerequisites

- Node.js 18.x or higher
- npm or yarn package manager
- Supabase project with proper credentials
- Environment variables configured

### 1. Local Development Deployment

```bash
# Clone the repository
git clone <repository-url>
cd eva-assistant/frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Initialize database
npm run db:init

# Start development server
npm run dev
```

### 2. Production Deployment

#### Option A: Vercel Deployment (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel --prod

# Set environment variables in Vercel dashboard
# Navigate to Project Settings > Environment Variables
```

#### Option B: Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

```bash
# Build and run Docker container
docker build -t eva-assistant .
docker run -p 3000:3000 --env-file .env.production eva-assistant
```

#### Option C: Traditional Server Deployment

```bash
# Build the application
npm run build

# Start production server
npm run start

# Or use PM2 for process management
npm install -g pm2
pm2 start npm --name "eva-assistant" -- start
pm2 save
pm2 startup
```

### 3. Environment Configuration

Required environment variables:

```env
# Database
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Authentication
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret-key

# Integrations
FIRECRAWL_API_KEY=your-firecrawl-key
GEMINI_API_KEY=your-gemini-key
MICROSOFT_CLIENT_ID=your-ms-client-id
MICROSOFT_CLIENT_SECRET=your-ms-client-secret
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token

# Monitoring
SENTRY_DSN=your-sentry-dsn (optional)
DATADOG_API_KEY=your-datadog-key (optional)
```

### 4. Pre-deployment Checklist

- [ ] Run tests: `npm run test`
- [ ] Run E2E tests: `npm run test:e2e`
- [ ] Check TypeScript: `npx tsc --noEmit`
- [ ] Run linter: `npm run lint`
- [ ] Build locally: `npm run build`
- [ ] Verify environment variables
- [ ] Check database migrations
- [ ] Review security settings
- [ ] Update documentation

---

## Monitoring and Alerting

### 1. Built-in Monitoring

The system includes comprehensive monitoring capabilities:

#### Health Check Endpoints

```bash
# Basic health check
GET /api/health

# Database health check
GET /api/health/database

# Metrics endpoint
GET /api/monitoring/metrics
```

#### Metrics Collection

The system automatically collects:

- **API Metrics**: Response times, error rates, throughput
- **Database Metrics**: Query performance, connection pool stats
- **System Metrics**: CPU usage, memory consumption
- **Business Metrics**: Task completion rates, user activity

### 2. Alert Configuration

Default alert rules are configured in the system:

| Alert | Threshold | Severity | Cooldown |
|-------|-----------|----------|----------|
| High Error Rate | >10% | Error | 5 min |
| Critical Error Rate | >50% | Critical | 5 min |
| High API Latency | >2s | Warning | 5 min |
| Critical API Latency | >5s | Critical | 5 min |
| Slow DB Queries | >5/hour | Warning | 10 min |
| High Memory Usage | >85% | Warning | 5 min |
| Critical Memory Usage | >95% | Critical | 5 min |

### 3. External Monitoring Integration

#### Datadog Integration

```typescript
// datadog.config.ts
export const datadogConfig = {
  clientToken: process.env.DATADOG_CLIENT_TOKEN,
  applicationId: process.env.DATADOG_APP_ID,
  site: 'datadoghq.com',
  service: 'eva-assistant',
  env: process.env.NODE_ENV,
  version: process.env.APP_VERSION,
  trackUserInteractions: true,
  trackResources: true,
  trackLongTasks: true,
  defaultPrivacyLevel: 'mask-user-input'
}
```

#### Sentry Integration

```typescript
// sentry.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [
    new Sentry.BrowserTracing({
      tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
    }),
  ],
});
```

### 4. Custom Monitoring Dashboard

Access the monitoring dashboard at `/monitoring` for real-time insights:

- System health status
- API performance metrics
- Database query performance
- Error rates and alerts
- Agent workload distribution
- Real-time activity feed

---

## Performance Tuning

### 1. Frontend Optimization

#### Code Splitting

```typescript
// Dynamic imports for large components
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <LoadingSpinner />,
  ssr: false
});
```

#### Image Optimization

```typescript
// Use Next.js Image component
import Image from 'next/image';

<Image
  src="/image.jpg"
  alt="Description"
  width={800}
  height={600}
  priority={false}
  loading="lazy"
/>
```

#### Bundle Size Optimization

```bash
# Analyze bundle size
npm run build
npm run analyze

# Key optimizations:
# - Remove unused dependencies
# - Use tree-shaking
# - Implement dynamic imports
# - Optimize images and assets
```

### 2. API Performance

#### Database Query Optimization

```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_tasks_agent_id ON tasks(agent_id);

-- Composite indexes for complex queries
CREATE INDEX idx_tasks_status_created ON tasks(status, created_at DESC);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at DESC;
```

#### Connection Pooling

```typescript
// supabase.config.ts
export const supabaseConfig = {
  db: {
    poolSize: 10,
    idleTimeout: 30000,
    connectionTimeout: 10000,
  }
};
```

#### Caching Strategy

```typescript
// Implement Redis caching
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
});

// Cache API responses
export async function getCachedData(key: string, fetcher: () => Promise<any>) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  
  const data = await fetcher();
  await redis.setex(key, 3600, JSON.stringify(data)); // 1 hour TTL
  return data;
}
```

### 3. Server Configuration

#### Node.js Optimization

```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm start

# Enable clustering
pm2 start app.js -i max

# Production optimizations
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"
```

#### Nginx Configuration

```nginx
# nginx.conf
upstream eva_assistant {
    least_conn;
    server localhost:3000;
    server localhost:3001;
    server localhost:3002;
    keepalive 64;
}

server {
    listen 80;
    server_name your-domain.com;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css text/javascript application/javascript application/json;
    gzip_comp_level 6;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://eva_assistant;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        proxy_pass http://eva_assistant;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. Database Performance

#### Query Optimization Tips

1. **Use appropriate indexes**
   ```sql
   -- Check missing indexes
   SELECT schemaname, tablename, attname, n_distinct, most_common_vals
   FROM pg_stats
   WHERE schemaname = 'public'
   AND n_distinct > 100
   AND attname NOT IN (
     SELECT a.attname
     FROM pg_index i
     JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
   );
   ```

2. **Optimize slow queries**
   ```sql
   -- Find slow queries
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   WHERE mean_exec_time > 1000
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

3. **Use connection pooling**
   ```typescript
   // Implement PgBouncer or similar
   const pool = new Pool({
     max: 20,
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000,
   });
   ```

---

## Troubleshooting Procedures

### 1. Common Issues and Solutions

#### Application Won't Start

```bash
# Check logs
pm2 logs eva-assistant
journalctl -u eva-assistant -n 100

# Common causes:
# 1. Missing environment variables
# 2. Port already in use
# 3. Database connection failure
# 4. Invalid configuration

# Debug steps:
1. Verify all environment variables are set
2. Check if port 3000 is available: lsof -i :3000
3. Test database connection: npm run db:test
4. Validate configuration files
```

#### High Memory Usage

```bash
# Monitor memory usage
pm2 monit

# Generate heap snapshot
node --inspect app.js
# Open chrome://inspect and take heap snapshot

# Common causes:
# 1. Memory leaks in event listeners
# 2. Large data processing without cleanup
# 3. Circular references
# 4. Unbounded caches

# Solutions:
1. Implement proper cleanup in useEffect hooks
2. Use streaming for large data processing
3. Implement cache size limits
4. Regular garbage collection
```

#### Database Connection Errors

```sql
-- Check connection count
SELECT count(*) FROM pg_stat_activity;

-- Check for blocking queries
SELECT pid, usename, pg_blocking_pids(pid) as blocked_by, query
FROM pg_stat_activity
WHERE pg_blocking_pids(pid)::text != '{}';

-- Kill blocking query
SELECT pg_terminate_backend(pid);
```

### 2. Debugging Tools

#### Application Debugging

```typescript
// Enable debug logging
DEBUG=eva:* npm run dev

// Add debug points
import debug from 'debug';
const log = debug('eva:api');

log('Processing request: %O', request);
```

#### Performance Profiling

```bash
# CPU profiling
node --prof app.js
node --prof-process isolate-*.log > profile.txt

# Memory profiling
node --expose-gc --inspect app.js
```

### 3. Log Analysis

#### Centralized Logging

```typescript
// winston configuration
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'eva-assistant' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});
```

#### Log Aggregation

```bash
# Using ELK Stack
# Filebeat configuration
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/log/eva-assistant/*.log
  json.keys_under_root: true
  json.add_error_key: true

output.elasticsearch:
  hosts: ["localhost:9200"]
  index: "eva-assistant-%{+yyyy.MM.dd}"
```

---

## Maintenance and Upgrades

### 1. Regular Maintenance Tasks

#### Daily Tasks

- [ ] Check system health dashboard
- [ ] Review error logs and alerts
- [ ] Monitor API performance metrics
- [ ] Verify backup completion
- [ ] Check disk space usage

#### Weekly Tasks

- [ ] Review and resolve any pending alerts
- [ ] Analyze slow query logs
- [ ] Update security patches
- [ ] Clean up old logs and temporary files
- [ ] Review user feedback and issues

#### Monthly Tasks

- [ ] Full system backup
- [ ] Security audit
- [ ] Performance review and optimization
- [ ] Dependency updates
- [ ] Capacity planning review

### 2. Upgrade Procedures

#### Application Updates

```bash
# 1. Backup current state
pg_dump -h localhost -U postgres eva_db > backup_$(date +%Y%m%d).sql

# 2. Test in staging environment
git checkout -b upgrade/v2.0.0
npm install
npm run test
npm run build

# 3. Deploy with zero downtime
# Using PM2 cluster mode
pm2 reload eva-assistant

# Or using blue-green deployment
npm run build
pm2 start app.js --name eva-assistant-new
# Test new instance
pm2 stop eva-assistant
pm2 delete eva-assistant
pm2 save
```

#### Database Migrations

```bash
# Create migration
npm run migrate:create add_new_feature

# Test migration
npm run migrate:up -- --dry-run

# Apply migration
npm run migrate:up

# Rollback if needed
npm run migrate:down
```

### 3. Backup and Recovery

#### Automated Backups

```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="/backups/eva-assistant"
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > "$BACKUP_DIR/db_$DATE.sql"

# Application files backup
tar -czf "$BACKUP_DIR/app_$DATE.tar.gz" /app/eva-assistant

# Upload to S3
aws s3 cp "$BACKUP_DIR/db_$DATE.sql" s3://eva-backups/db/
aws s3 cp "$BACKUP_DIR/app_$DATE.tar.gz" s3://eva-backups/app/

# Clean old backups (keep 30 days)
find $BACKUP_DIR -type f -mtime +30 -delete
```

#### Recovery Procedures

```bash
# Restore database
psql -h localhost -U postgres -d eva_db < backup_20240101.sql

# Restore application
tar -xzf app_20240101.tar.gz -C /
pm2 restart eva-assistant

# Verify restoration
curl https://your-domain.com/api/health
```

---

## Security Operations

### 1. Security Monitoring

```typescript
// Implement security headers
export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // CSP
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
  );
  
  return response;
}
```

### 2. Access Control

```bash
# Implement IP whitelisting for admin endpoints
location /admin {
    allow 192.168.1.0/24;
    allow 10.0.0.0/8;
    deny all;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

location /api/auth/login {
    limit_req zone=login burst=5 nodelay;
}
```

### 3. Audit Logging

```typescript
// Audit sensitive operations
export function auditLog(action: string, user: string, details: any) {
  const log = {
    timestamp: new Date().toISOString(),
    action,
    user,
    details,
    ip: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  };
  
  // Send to audit log storage
  await auditLogger.log(log);
}
```

---

## Disaster Recovery

### 1. Business Continuity Plan

#### RTO and RPO Targets

- **Recovery Time Objective (RTO)**: 4 hours
- **Recovery Point Objective (RPO)**: 1 hour

#### Disaster Scenarios

1. **Database Failure**: Restore from automated backups
2. **Application Server Failure**: Auto-scaling and load balancing
3. **Data Center Outage**: Multi-region deployment
4. **Security Breach**: Incident response plan

### 2. Incident Response

```markdown
## Incident Response Checklist

1. **Detection and Analysis**
   - [ ] Identify the incident type
   - [ ] Assess impact and severity
   - [ ] Document initial findings
   - [ ] Notify incident response team

2. **Containment**
   - [ ] Isolate affected systems
   - [ ] Preserve evidence
   - [ ] Implement temporary fixes
   - [ ] Communicate with stakeholders

3. **Eradication**
   - [ ] Remove threat/fix root cause
   - [ ] Patch vulnerabilities
   - [ ] Update security measures
   - [ ] Verify system integrity

4. **Recovery**
   - [ ] Restore systems from backups
   - [ ] Monitor for recurrence
   - [ ] Validate functionality
   - [ ] Document lessons learned

5. **Post-Incident**
   - [ ] Complete incident report
   - [ ] Update response procedures
   - [ ] Implement preventive measures
   - [ ] Conduct team debrief
```

### 3. Emergency Contacts

```yaml
contacts:
  - role: System Administrator
    name: [Name]
    phone: [Phone]
    email: [Email]
  
  - role: Database Administrator
    name: [Name]
    phone: [Phone]
    email: [Email]
  
  - role: Security Officer
    name: [Name]
    phone: [Phone]
    email: [Email]
  
  - role: Business Owner
    name: [Name]
    phone: [Phone]
    email: [Email]

external_services:
  - service: Supabase Support
    url: https://supabase.com/support
    tier: [Your tier]
  
  - service: Hosting Provider
    phone: [Support phone]
    email: [Support email]
```

---

## Appendix

### A. Useful Commands

```bash
# System health
curl http://localhost:3000/api/health

# Database status
psql -h localhost -U postgres -c "SELECT version();"

# Application logs
pm2 logs eva-assistant --lines 100

# Resource usage
pm2 monit

# Network connections
netstat -tulpn | grep :3000

# Disk usage
df -h
du -sh /var/log/*

# Process monitoring
htop
iotop

# Database connections
psql -c "SELECT count(*) FROM pg_stat_activity;"
```

### B. Performance Benchmarks

```bash
# API load testing
ab -n 1000 -c 10 http://localhost:3000/api/health

# Database benchmarking
pgbench -i -s 10 eva_db
pgbench -c 10 -j 2 -t 1000 eva_db

# Frontend performance
lighthouse http://localhost:3000 --output json --output-path ./lighthouse-report.json
```

### C. Configuration Templates

See the `/config` directory for template files:
- `nginx.conf.template`
- `pm2.config.js.template`
- `docker-compose.yml.template`
- `.env.template`

---

## Version History

- **v1.0.0** - Initial release
- **v1.1.0** - Added monitoring dashboard
- **v1.2.0** - Enhanced security features
- **v1.3.0** - Performance optimizations

Last Updated: 2024-01-01