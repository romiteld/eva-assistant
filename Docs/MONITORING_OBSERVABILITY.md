Monitoring and Observability Architecture

1. Observability Overview

The EVA Assistant implements comprehensive observability through the three pillars: metrics, logs, and traces. This enables deep insights into system behavior, rapid troubleshooting, and proactive issue detection.

Observability Principles:
- Everything is instrumented
- Context-rich data collection
- Real-time visibility
- Actionable insights
- Low overhead monitoring

Key Objectives:
- Mean Time to Detection (MTTD): < 5 minutes
- Mean Time to Resolution (MTTR): < 30 minutes
- System visibility: 100% coverage
- Data retention: 30 days hot, 1 year cold
- Query performance: < 5 seconds for any timeframe

2. Metrics Architecture

2.1 Metrics Collection

2.1.1 Application Metrics
Custom metrics collector implementation:

// Core metrics collector
class MetricsCollector {
  private metrics: Map<string, Metric[]> = new Map();
  private aggregationInterval = 60000; // 1 minute
  
  // Collect different metric types
  counter(name: string, value: number = 1, tags?: Record<string, string>) {
    this.record({
      name,
      type: 'counter',
      value,
      tags,
      timestamp: Date.now()
    });
  }

  gauge(name: string, value: number, tags?: Record<string, string>) {
    this.record({
      name,
      type: 'gauge',
      value,
      tags,
      timestamp: Date.now()
    });
  }

  histogram(name: string, value: number, tags?: Record<string, string>) {
    this.record({
      name,
      type: 'histogram',
      value,
      tags,
      timestamp: Date.now()
    });
  }

  timing(name: string, duration: number, tags?: Record<string, string>) {
    this.histogram(`${name}.duration`, duration, tags);
    this.counter(`${name}.count`, 1, tags);
  }

  // Aggregation and export
  private async aggregate() {
    const aggregated = new Map<string, AggregatedMetric>();

    for (const [name, metrics] of this.metrics) {
      const values = metrics.map(m => m.value);
      
      aggregated.set(name, {
        name,
        count: metrics.length,
        sum: values.reduce((a, b) => a + b, 0),
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        p50: percentile(values, 0.5),
        p95: percentile(values, 0.95),
        p99: percentile(values, 0.99),
        tags: metrics[0].tags
      });
    }

    // Export to monitoring backend
    await this.export(aggregated);
    
    // Clear processed metrics
    this.metrics.clear();
  }
}

// Global metrics instance
export const metrics = new MetricsCollector();

2.1.2 Business Metrics
Key business metrics tracked:

// User activity metrics
metrics.counter('user.login', 1, { method: 'oauth' });
metrics.counter('user.signup', 1, { plan: 'premium' });
metrics.gauge('users.active', activeUsers);
metrics.timing('user.session.duration', sessionLength);

// Task metrics
metrics.counter('task.created', 1, { type: taskType });
metrics.counter('task.completed', 1, { agent: agentId });
metrics.histogram('task.duration', taskDuration);
metrics.gauge('tasks.queue.size', queueSize);

// Agent metrics
metrics.gauge('agent.workload', workloadPercentage, { agent: agentId });
metrics.counter('agent.task.success', 1, { agent: agentId });
metrics.counter('agent.task.failure', 1, { agent: agentId, reason });
metrics.timing('agent.response.time', responseTime);

// API metrics
metrics.timing('api.request.duration', duration, { 
  endpoint, 
  method, 
  status 
});
metrics.counter('api.request.count', 1, { endpoint, method });
metrics.counter('api.error.count', 1, { endpoint, errorType });

2.1.3 System Metrics
Infrastructure and resource metrics:

// System resource monitoring
class SystemMonitor {
  async collectSystemMetrics() {
    // Memory metrics
    const memoryUsage = process.memoryUsage();
    metrics.gauge('system.memory.heap.used', memoryUsage.heapUsed);
    metrics.gauge('system.memory.heap.total', memoryUsage.heapTotal);
    metrics.gauge('system.memory.rss', memoryUsage.rss);
    metrics.gauge('system.memory.external', memoryUsage.external);

    // CPU metrics
    const cpuUsage = process.cpuUsage();
    metrics.gauge('system.cpu.user', cpuUsage.user);
    metrics.gauge('system.cpu.system', cpuUsage.system);

    // Event loop metrics
    const lag = await this.measureEventLoopLag();
    metrics.histogram('system.eventloop.lag', lag);

    // GC metrics
    if (global.gc) {
      const gcStats = await this.getGCStats();
      metrics.counter('system.gc.count', gcStats.count);
      metrics.histogram('system.gc.pause', gcStats.pause);
    }
  }

  private measureEventLoopLag(): Promise<number> {
    return new Promise(resolve => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1e6;
        resolve(lag);
      });
    });
  }
}

2.2 Metrics Storage and Visualization

2.2.1 Time-Series Database Schema
Optimized schema for metrics storage:

-- Metrics table with hypertable
CREATE TABLE metrics (
  time TIMESTAMPTZ NOT NULL,
  name TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  tags JSONB,
  metadata JSONB
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('metrics', 'time');

-- Create indexes for common queries
CREATE INDEX idx_metrics_name_time ON metrics (name, time DESC);
CREATE INDEX idx_metrics_tags ON metrics USING GIN (tags);

-- Continuous aggregates for performance
CREATE MATERIALIZED VIEW metrics_1min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', time) AS bucket,
  name,
  tags,
  COUNT(*) as count,
  AVG(value) as avg,
  MIN(value) as min,
  MAX(value) as max,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY value) as p50,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY value) as p95,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY value) as p99
FROM metrics
GROUP BY bucket, name, tags;

-- Retention policy
SELECT add_retention_policy('metrics', INTERVAL '30 days');

2.2.2 Real-Time Dashboards
Dashboard components and queries:

// Dashboard metric fetcher
export async function fetchMetrics(query: MetricQuery) {
  const { metric, timeRange, aggregation, groupBy } = query;

  const sql = `
    SELECT 
      time_bucket($1, time) as time,
      ${groupBy ? `${groupBy},` : ''}
      ${aggregation}(value) as value
    FROM metrics
    WHERE name = $2
      AND time >= $3
      AND time <= $4
      ${groupBy ? `GROUP BY time, ${groupBy}` : 'GROUP BY time'}
    ORDER BY time ASC
  `;

  const result = await db.query(sql, [
    query.interval || '1 minute',
    metric,
    timeRange.start,
    timeRange.end
  ]);

  return result.rows;
}

// Real-time metric subscription
export function subscribeToMetric(metric: string, callback: (data: any) => void) {
  const channel = supabase
    .channel(`metric:${metric}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'metrics',
      filter: `name=eq.${metric}`
    }, (payload) => {
      callback(payload.new);
    })
    .subscribe();

  return () => channel.unsubscribe();
}

3. Logging Architecture

3.1 Structured Logging

3.1.1 Log Format and Schema
Consistent structured logging:

// Logger implementation
class StructuredLogger {
  private context: Record<string, any> = {};

  constructor(private service: string) {
    this.context = {
      service,
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION,
      hostname: os.hostname()
    };
  }

  private log(level: string, message: string, data?: any) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...data,
      // Trace context
      traceId: getCurrentTraceId(),
      spanId: getCurrentSpanId(),
      // User context
      userId: getCurrentUserId(),
      sessionId: getCurrentSessionId()
    };

    // Send to log aggregator
    this.ship(logEntry);
  }

  info(message: string, data?: any) {
    this.log('INFO', message, data);
  }

  warn(message: string, data?: any) {
    this.log('WARN', message, data);
  }

  error(message: string, error?: Error, data?: any) {
    this.log('ERROR', message, {
      ...data,
      error: {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      }
    });
  }

  debug(message: string, data?: any) {
    if (process.env.NODE_ENV === 'development') {
      this.log('DEBUG', message, data);
    }
  }

  // Audit logging
  audit(action: string, resource: string, data?: any) {
    this.log('AUDIT', `${action} ${resource}`, {
      ...data,
      auditAction: action,
      auditResource: resource,
      auditTimestamp: Date.now()
    });
  }
}

// Service-specific loggers
export const apiLogger = new StructuredLogger('api');
export const dbLogger = new StructuredLogger('database');
export const authLogger = new StructuredLogger('auth');

3.1.2 Log Aggregation Pipeline
Centralized log processing:

// Log shipping to aggregator
class LogShipper {
  private buffer: LogEntry[] = [];
  private batchSize = 100;
  private flushInterval = 5000; // 5 seconds

  constructor() {
    // Periodic flush
    setInterval(() => this.flush(), this.flushInterval);
    
    // Flush on shutdown
    process.on('beforeExit', () => this.flush());
  }

  ship(entry: LogEntry) {
    this.buffer.push(entry);
    
    if (this.buffer.length >= this.batchSize) {
      this.flush();
    }
  }

  private async flush() {
    if (this.buffer.length === 0) return;

    const batch = [...this.buffer];
    this.buffer = [];

    try {
      await fetch(process.env.LOG_ENDPOINT!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.LOG_API_KEY!
        },
        body: JSON.stringify({ logs: batch })
      });
    } catch (error) {
      // Fallback to console
      console.error('Failed to ship logs:', error);
      batch.forEach(log => console.log(JSON.stringify(log)));
    }
  }
}

3.2 Log Analysis and Alerting

3.2.1 Log Parsing Rules
Extract insights from logs:

-- Log parsing patterns
CREATE TABLE log_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  pattern TEXT NOT NULL,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  alert_threshold INTEGER DEFAULT 1
);

-- Common patterns
INSERT INTO log_patterns (name, pattern, severity, category) VALUES
('SQL Injection Attempt', 'SELECT.*UNION.*FROM', 'critical', 'security'),
('Authentication Failure', 'Failed login attempt', 'warning', 'auth'),
('Database Connection Error', 'ECONNREFUSED.*5432', 'error', 'database'),
('Memory Leak Warning', 'heap out of memory', 'critical', 'performance'),
('API Rate Limit', 'Rate limit exceeded', 'warning', 'api');

-- Log analysis view
CREATE MATERIALIZED VIEW log_analysis AS
SELECT 
  date_trunc('hour', timestamp) as hour,
  level,
  service,
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT trace_id) as unique_requests
FROM logs
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY hour, level, service;

3.2.2 Alert Rules
Automated alerting based on log patterns:

// Alert rule engine
class AlertEngine {
  private rules: AlertRule[] = [];

  addRule(rule: AlertRule) {
    this.rules.push(rule);
  }

  async evaluate(logs: LogEntry[]) {
    for (const rule of this.rules) {
      const matches = logs.filter(log => rule.condition(log));
      
      if (matches.length >= rule.threshold) {
        await this.triggerAlert({
          rule: rule.name,
          severity: rule.severity,
          matches: matches.length,
          sample: matches.slice(0, 5),
          timestamp: new Date()
        });
      }
    }
  }

  private async triggerAlert(alert: Alert) {
    // Send to notification channels
    await Promise.all([
      this.sendEmail(alert),
      this.sendSlack(alert),
      this.createIncident(alert)
    ]);
  }
}

// Define alert rules
const alertEngine = new AlertEngine();

alertEngine.addRule({
  name: 'High Error Rate',
  condition: (log) => log.level === 'ERROR',
  threshold: 50,
  timeWindow: 300000, // 5 minutes
  severity: 'high'
});

alertEngine.addRule({
  name: 'Security Threat',
  condition: (log) => log.category === 'security',
  threshold: 1,
  timeWindow: 0,
  severity: 'critical'
});

4. Distributed Tracing

4.1 Trace Implementation

4.1.1 Trace Context Propagation
Implementing distributed tracing:

// Trace context
interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  flags: number;
  baggage?: Record<string, string>;
}

// Trace middleware
export function traceMiddleware(req: Request, res: Response, next: NextFunction) {
  // Extract or create trace context
  const traceHeader = req.headers['traceparent'];
  const context = traceHeader ? parseTraceHeader(traceHeader) : createTraceContext();

  // Store in async local storage
  traceStore.run(context, () => {
    // Create root span
    const span = tracer.startSpan(req.path, {
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'http.target': req.path,
        'user.id': req.user?.id
      }
    });

    // Instrument response
    const originalSend = res.send;
    res.send = function(data: any) {
      span.setAttributes({
        'http.status_code': res.statusCode,
        'http.response.size': Buffer.byteLength(data)
      });
      span.end();
      return originalSend.call(this, data);
    };

    next();
  });
}

// Span creation helper
export function createSpan(name: string, fn: () => Promise<any>) {
  const parentContext = traceStore.getStore();
  const span = tracer.startSpan(name, {
    parent: parentContext
  });

  return fn()
    .then(result => {
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    })
    .catch(error => {
      span.setStatus({ 
        code: SpanStatusCode.ERROR,
        message: error.message 
      });
      span.recordException(error);
      throw error;
    })
    .finally(() => {
      span.end();
    });
}

4.1.2 Service Instrumentation
Auto-instrumentation for common services:

// Database instrumentation
export function instrumentDatabase(db: Database) {
  const originalQuery = db.query.bind(db);

  db.query = async function(sql: string, params?: any[]) {
    return createSpan('db.query', async () => {
      const span = trace.getActiveSpan();
      
      span?.setAttributes({
        'db.system': 'postgresql',
        'db.statement': sql.substring(0, 1000),
        'db.operation': sql.split(' ')[0].toUpperCase()
      });

      const start = performance.now();
      try {
        const result = await originalQuery(sql, params);
        const duration = performance.now() - start;
        
        span?.setAttributes({
          'db.rows_affected': result.rowCount,
          'db.duration': duration
        });
        
        return result;
      } catch (error) {
        span?.recordException(error);
        throw error;
      }
    });
  };
}

// HTTP client instrumentation
export function instrumentHttpClient(client: HttpClient) {
  const originalRequest = client.request.bind(client);

  client.request = async function(options: RequestOptions) {
    return createSpan(`http.${options.method} ${options.url}`, async () => {
      const span = trace.getActiveSpan();
      
      // Inject trace context
      const headers = {
        ...options.headers,
        'traceparent': getCurrentTraceHeader()
      };

      span?.setAttributes({
        'http.method': options.method,
        'http.url': options.url,
        'http.target': new URL(options.url).pathname
      });

      try {
        const response = await originalRequest({ ...options, headers });
        
        span?.setAttributes({
          'http.status_code': response.status,
          'http.response.size': response.headers['content-length']
        });
        
        return response;
      } catch (error) {
        span?.recordException(error);
        throw error;
      }
    });
  };
}

4.2 Trace Analysis

4.2.1 Trace Storage
Efficient trace storage schema:

-- Trace spans table
CREATE TABLE trace_spans (
  trace_id TEXT NOT NULL,
  span_id TEXT NOT NULL,
  parent_span_id TEXT,
  operation_name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_ms DOUBLE PRECISION GENERATED ALWAYS AS 
    (EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) STORED,
  status_code INTEGER,
  attributes JSONB,
  events JSONB[],
  PRIMARY KEY (trace_id, span_id)
);

-- Indexes for trace queries
CREATE INDEX idx_spans_trace_id ON trace_spans (trace_id);
CREATE INDEX idx_spans_service_time ON trace_spans (service_name, start_time);
CREATE INDEX idx_spans_operation_time ON trace_spans (operation_name, start_time);
CREATE INDEX idx_spans_duration ON trace_spans (duration_ms);
CREATE INDEX idx_spans_attributes ON trace_spans USING GIN (attributes);

-- Service dependency view
CREATE MATERIALIZED VIEW service_dependencies AS
SELECT 
  parent.service_name as source_service,
  child.service_name as target_service,
  COUNT(*) as request_count,
  AVG(child.duration_ms) as avg_duration,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY child.duration_ms) as p95_duration,
  SUM(CASE WHEN child.status_code >= 400 THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as error_rate
FROM trace_spans parent
JOIN trace_spans child ON parent.trace_id = child.trace_id 
  AND parent.span_id = child.parent_span_id
WHERE parent.start_time > NOW() - INTERVAL '1 hour'
GROUP BY parent.service_name, child.service_name;

4.2.2 Trace Visualization
Service map and waterfall views:

// Trace visualization data builder
export class TraceVisualizer {
  async getTraceWaterfall(traceId: string) {
    // Fetch all spans for trace
    const spans = await db.query(
      'SELECT * FROM trace_spans WHERE trace_id = $1 ORDER BY start_time',
      [traceId]
    );

    // Build span tree
    const spanMap = new Map();
    const rootSpans = [];

    spans.forEach(span => {
      spanMap.set(span.span_id, {
        ...span,
        children: []
      });
    });

    spans.forEach(span => {
      if (span.parent_span_id) {
        const parent = spanMap.get(span.parent_span_id);
        if (parent) {
          parent.children.push(spanMap.get(span.span_id));
        }
      } else {
        rootSpans.push(spanMap.get(span.span_id));
      }
    });

    return this.formatWaterfall(rootSpans);
  }

  async getServiceMap(timeRange: TimeRange) {
    const dependencies = await db.query(`
      SELECT * FROM service_dependencies
      WHERE last_updated >= $1 AND last_updated <= $2
    `, [timeRange.start, timeRange.end]);

    // Build service graph
    const nodes = new Set();
    const edges = [];

    dependencies.forEach(dep => {
      nodes.add(dep.source_service);
      nodes.add(dep.target_service);
      
      edges.push({
        source: dep.source_service,
        target: dep.target_service,
        metrics: {
          requestCount: dep.request_count,
          avgDuration: dep.avg_duration,
          errorRate: dep.error_rate
        }
      });
    });

    return {
      nodes: Array.from(nodes).map(name => ({
        id: name,
        label: name,
        metrics: await this.getServiceMetrics(name, timeRange)
      })),
      edges
    };
  }
}

5. Health Checks and SLIs

5.1 Health Check System

5.1.1 Component Health Checks
Comprehensive health monitoring:

// Health check registry
class HealthCheckRegistry {
  private checks = new Map<string, HealthCheck>();

  register(name: string, check: HealthCheck) {
    this.checks.set(name, check);
  }

  async runAll(): Promise<HealthStatus> {
    const results = await Promise.allSettled(
      Array.from(this.checks.entries()).map(async ([name, check]) => {
        const start = Date.now();
        try {
          const result = await check.execute();
          return {
            name,
            status: result.healthy ? 'healthy' : 'unhealthy',
            duration: Date.now() - start,
            message: result.message,
            metadata: result.metadata
          };
        } catch (error) {
          return {
            name,
            status: 'unhealthy',
            duration: Date.now() - start,
            message: error.message,
            error: true
          };
        }
      })
    );

    const checks = results.map(r => 
      r.status === 'fulfilled' ? r.value : {
        name: 'unknown',
        status: 'unhealthy',
        error: true
      }
    );

    const unhealthy = checks.filter(c => c.status === 'unhealthy');
    
    return {
      status: unhealthy.length === 0 ? 'healthy' : 
              unhealthy.some(c => c.critical) ? 'critical' : 'degraded',
      checks,
      timestamp: new Date().toISOString()
    };
  }
}

// Register health checks
const health = new HealthCheckRegistry();

// Database health check
health.register('database', {
  execute: async () => {
    try {
      const result = await db.query('SELECT 1');
      return { healthy: true };
    } catch (error) {
      return { 
        healthy: false, 
        message: 'Database connection failed',
        critical: true 
      };
    }
  }
});

// Redis health check
health.register('redis', {
  execute: async () => {
    try {
      await redis.ping();
      const info = await redis.info();
      return { 
        healthy: true,
        metadata: { 
          memory: info.used_memory_human,
          uptime: info.uptime_in_seconds 
        }
      };
    } catch (error) {
      return { healthy: false, message: 'Redis unavailable' };
    }
  }
});

// External service health checks
health.register('supabase', {
  execute: async () => {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`);
      return { healthy: response.ok };
    } catch {
      return { healthy: false, message: 'Supabase API unreachable' };
    }
  }
});

5.1.2 Health Check Endpoint
Kubernetes-compatible health endpoints:

// Liveness probe - is the app running?
export async function GET(request: Request) {
  // Simple check - can we respond?
  return Response.json({ status: 'ok' });
}

// Readiness probe - is the app ready to serve traffic?
export async function GET(request: Request) {
  const health = await healthRegistry.runAll();
  
  // Check critical dependencies
  const criticalChecks = ['database', 'auth'];
  const criticalHealthy = health.checks
    .filter(c => criticalChecks.includes(c.name))
    .every(c => c.status === 'healthy');

  if (!criticalHealthy) {
    return Response.json(health, { status: 503 });
  }

  return Response.json(health);
}

// Startup probe - for slow starting apps
export async function GET(request: Request) {
  if (!appInitialized) {
    return Response.json({ 
      status: 'initializing',
      progress: initializationProgress 
    }, { status: 503 });
  }

  return Response.json({ status: 'ready' });
}

5.2 Service Level Indicators (SLIs)

5.2.1 SLI Definitions
Key indicators for service quality:

// SLI calculator
class SLICalculator {
  // Availability SLI
  async calculateAvailability(timeRange: TimeRange): Promise<number> {
    const { rows } = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status_code < 500) as successful,
        COUNT(*) as total
      FROM api_requests
      WHERE timestamp >= $1 AND timestamp <= $2
    `, [timeRange.start, timeRange.end]);

    const { successful, total } = rows[0];
    return total > 0 ? (successful / total) * 100 : 100;
  }

  // Latency SLI
  async calculateLatency(timeRange: TimeRange): Promise<SLILatency> {
    const { rows } = await db.query(`
      SELECT 
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration) as p50,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration) as p95,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration) as p99,
        COUNT(*) FILTER (WHERE duration <= 200) as under_200ms,
        COUNT(*) as total
      FROM api_requests
      WHERE timestamp >= $1 AND timestamp <= $2
    `, [timeRange.start, timeRange.end]);

    const data = rows[0];
    return {
      p50: data.p50,
      p95: data.p95,
      p99: data.p99,
      withinSLO: (data.under_200ms / data.total) * 100
    };
  }

  // Error Rate SLI
  async calculateErrorRate(timeRange: TimeRange): Promise<number> {
    const { rows } = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status_code >= 400) as errors,
        COUNT(*) as total
      FROM api_requests
      WHERE timestamp >= $1 AND timestamp <= $2
    `, [timeRange.start, timeRange.end]);

    const { errors, total } = rows[0];
    return total > 0 ? (errors / total) * 100 : 0;
  }

  // Throughput SLI
  async calculateThroughput(timeRange: TimeRange): Promise<number> {
    const { rows } = await db.query(`
      SELECT COUNT(*) / EXTRACT(EPOCH FROM ($2 - $1)) as rps
      FROM api_requests
      WHERE timestamp >= $1 AND timestamp <= $2
    `, [timeRange.start, timeRange.end]);

    return rows[0].rps;
  }
}

5.2.2 SLO Monitoring
Service Level Objective tracking:

// SLO definitions
const SLOs = {
  availability: {
    target: 99.9,
    window: '30d',
    alertThreshold: 99.5
  },
  latency: {
    target: 95, // 95% of requests under 200ms
    window: '1h',
    alertThreshold: 90
  },
  errorRate: {
    target: 0.1, // Less than 0.1% errors
    window: '1h',
    alertThreshold: 0.5
  }
};

// Error budget calculator
export class ErrorBudget {
  async calculate(slo: string, timeRange: TimeRange) {
    const config = SLOs[slo];
    const actual = await this.getCurrentSLI(slo, timeRange);
    
    const totalMinutes = (timeRange.end - timeRange.start) / 60000;
    const allowedDowntime = totalMinutes * (1 - config.target / 100);
    const actualDowntime = totalMinutes * (1 - actual / 100);
    
    return {
      budget: allowedDowntime,
      consumed: actualDowntime,
      remaining: allowedDowntime - actualDowntime,
      percentageUsed: (actualDowntime / allowedDowntime) * 100,
      burnRate: actualDowntime / totalMinutes
    };
  }

  async checkBurnRate(slo: string) {
    // Multi-window burn rate alerts
    const windows = [
      { duration: '1h', threshold: 14.4 },  // 14.4x burn rate
      { duration: '6h', threshold: 6 },     // 6x burn rate
      { duration: '1d', threshold: 3 },     // 3x burn rate
      { duration: '3d', threshold: 1 }      // 1x burn rate
    ];

    const alerts = [];
    
    for (const window of windows) {
      const burnRate = await this.calculateBurnRate(slo, window.duration);
      if (burnRate > window.threshold) {
        alerts.push({
          slo,
          window: window.duration,
          burnRate,
          threshold: window.threshold,
          severity: this.getSeverity(window.duration)
        });
      }
    }

    return alerts;
  }
}

6. Alerting System

6.1 Alert Configuration

6.1.1 Alert Rules
Comprehensive alerting rules:

// Alert rule definitions
const alertRules: AlertRule[] = [
  // Performance alerts
  {
    name: 'High API Latency',
    query: 'avg(api_request_duration) by (endpoint)',
    condition: '> 500',
    duration: '5m',
    severity: 'warning',
    annotations: {
      summary: 'API endpoint {{ $labels.endpoint }} is experiencing high latency',
      description: 'Average latency is {{ $value }}ms over the last 5 minutes'
    }
  },
  
  // Availability alerts
  {
    name: 'Service Down',
    query: 'up{service="eva-api"}',
    condition: '== 0',
    duration: '1m',
    severity: 'critical',
    annotations: {
      summary: 'EVA API service is down',
      runbook: 'https://wiki.internal/runbooks/eva-api-down'
    }
  },
  
  // Resource alerts
  {
    name: 'High Memory Usage',
    query: 'memory_usage_percent',
    condition: '> 85',
    duration: '10m',
    severity: 'warning',
    annotations: {
      summary: 'Memory usage is above 85%',
      description: 'Current usage: {{ $value }}%'
    }
  },
  
  // Business alerts
  {
    name: 'Task Queue Backlog',
    query: 'task_queue_size',
    condition: '> 1000',
    duration: '15m',
    severity: 'warning',
    annotations: {
      summary: 'Task queue has {{ $value }} pending tasks'
    }
  },
  
  // Security alerts
  {
    name: 'Authentication Failures Spike',
    query: 'rate(auth_failures[5m])',
    condition: '> 10',
    duration: '5m',
    severity: 'high',
    annotations: {
      summary: 'Unusual number of authentication failures detected'
    }
  }
];

6.1.2 Alert Routing
Intelligent alert routing:

// Alert router configuration
class AlertRouter {
  private routes: Route[] = [
    {
      match: { severity: 'critical' },
      receivers: ['pagerduty', 'slack-critical', 'email-oncall'],
      continueRouting: true
    },
    {
      match: { severity: 'high', service: 'auth' },
      receivers: ['security-team', 'slack-security'],
      continueRouting: false
    },
    {
      match: { severity: 'warning' },
      receivers: ['slack-warnings'],
      groupBy: ['alertname', 'service'],
      groupWait: '30s',
      groupInterval: '5m'
    }
  ];

  async route(alert: Alert) {
    const receivers = new Set<string>();
    
    for (const route of this.routes) {
      if (this.matchesRoute(alert, route)) {
        route.receivers.forEach(r => receivers.add(r));
        
        if (!route.continueRouting) {
          break;
        }
      }
    }

    // Send to all matched receivers
    await Promise.all(
      Array.from(receivers).map(receiver => 
        this.sendToReceiver(alert, receiver)
      )
    );
  }

  private matchesRoute(alert: Alert, route: Route): boolean {
    return Object.entries(route.match).every(([key, value]) => 
      alert[key] === value
    );
  }
}

6.2 Notification Channels

6.2.1 Multi-Channel Notifications
Various notification integrations:

// Notification manager
class NotificationManager {
  private channels = new Map<string, NotificationChannel>();

  constructor() {
    // Register channels
    this.channels.set('slack', new SlackChannel());
    this.channels.set('email', new EmailChannel());
    this.channels.set('pagerduty', new PagerDutyChannel());
    this.channels.set('webhook', new WebhookChannel());
  }

  async notify(channelName: string, alert: Alert) {
    const channel = this.channels.get(channelName);
    if (!channel) {
      throw new Error(`Unknown channel: ${channelName}`);
    }

    try {
      await channel.send(alert);
      
      // Log notification
      await this.logNotification({
        channel: channelName,
        alert: alert.name,
        status: 'sent',
        timestamp: new Date()
      });
    } catch (error) {
      // Log failure
      await this.logNotification({
        channel: channelName,
        alert: alert.name,
        status: 'failed',
        error: error.message,
        timestamp: new Date()
      });

      // Fallback notification
      await this.fallbackNotification(alert, error);
    }
  }
}

// Slack channel implementation
class SlackChannel implements NotificationChannel {
  async send(alert: Alert) {
    const color = this.getSeverityColor(alert.severity);
    
    const payload = {
      attachments: [{
        color,
        title: alert.name,
        text: alert.annotations.summary,
        fields: [
          {
            title: 'Severity',
            value: alert.severity,
            short: true
          },
          {
            title: 'Time',
            value: alert.timestamp,
            short: true
          }
        ],
        actions: [
          {
            type: 'button',
            text: 'View in Dashboard',
            url: `${DASHBOARD_URL}/alerts/${alert.id}`
          },
          {
            type: 'button',
            text: 'Acknowledge',
            url: `${API_URL}/alerts/${alert.id}/ack`
          }
        ]
      }]
    };

    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
}

7. Performance Analysis

7.1 Performance Profiling

7.1.1 Continuous Profiling
Always-on performance profiling:

// CPU profiler
class CPUProfiler {
  private profiling = false;
  private samples: ProfileSample[] = [];

  start(duration: number = 60000) {
    if (this.profiling) return;
    
    this.profiling = true;
    const startTime = Date.now();
    
    // Start V8 profiler
    const profiler = require('v8-profiler-next');
    profiler.startProfiling('cpu-profile');
    
    setTimeout(() => {
      const profile = profiler.stopProfiling('cpu-profile');
      
      // Process profile
      this.processProfile(profile, startTime);
      
      // Upload to storage
      this.uploadProfile(profile);
      
      profile.delete();
      this.profiling = false;
    }, duration);
  }

  private processProfile(profile: any, startTime: number) {
    // Extract hot functions
    const hotFunctions = this.findHotFunctions(profile);
    
    // Store metrics
    metrics.gauge('profiler.cpu.hot_functions', hotFunctions.length);
    
    hotFunctions.forEach(func => {
      metrics.gauge('profiler.cpu.function_time', func.selfTime, {
        function: func.functionName,
        file: func.file
      });
    });
  }
}

// Memory profiler
class MemoryProfiler {
  async captureHeapSnapshot() {
    const v8 = require('v8');
    const filename = `heap-${Date.now()}.heapsnapshot`;
    
    const stream = v8.writeHeapSnapshot();
    const chunks = [];
    
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    
    const snapshot = Buffer.concat(chunks);
    
    // Analyze snapshot
    const analysis = await this.analyzeSnapshot(snapshot);
    
    // Store metrics
    metrics.gauge('profiler.memory.heap_size', analysis.totalSize);
    metrics.gauge('profiler.memory.object_count', analysis.objectCount);
    
    // Upload for detailed analysis
    await this.uploadSnapshot(snapshot, analysis);
    
    return analysis;
  }
}

7.2 Anomaly Detection

7.2.1 Statistical Anomaly Detection
Detecting performance anomalies:

// Anomaly detector
class AnomalyDetector {
  private readonly WINDOW_SIZE = 100;
  private readonly Z_SCORE_THRESHOLD = 3;
  
  async detectAnomalies(metric: string, timeRange: TimeRange) {
    // Fetch historical data
    const data = await this.fetchMetricData(metric, timeRange);
    
    // Calculate statistics
    const stats = this.calculateStats(data);
    
    // Detect anomalies
    const anomalies = data.filter(point => {
      const zScore = Math.abs((point.value - stats.mean) / stats.stdDev);
      return zScore > this.Z_SCORE_THRESHOLD;
    });

    // Check for trend changes
    const trendAnomalies = this.detectTrendChanges(data);
    
    return {
      pointAnomalies: anomalies,
      trendAnomalies,
      statistics: stats
    };
  }

  private detectTrendChanges(data: MetricPoint[]) {
    // Simple change point detection
    const changePoints = [];
    const windowSize = 20;
    
    for (let i = windowSize; i < data.length - windowSize; i++) {
      const before = data.slice(i - windowSize, i);
      const after = data.slice(i, i + windowSize);
      
      const meanBefore = this.mean(before.map(p => p.value));
      const meanAfter = this.mean(after.map(p => p.value));
      
      const change = Math.abs(meanAfter - meanBefore) / meanBefore;
      
      if (change > 0.5) { // 50% change
        changePoints.push({
          timestamp: data[i].timestamp,
          changeMagnitude: change,
          beforeMean: meanBefore,
          afterMean: meanAfter
        });
      }
    }
    
    return changePoints;
  }
}

8. Observability Dashboard

8.1 Dashboard Architecture

8.1.1 Real-Time Dashboard Components
Building observable dashboards:

// Dashboard state manager
class DashboardState {
  private subscriptions = new Map<string, Subscription>();
  private data = new Map<string, any>();
  
  subscribeToMetric(widget: string, metric: string, options: MetricOptions) {
    // Unsubscribe existing
    this.unsubscribe(widget);
    
    // Create real-time subscription
    const sub = supabase
      .channel(`dashboard:${widget}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'metrics',
        filter: `name=eq.${metric}`
      }, (payload) => {
        this.updateWidget(widget, payload.new);
      })
      .subscribe();
    
    this.subscriptions.set(widget, sub);
    
    // Fetch initial data
    this.fetchInitialData(widget, metric, options);
  }

  private async fetchInitialData(widget: string, metric: string, options: MetricOptions) {
    const data = await fetchMetrics({
      metric,
      timeRange: options.timeRange,
      aggregation: options.aggregation,
      groupBy: options.groupBy
    });
    
    this.data.set(widget, data);
    this.notifyUpdate(widget);
  }

  private updateWidget(widget: string, newData: any) {
    const existing = this.data.get(widget) || [];
    
    // Add new data point
    existing.push(newData);
    
    // Maintain window size
    const maxPoints = 100;
    if (existing.length > maxPoints) {
      existing.shift();
    }
    
    this.data.set(widget, existing);
    this.notifyUpdate(widget);
  }
}

// Dashboard widget component
export function MetricWidget({ metric, title, type = 'line' }) {
  const [data, setData] = useState([]);
  const [stats, setStats] = useState({});
  
  useEffect(() => {
    // Subscribe to metric
    dashboard.subscribeToMetric(widgetId, metric, {
      timeRange: { start: Date.now() - 3600000, end: Date.now() },
      aggregation: 'avg',
      interval: '1m'
    });
    
    // Listen for updates
    dashboard.onUpdate(widgetId, (newData) => {
      setData(newData);
      setStats(calculateStats(newData));
    });
    
    return () => dashboard.unsubscribe(widgetId);
  }, [metric]);
  
  return (
    <Widget>
      <WidgetHeader title={title} stats={stats} />
      <WidgetBody>
        {type === 'line' && <LineChart data={data} />}
        {type === 'gauge' && <GaugeChart value={stats.current} />}
        {type === 'heatmap' && <HeatmapChart data={data} />}
      </WidgetBody>
    </Widget>
  );
}

8.2 Observability Insights

8.2.1 Automated Insights
AI-powered observability:

// Insight generator
class InsightGenerator {
  async generateInsights(timeRange: TimeRange) {
    const insights = [];
    
    // Performance insights
    const perfData = await this.getPerformanceData(timeRange);
    insights.push(...this.analyzePerformance(perfData));
    
    // Error insights
    const errorData = await this.getErrorData(timeRange);
    insights.push(...this.analyzeErrors(errorData));
    
    // Usage insights
    const usageData = await this.getUsageData(timeRange);
    insights.push(...this.analyzeUsage(usageData));
    
    // Rank by importance
    return this.rankInsights(insights);
  }

  private analyzePerformance(data: PerformanceData): Insight[] {
    const insights = [];
    
    // Latency degradation
    if (data.currentP95 > data.baselineP95 * 1.5) {
      insights.push({
        type: 'performance',
        severity: 'high',
        title: 'Latency Degradation Detected',
        description: `P95 latency increased by ${Math.round((data.currentP95 / data.baselineP95 - 1) * 100)}%`,
        recommendation: 'Investigate recent deployments and database queries',
        affectedEndpoints: data.slowestEndpoints
      });
    }
    
    // Throughput drop
    if (data.currentThroughput < data.baselineThroughput * 0.7) {
      insights.push({
        type: 'performance',
        severity: 'medium',
        title: 'Throughput Below Normal',
        description: `Request throughput dropped by ${Math.round((1 - data.currentThroughput / data.baselineThroughput) * 100)}%`,
        recommendation: 'Check for service degradation or upstream issues'
      });
    }
    
    return insights;
  }
}

Conclusion

The EVA Assistant's monitoring and observability architecture provides comprehensive visibility into system behavior through metrics, logs, and traces. The real-time dashboards, automated alerting, and AI-powered insights enable rapid problem detection and resolution. With continuous profiling and anomaly detection, the system can identify and address performance issues before they impact users. The observability platform scales with the application and provides the foundation for data-driven decision making and continuous improvement.