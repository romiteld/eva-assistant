# EVA Assistant Operational Runbook

This runbook provides step-by-step procedures for common operational scenarios and incidents.

## Table of Contents

1. [System Start/Stop Procedures](#system-startstop-procedures)
2. [Incident Response Procedures](#incident-response-procedures)
3. [Performance Issues](#performance-issues)
4. [Database Operations](#database-operations)
5. [Security Incidents](#security-incidents)
6. [Integration Failures](#integration-failures)
7. [Monitoring and Alerts](#monitoring-and-alerts)

---

## System Start/Stop Procedures

### Starting the System

```bash
# 1. Verify database is running
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;"

# 2. Start the application
cd /app/eva-assistant
pm2 start ecosystem.config.js

# 3. Verify startup
pm2 status
curl http://localhost:3000/api/health

# 4. Check logs for errors
pm2 logs eva-assistant --lines 50
```

### Graceful Shutdown

```bash
# 1. Notify users (if applicable)
# Send notification through admin panel

# 2. Stop accepting new requests
pm2 scale eva-assistant 0

# 3. Wait for active requests to complete
sleep 30

# 4. Stop the application
pm2 stop eva-assistant

# 5. Verify shutdown
pm2 status
```

### Emergency Shutdown

```bash
# Use only when graceful shutdown fails
pm2 kill
pkill -f node

# Verify all processes stopped
ps aux | grep node
```

---

## Incident Response Procedures

### High Error Rate (>10%)

**Symptoms**: Alert triggered for error rate exceeding threshold

**Immediate Actions**:
1. Check current error rate
   ```bash
   curl http://localhost:3000/api/monitoring/metrics | jq '.errorRate'
   ```

2. Identify error patterns
   ```bash
   pm2 logs eva-assistant --err --lines 100 | grep -E "ERROR|FATAL"
   ```

3. Check specific endpoints
   ```bash
   # Review recent API logs
   tail -f /var/log/eva-assistant/api.log | grep "status\":5"
   ```

**Resolution Steps**:
1. If database-related:
   ```sql
   -- Check connection count
   SELECT count(*) FROM pg_stat_activity;
   
   -- Check for blocking queries
   SELECT pid, usename, pg_blocking_pids(pid) as blocked_by, query
   FROM pg_stat_activity
   WHERE pg_blocking_pids(pid)::text != '{}';
   ```

2. If memory-related:
   ```bash
   # Check memory usage
   pm2 monit
   
   # Restart with increased memory
   pm2 delete eva-assistant
   NODE_OPTIONS="--max-old-space-size=4096" pm2 start ecosystem.config.js
   ```

3. If external service failure:
   ```bash
   # Check integration health
   curl http://localhost:3000/api/health/integrations
   
   # Enable circuit breaker
   pm2 set eva-assistant:CIRCUIT_BREAKER_ENABLED true
   pm2 restart eva-assistant
   ```

### System Unresponsive

**Symptoms**: Health check failing, no response from API

**Immediate Actions**:
1. Check if process is running
   ```bash
   pm2 list
   ps aux | grep node
   ```

2. Check system resources
   ```bash
   top
   df -h
   free -m
   ```

3. Check network connectivity
   ```bash
   netstat -tulpn | grep :3000
   curl -I http://localhost:3000
   ```

**Resolution Steps**:
1. Restart application
   ```bash
   pm2 restart eva-assistant
   ```

2. If restart fails, check logs
   ```bash
   pm2 logs eva-assistant --err --lines 200
   journalctl -u eva-assistant -n 100
   ```

3. Force restart if necessary
   ```bash
   pm2 delete eva-assistant
   pm2 start ecosystem.config.js
   ```

---

## Performance Issues

### Slow API Response Times

**Symptoms**: P95 latency > 2 seconds

**Diagnosis**:
1. Check current metrics
   ```bash
   curl http://localhost:3000/api/monitoring/metrics | jq '.apiStats'
   ```

2. Identify slow endpoints
   ```bash
   # Review API performance logs
   grep "duration" /var/log/eva-assistant/api.log | \
   awk -F'"duration":' '{print $2}' | sort -nr | head -20
   ```

3. Check database performance
   ```sql
   -- Find slow queries
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   WHERE mean_exec_time > 1000
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

**Resolution**:
1. Enable query caching
   ```bash
   pm2 set eva-assistant:REDIS_CACHE_ENABLED true
   pm2 set eva-assistant:CACHE_TTL 3600
   pm2 restart eva-assistant
   ```

2. Scale up instances
   ```bash
   pm2 scale eva-assistant +2
   ```

3. Optimize database
   ```sql
   -- Update statistics
   ANALYZE;
   
   -- Reindex if needed
   REINDEX DATABASE eva_db;
   ```

### High Memory Usage

**Symptoms**: Memory usage > 85%

**Diagnosis**:
1. Check memory details
   ```bash
   pm2 monit
   ps aux --sort=-%mem | head -10
   ```

2. Generate heap snapshot
   ```bash
   pm2 heapdump eva-assistant
   ```

3. Check for memory leaks
   ```bash
   # Monitor over time
   while true; do
     pm2 describe eva-assistant | grep memory
     sleep 60
   done
   ```

**Resolution**:
1. Restart to clear memory
   ```bash
   pm2 restart eva-assistant
   ```

2. Reduce cache size
   ```bash
   pm2 set eva-assistant:MAX_CACHE_SIZE 1000
   pm2 restart eva-assistant
   ```

3. Enable memory limits
   ```javascript
   // ecosystem.config.js
   max_memory_restart: '1G'
   ```

---

## Database Operations

### Database Connection Issues

**Symptoms**: "ECONNREFUSED" or "too many connections" errors

**Diagnosis**:
1. Check database status
   ```bash
   systemctl status postgresql
   psql -h $DB_HOST -U $DB_USER -c "SELECT 1;"
   ```

2. Check connection count
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   SELECT usename, count(*) 
   FROM pg_stat_activity 
   GROUP BY usename;
   ```

**Resolution**:
1. Kill idle connections
   ```sql
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE state = 'idle' 
   AND state_change < now() - interval '10 minutes';
   ```

2. Increase connection limit
   ```sql
   ALTER SYSTEM SET max_connections = 200;
   -- Restart required
   ```

3. Restart connection pool
   ```bash
   pm2 restart eva-assistant
   ```

### Database Backup and Restore

**Scheduled Backup**:
```bash
#!/bin/bash
# backup-database.sh
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/backups/eva_db_${TIMESTAMP}.sql"

# Create backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > $BACKUP_FILE

# Compress
gzip $BACKUP_FILE

# Upload to S3
aws s3 cp ${BACKUP_FILE}.gz s3://eva-backups/database/

# Clean old backups (keep 30 days)
find /backups -name "eva_db_*.gz" -mtime +30 -delete
```

**Emergency Restore**:
```bash
# 1. Stop application
pm2 stop eva-assistant

# 2. Backup current state
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > emergency_backup.sql

# 3. Restore from backup
gunzip < backup_file.sql.gz | psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# 4. Verify restore
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\dt"

# 5. Restart application
pm2 start eva-assistant
```

---

## Security Incidents

### Suspected Security Breach

**Immediate Actions**:
1. Isolate the system
   ```bash
   # Block all incoming traffic except admin
   iptables -A INPUT -s $ADMIN_IP -j ACCEPT
   iptables -A INPUT -j DROP
   ```

2. Preserve evidence
   ```bash
   # Create forensic copy
   tar -czf /secure/evidence_$(date +%Y%m%d_%H%M%S).tar.gz \
     /var/log/eva-assistant \
     /var/log/nginx \
     /var/log/auth.log
   ```

3. Check for compromised accounts
   ```sql
   -- Recent login attempts
   SELECT user_id, ip_address, created_at, success
   FROM auth_logs
   WHERE created_at > now() - interval '24 hours'
   ORDER BY created_at DESC;
   ```

**Investigation**:
1. Review access logs
   ```bash
   # Unusual access patterns
   grep -E "401|403|404" /var/log/nginx/access.log | \
   awk '{print $1}' | sort | uniq -c | sort -nr | head -20
   ```

2. Check for suspicious files
   ```bash
   # Recently modified files
   find /app -type f -mtime -1 -ls
   
   # Check for unauthorized changes
   git status
   git diff
   ```

### DDoS Attack

**Symptoms**: Unusually high traffic, service degradation

**Immediate Mitigation**:
1. Enable rate limiting
   ```nginx
   # nginx.conf
   limit_req_zone $binary_remote_addr zone=ddos:10m rate=10r/s;
   limit_req zone=ddos burst=20 nodelay;
   ```

2. Block suspicious IPs
   ```bash
   # Identify top requesters
   awk '{print $1}' /var/log/nginx/access.log | \
   sort | uniq -c | sort -nr | head -20
   
   # Block IP
   iptables -A INPUT -s $SUSPICIOUS_IP -j DROP
   ```

3. Enable Cloudflare DDoS protection
   ```bash
   # Update DNS to use Cloudflare
   # Enable "Under Attack" mode in Cloudflare dashboard
   ```

---

## Integration Failures

### External API Failures

**Firecrawl API Issues**:
```bash
# 1. Check API status
curl -I https://api.firecrawl.dev/health

# 2. Verify API key
curl -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
  https://api.firecrawl.dev/v0/scrape

# 3. Enable fallback mode
pm2 set eva-assistant:FIRECRAWL_FALLBACK_ENABLED true
pm2 restart eva-assistant
```

**Gemini API Issues**:
```bash
# 1. Check quota
curl -H "Authorization: Bearer $GEMINI_API_KEY" \
  https://generativelanguage.googleapis.com/v1/models

# 2. Switch to backup model
pm2 set eva-assistant:GEMINI_MODEL "gemini-pro"
pm2 restart eva-assistant
```

### Database Replication Lag

**Symptoms**: Data inconsistencies, old data being served

**Diagnosis**:
```sql
-- Check replication status
SELECT client_addr, state, sent_lsn, write_lsn, replay_lsn
FROM pg_stat_replication;

-- Check lag
SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;
```

**Resolution**:
1. Force read from primary
   ```bash
   pm2 set eva-assistant:FORCE_PRIMARY_DB true
   pm2 restart eva-assistant
   ```

2. Investigate replication issues
   ```sql
   -- On replica
   SELECT * FROM pg_stat_wal_receiver;
   ```

---

## Monitoring and Alerts

### Alert Configuration

**Adding Custom Alerts**:
```typescript
// custom-alerts.ts
import { alertManager, AlertSeverity, AlertCategory } from '@/lib/monitoring/alerts';

// Add business logic alert
alertManager.addRule({
  id: 'low-task-completion',
  name: 'Low Task Completion Rate',
  description: 'Task completion rate below 80%',
  category: AlertCategory.CUSTOM,
  enabled: true,
  condition: (value) => value < 80,
  threshold: 80,
  severity: AlertSeverity.WARNING,
  cooldown: 3600000 // 1 hour
});
```

### Metrics Collection

**Custom Metrics**:
```bash
# Add custom metric collection
curl -X POST http://localhost:3000/api/monitoring/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "name": "custom.business.metric",
    "value": 42,
    "unit": "count",
    "tags": {
      "component": "workflow",
      "action": "completed"
    }
  }'
```

**Exporting Metrics**:
```bash
# Export to Prometheus format
curl http://localhost:3000/api/monitoring/metrics/export?format=prometheus

# Export to Datadog
curl http://localhost:3000/api/monitoring/metrics/export?format=datadog \
  -H "X-Datadog-API-Key: $DATADOG_API_KEY"
```

---

## Quick Reference

### Key Commands

```bash
# Application Management
pm2 start eva-assistant
pm2 stop eva-assistant
pm2 restart eva-assistant
pm2 logs eva-assistant
pm2 monit

# Health Checks
curl http://localhost:3000/api/health
curl http://localhost:3000/api/health/database
curl http://localhost:3000/api/monitoring/metrics

# Database
psql -h $DB_HOST -U $DB_USER -d $DB_NAME
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup.sql

# Logs
tail -f /var/log/eva-assistant/app.log
tail -f /var/log/eva-assistant/error.log
journalctl -u eva-assistant -f

# System Resources
htop
iotop
netstat -tulpn
df -h
```

### Important Files

```
/app/eva-assistant/              # Application directory
├── ecosystem.config.js          # PM2 configuration
├── .env.production             # Environment variables
└── logs/                       # Application logs

/etc/nginx/sites-available/eva  # Nginx configuration
/etc/systemd/system/eva.service # Systemd service file
/var/log/eva-assistant/         # Log directory
/backups/eva-assistant/         # Backup directory
```

### Contact Information

- **On-Call Engineer**: [Phone/Email]
- **Database Admin**: [Phone/Email]
- **Security Team**: [Phone/Email]
- **Escalation Manager**: [Phone/Email]

---

Last Updated: 2024-01-01
Version: 1.0.0