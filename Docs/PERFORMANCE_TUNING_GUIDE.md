# EVA Assistant Performance Tuning Guide

This guide provides detailed instructions for optimizing the performance of the EVA Assistant system across all layers of the stack.

## Table of Contents

1. [Performance Baseline](#performance-baseline)
2. [Frontend Optimizations](#frontend-optimizations)
3. [API Layer Optimizations](#api-layer-optimizations)
4. [Database Optimizations](#database-optimizations)
5. [Infrastructure Optimizations](#infrastructure-optimizations)
6. [Caching Strategies](#caching-strategies)
7. [Performance Monitoring](#performance-monitoring)
8. [Load Testing](#load-testing)

---

## Performance Baseline

### Target Metrics

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Page Load Time | < 2s | > 5s |
| API Response Time (P50) | < 200ms | > 500ms |
| API Response Time (P95) | < 500ms | > 2s |
| API Response Time (P99) | < 1s | > 5s |
| Time to Interactive | < 3s | > 8s |
| First Contentful Paint | < 1.5s | > 3s |
| Database Query Time | < 100ms | > 1s |
| Error Rate | < 0.1% | > 1% |
| Availability | > 99.9% | < 99% |

### Measurement Tools

```bash
# Frontend performance
lighthouse https://your-app.com --output json --output-path ./performance-report.json

# API performance
ab -n 1000 -c 10 -H "Authorization: Bearer $TOKEN" https://your-app.com/api/health

# Database performance
pgbench -c 10 -j 2 -t 1000 -h localhost -U postgres eva_db
```

---

## Frontend Optimizations

### 1. Bundle Size Optimization

#### Code Splitting

```typescript
// pages/dashboard/page.tsx
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Heavy components loaded on demand
const HeavyChart = dynamic(() => import('@/components/dashboard/HeavyChart'), {
  loading: () => <div>Loading chart...</div>,
  ssr: false
});

const FirecrawlTools = dynamic(() => import('@/components/dashboard/FirecrawlTools'), {
  loading: () => <div>Loading tools...</div>
});

export default function Dashboard() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HeavyChart />
      <FirecrawlTools />
    </Suspense>
  );
}
```

#### Tree Shaking

```javascript
// next.config.js
module.exports = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
    }
    return config;
  },
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lodash', 'date-fns', '@mui/material']
  }
};
```

#### Bundle Analysis

```bash
# Install bundle analyzer
npm install --save-dev @next/bundle-analyzer

# Run analysis
ANALYZE=true npm run build
```

```javascript
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // your config
});
```

### 2. Image Optimization

```typescript
// components/OptimizedImage.tsx
import Image from 'next/image';

export function OptimizedImage({ src, alt, priority = false }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={800}
      height={600}
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..."
      priority={priority}
      quality={85}
      formats={['image/avif', 'image/webp']}
    />
  );
}
```

### 3. React Optimization

#### Memoization

```typescript
// components/ExpensiveComponent.tsx
import { memo, useMemo, useCallback } from 'react';

export const ExpensiveComponent = memo(({ data, onUpdate }) => {
  // Memoize expensive calculations
  const processedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      computed: expensiveComputation(item)
    }));
  }, [data]);

  // Memoize callbacks
  const handleClick = useCallback((id) => {
    onUpdate(id);
  }, [onUpdate]);

  return (
    <div>
      {processedData.map(item => (
        <div key={item.id} onClick={() => handleClick(item.id)}>
          {item.computed}
        </div>
      ))}
    </div>
  );
});
```

#### Virtual Scrolling

```typescript
// components/VirtualList.tsx
import { FixedSizeList } from 'react-window';

export function VirtualTaskList({ tasks }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      <TaskItem task={tasks[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={tasks.length}
      itemSize={80}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

### 4. Prefetching and Preloading

```typescript
// lib/prefetch.ts
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function usePrefetch() {
  const router = useRouter();

  useEffect(() => {
    // Prefetch common routes
    router.prefetch('/dashboard');
    router.prefetch('/tasks');
    router.prefetch('/monitoring');
  }, [router]);
}

// In HTML head
<link rel="preconnect" href="https://api.supabase.co" />
<link rel="dns-prefetch" href="https://api.firecrawl.dev" />
```

---

## API Layer Optimizations

### 1. Request Optimization

#### Batch Requests

```typescript
// lib/api/batch.ts
export class BatchRequestProcessor {
  private queue: Map<string, Promise<any>> = new Map();
  private timer: NodeJS.Timeout | null = null;

  async add<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (this.queue.has(key)) {
      return this.queue.get(key) as Promise<T>;
    }

    const promise = this.processBatch(key, fetcher);
    this.queue.set(key, promise);
    
    return promise;
  }

  private async processBatch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (this.timer) clearTimeout(this.timer);
    
    this.timer = setTimeout(() => {
      this.queue.clear();
    }, 50); // Batch window of 50ms

    try {
      const result = await fetcher();
      return result;
    } finally {
      this.queue.delete(key);
    }
  }
}
```

#### Response Compression

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Enable compression
  response.headers.set('Content-Encoding', 'gzip');
  response.headers.set('Vary', 'Accept-Encoding');
  
  return response;
}
```

### 2. Database Query Optimization

#### Connection Pooling

```typescript
// lib/db/pool.ts
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 5000,
  query_timeout: 5000,
});

// Query with automatic connection management
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  
  // Log slow queries
  if (duration > 1000) {
    console.warn('Slow query:', { text, duration, rows: res.rowCount });
  }
  
  return res;
}
```

#### Prepared Statements

```typescript
// lib/db/prepared.ts
const preparedStatements = {
  getTask: 'SELECT * FROM tasks WHERE id = $1',
  listTasks: 'SELECT * FROM tasks WHERE status = $1 ORDER BY created_at DESC LIMIT $2',
  updateTask: 'UPDATE tasks SET status = $2, updated_at = NOW() WHERE id = $1'
};

export async function getPreparedQuery(name: keyof typeof preparedStatements) {
  return {
    text: preparedStatements[name],
    name, // Enables prepared statement caching
  };
}
```

### 3. Caching Implementation

#### Redis Cache Layer

```typescript
// lib/cache/redis.ts
import Redis from 'ioredis';
import { compress, decompress } from 'lz-string';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  connectTimeout: 10000,
});

export class CacheService {
  async get<T>(key: string): Promise<T | null> {
    const compressed = await redis.get(key);
    if (!compressed) return null;
    
    const data = decompress(compressed);
    return JSON.parse(data);
  }

  async set(key: string, value: any, ttl = 3600): Promise<void> {
    const data = JSON.stringify(value);
    const compressed = compress(data);
    await redis.setex(key, ttl, compressed);
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}
```

#### Cache Warming

```typescript
// lib/cache/warmer.ts
export class CacheWarmer {
  async warmCache() {
    const criticalQueries = [
      { key: 'stats:overview', fetcher: () => getOverviewStats() },
      { key: 'tasks:pending', fetcher: () => getPendingTasks() },
      { key: 'agents:workload', fetcher: () => getAgentWorkload() },
    ];

    await Promise.all(
      criticalQueries.map(async ({ key, fetcher }) => {
        const data = await fetcher();
        await cache.set(key, data, 300); // 5 min TTL
      })
    );
  }
}

// Run cache warming on startup and periodically
setInterval(() => cacheWarmer.warmCache(), 5 * 60 * 1000);
```

---

## Database Optimizations

### 1. Index Optimization

```sql
-- Analyze table usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan;

-- Find missing indexes
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND tablename IN (
    SELECT tablename 
    FROM pg_stat_user_tables 
    WHERE seq_scan > idx_scan
  );

-- Create optimized indexes
CREATE INDEX CONCURRENTLY idx_tasks_status_created 
ON tasks(status, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY idx_tasks_agent_pending 
ON tasks(agent_id, created_at) 
WHERE status = 'pending';

-- Partial indexes for common queries
CREATE INDEX CONCURRENTLY idx_tasks_recent_active 
ON tasks(created_at DESC) 
WHERE status IN ('pending', 'in_progress') 
  AND created_at > NOW() - INTERVAL '7 days';
```

### 2. Query Optimization

```sql
-- Enable query performance insights
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slow queries
SELECT 
  query,
  mean_exec_time,
  calls,
  total_exec_time,
  min_exec_time,
  max_exec_time,
  stddev_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Optimize common queries
-- Bad: Multiple queries
SELECT * FROM tasks WHERE id = 1;
SELECT * FROM users WHERE id = (SELECT user_id FROM tasks WHERE id = 1);

-- Good: Single query with join
SELECT t.*, u.*
FROM tasks t
JOIN users u ON t.user_id = u.id
WHERE t.id = 1;

-- Use EXPLAIN ANALYZE
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) 
SELECT * FROM tasks 
WHERE status = 'pending' 
ORDER BY created_at DESC 
LIMIT 10;
```

### 3. Table Optimization

```sql
-- Partition large tables
CREATE TABLE tasks_2024 PARTITION OF tasks
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Add table partitioning
ALTER TABLE tasks 
PARTITION BY RANGE (created_at);

-- Vacuum and analyze regularly
VACUUM (ANALYZE, VERBOSE) tasks;

-- Configure autovacuum
ALTER TABLE tasks SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_vacuum_cost_limit = 1000
);
```

---

## Infrastructure Optimizations

### 1. Node.js Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'eva-assistant',
    script: './server.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=4096 --optimize-for-size',
      UV_THREADPOOL_SIZE: 128,
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
    time: true,
    kill_timeout: 5000,
    listen_timeout: 5000,
    shutdown_with_message: true,
  }]
};
```

### 2. Nginx Optimization

```nginx
# /etc/nginx/nginx.conf
user www-data;
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    # Basic Settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    keepalive_requests 100;
    types_hash_max_size 2048;
    client_max_body_size 50M;
    client_body_buffer_size 128k;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 16k;

    # Gzip Settings
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss;
    gzip_min_length 1000;

    # Cache Settings
    open_file_cache max=10000 inactive=60s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

    # Upstream Configuration
    upstream eva_backend {
        least_conn;
        server 127.0.0.1:3000 weight=1 max_fails=3 fail_timeout=30s;
        server 127.0.0.1:3001 weight=1 max_fails=3 fail_timeout=30s;
        server 127.0.0.1:3002 weight=1 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }

    server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name _;

        # Security Headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # API endpoints with rate limiting
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://eva_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            proxy_buffering off;
            proxy_cache_bypass $http_upgrade;
            proxy_read_timeout 300s;
            proxy_connect_timeout 75s;
        }

        # Static assets with caching
        location /_next/static/ {
            alias /app/eva-assistant/.next/static/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        location /static/ {
            alias /app/eva-assistant/public/static/;
            expires 30d;
            add_header Cache-Control "public, max-age=2592000";
        }

        # WebSocket support
        location /ws {
            proxy_pass http://eva_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;
        }
    }
}
```

### 3. System Tuning

```bash
# /etc/sysctl.conf
# Network optimizations
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_max_tw_buckets = 2000000
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_slow_start_after_idle = 0
net.ipv4.tcp_no_metrics_save = 1
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728

# File system
fs.file-max = 2097152
fs.nr_open = 2097152

# Apply settings
sysctl -p
```

---

## Caching Strategies

### 1. Multi-Layer Caching

```typescript
// lib/cache/multi-layer.ts
export class MultiLayerCache {
  private memoryCache = new Map<string, { data: any; expires: number }>();
  private redisCache: Redis;

  async get<T>(key: string): Promise<T | null> {
    // L1: Memory cache
    const memCached = this.memoryCache.get(key);
    if (memCached && memCached.expires > Date.now()) {
      return memCached.data;
    }

    // L2: Redis cache
    const redisCached = await this.redisCache.get(key);
    if (redisCached) {
      const data = JSON.parse(redisCached);
      // Populate L1
      this.memoryCache.set(key, {
        data,
        expires: Date.now() + 60000 // 1 min in memory
      });
      return data;
    }

    return null;
  }

  async set(key: string, value: any, ttl = 3600): Promise<void> {
    // Set in both layers
    this.memoryCache.set(key, {
      data: value,
      expires: Date.now() + Math.min(ttl * 1000, 60000)
    });
    
    await this.redisCache.setex(key, ttl, JSON.stringify(value));
  }
}
```

### 2. Cache Invalidation Strategy

```typescript
// lib/cache/invalidation.ts
export class CacheInvalidator {
  private dependencies = new Map<string, Set<string>>();

  // Register cache dependencies
  addDependency(key: string, dependsOn: string[]) {
    dependsOn.forEach(dep => {
      if (!this.dependencies.has(dep)) {
        this.dependencies.set(dep, new Set());
      }
      this.dependencies.get(dep)!.add(key);
    });
  }

  // Invalidate cache and its dependents
  async invalidate(key: string) {
    const toInvalidate = new Set([key]);
    const dependents = this.dependencies.get(key);
    
    if (dependents) {
      dependents.forEach(dep => toInvalidate.add(dep));
    }

    await Promise.all(
      Array.from(toInvalidate).map(k => cache.delete(k))
    );
  }
}
```

### 3. Smart Cache Headers

```typescript
// middleware/cache-headers.ts
export function setCacheHeaders(
  response: NextResponse,
  options: {
    maxAge?: number;
    sMaxAge?: number;
    staleWhileRevalidate?: number;
    staleIfError?: number;
    private?: boolean;
  }
) {
  const directives = [];
  
  if (options.private) {
    directives.push('private');
  } else {
    directives.push('public');
  }
  
  if (options.maxAge !== undefined) {
    directives.push(`max-age=${options.maxAge}`);
  }
  
  if (options.sMaxAge !== undefined) {
    directives.push(`s-maxage=${options.sMaxAge}`);
  }
  
  if (options.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }
  
  if (options.staleIfError !== undefined) {
    directives.push(`stale-if-error=${options.staleIfError}`);
  }
  
  response.headers.set('Cache-Control', directives.join(', '));
  response.headers.set('Vary', 'Accept-Encoding, Authorization');
}
```

---

## Performance Monitoring

### 1. Real User Monitoring (RUM)

```typescript
// lib/monitoring/rum.ts
export class RealUserMonitoring {
  private queue: PerformanceEntry[] = [];
  private observer: PerformanceObserver;

  constructor() {
    if (typeof window !== 'undefined') {
      this.observer = new PerformanceObserver((list) => {
        this.queue.push(...list.getEntries());
        this.processQueue();
      });

      this.observer.observe({ 
        entryTypes: ['navigation', 'resource', 'measure', 'paint', 'largest-contentful-paint'] 
      });
    }
  }

  private processQueue() {
    if (this.queue.length >= 10) {
      this.sendMetrics(this.queue);
      this.queue = [];
    }
  }

  private sendMetrics(entries: PerformanceEntry[]) {
    const metrics = entries.map(entry => ({
      name: entry.name,
      type: entry.entryType,
      duration: entry.duration,
      startTime: entry.startTime,
      timestamp: Date.now()
    }));

    fetch('/api/monitoring/rum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metrics })
    });
  }
}
```

### 2. Application Performance Monitoring (APM)

```typescript
// lib/monitoring/apm.ts
export function createAPMMiddleware() {
  return async (req: NextRequest, next: () => Promise<NextResponse>) => {
    const start = Date.now();
    const traceId = crypto.randomUUID();
    
    // Add trace ID to request
    req.headers.set('X-Trace-ID', traceId);
    
    try {
      const response = await next();
      const duration = Date.now() - start;
      
      // Collect metrics
      await metricsCollector.collectAPIMetric({
        endpoint: req.nextUrl.pathname,
        method: req.method,
        status: response.status,
        duration,
        traceId
      });
      
      // Add performance headers
      response.headers.set('X-Response-Time', `${duration}ms`);
      response.headers.set('X-Trace-ID', traceId);
      
      return response;
    } catch (error) {
      const duration = Date.now() - start;
      
      await metricsCollector.collectAPIMetric({
        endpoint: req.nextUrl.pathname,
        method: req.method,
        status: 500,
        duration,
        error: error.message,
        traceId
      });
      
      throw error;
    }
  };
}
```

---

## Load Testing

### 1. Load Test Scenarios

```javascript
// loadtest/scenarios.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Steady state
    { duration: '2m', target: 200 }, // Increase load
    { duration: '5m', target: 200 }, // Steady state
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  const BASE_URL = 'https://your-app.com';
  
  // Scenario 1: Homepage
  let res = http.get(`${BASE_URL}/`);
  check(res, { 'homepage loaded': (r) => r.status === 200 });
  
  sleep(1);
  
  // Scenario 2: API endpoint
  res = http.get(`${BASE_URL}/api/tasks`, {
    headers: { 'Authorization': `Bearer ${__ENV.API_TOKEN}` },
  });
  check(res, { 
    'API responded': (r) => r.status === 200,
    'API fast': (r) => r.timings.duration < 200,
  });
  
  sleep(1);
}
```

### 2. Stress Testing

```bash
#!/bin/bash
# stress-test.sh

echo "Starting stress test..."

# CPU stress test
stress-ng --cpu 4 --timeout 60s --metrics

# Memory stress test
stress-ng --vm 2 --vm-bytes 1G --timeout 60s --metrics

# IO stress test
stress-ng --io 4 --timeout 60s --metrics

# Network stress test
iperf3 -c your-app.com -t 60 -P 10

# Database stress test
pgbench -c 50 -j 10 -t 1000 -h localhost -U postgres eva_db
```

### 3. Performance Regression Testing

```typescript
// test/performance/regression.test.ts
import { test, expect } from '@playwright/test';

test.describe('Performance Regression', () => {
  test('Page load performance', async ({ page }) => {
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
      };
    });

    // Assert performance thresholds
    expect(metrics.domContentLoaded).toBeLessThan(1000);
    expect(metrics.loadComplete).toBeLessThan(2000);
    expect(metrics.firstPaint).toBeLessThan(500);
    expect(metrics.firstContentfulPaint).toBeLessThan(1000);
  });

  test('API response time', async ({ request }) => {
    const start = Date.now();
    const response = await request.get('/api/health');
    const duration = Date.now() - start;

    expect(response.status()).toBe(200);
    expect(duration).toBeLessThan(200);
  });
});
```

---

## Optimization Checklist

### Frontend
- [ ] Enable code splitting for large components
- [ ] Implement lazy loading for images
- [ ] Use React.memo for expensive components
- [ ] Implement virtual scrolling for long lists
- [ ] Optimize bundle size (< 200KB gzipped)
- [ ] Enable service worker for offline support
- [ ] Implement proper caching headers
- [ ] Use CDN for static assets

### Backend
- [ ] Enable response compression
- [ ] Implement connection pooling
- [ ] Use prepared statements
- [ ] Enable query result caching
- [ ] Implement rate limiting
- [ ] Use async/await properly
- [ ] Enable HTTP/2
- [ ] Implement request batching

### Database
- [ ] Create appropriate indexes
- [ ] Enable query plan caching
- [ ] Configure connection pooling
- [ ] Set up read replicas
- [ ] Enable autovacuum
- [ ] Partition large tables
- [ ] Monitor slow queries
- [ ] Regular VACUUM and ANALYZE

### Infrastructure
- [ ] Configure Nginx caching
- [ ] Enable Gzip compression
- [ ] Set up CDN
- [ ] Configure auto-scaling
- [ ] Optimize system limits
- [ ] Enable monitoring
- [ ] Set up alerts
- [ ] Regular performance testing

---

Last Updated: 2024-01-01
Version: 1.0.0