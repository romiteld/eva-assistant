# Soft Delete and Audit Trail System Documentation

## Overview

This implementation provides a comprehensive soft delete and audit trail system for your Supabase database. It includes:

1. **Soft Delete Functionality**: Records are marked as deleted rather than permanently removed
2. **Audit Trail**: Complete history of all database changes (INSERT, UPDATE, DELETE, SOFT_DELETE, RESTORE)
3. **Automatic Tracking**: Database triggers automatically log all changes
4. **Recovery Options**: Ability to restore soft-deleted records
5. **Purge Management**: Scheduled cleanup of old soft-deleted records

## Database Schema Changes

### 1. Soft Delete Columns
All tables now have a `deleted_at` column:
```sql
deleted_at timestamptz -- NULL for active records, timestamp for deleted records
```

### 2. Audit Logs Table
```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL, -- INSERT, UPDATE, DELETE, SOFT_DELETE, RESTORE
  user_id uuid,
  user_email text,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  ip_address inet,
  user_agent text,
  session_id uuid,
  created_at timestamptz DEFAULT now(),
  metadata jsonb
);
```

## Key Functions

### 1. Soft Delete a Record
```sql
-- Soft delete a record
SELECT soft_delete('table_name', 'record_id'::uuid);
-- Returns: boolean (true if successful)
```

### 2. Restore a Soft-Deleted Record
```sql
-- Restore a soft-deleted record
SELECT restore_record('table_name', 'record_id'::uuid);
-- Returns: boolean (true if successful)
```

### 3. Get Audit History
```sql
-- Get complete audit history for a record
SELECT * FROM get_audit_history('table_name', 'record_id'::uuid);

-- Get user's audit trail
SELECT * FROM get_user_audit_trail('user_id'::uuid, start_date, end_date);
```

### 4. Purge Old Soft-Deleted Records
```sql
-- Manually purge records older than 30 days
SELECT purge_deleted_records(NULL, 30);

-- Purge specific table
SELECT purge_deleted_records('table_name', 30);

-- Scheduled purge (can be automated with pg_cron)
SELECT * FROM scheduled_purge_soft_deletes(30);
```

### 5. Investigation Functions
```sql
-- Find who deleted a record
SELECT * FROM who_deleted_record('table_name', 'record_id'::uuid);

-- Get change frequency for a record
SELECT * FROM get_record_change_frequency('table_name', 'record_id'::uuid);
```

## Views

### 1. Active Records Views
For each table, there's an `active_*` view that shows only non-deleted records:
- `active_candidates`
- `active_documents`
- `active_tasks`
- etc.

### 2. Audit Summary Views
- `audit_recent_changes`: Shows changes in the last 7 days
- `audit_user_activity_summary`: Summary of user activities
- `audit_table_activity_summary`: Summary by table
- `soft_delete_pending_purge`: Records pending permanent deletion
- `deleted_records`: All soft-deleted records across tables

## Usage Examples

### 1. Soft Delete a Candidate
```sql
-- Using the function
SELECT soft_delete('candidates', '123e4567-e89b-12d3-a456-426614174000');

-- Or using UPDATE
UPDATE candidates 
SET deleted_at = now() 
WHERE id = '123e4567-e89b-12d3-a456-426614174000';
```

### 2. View Active Records Only
```sql
-- Use the active views
SELECT * FROM active_candidates;

-- Or add WHERE clause
SELECT * FROM candidates WHERE deleted_at IS NULL;
```

### 3. Find Deleted Records
```sql
-- All deleted records
SELECT * FROM deleted_records;

-- Deleted candidates
SELECT * FROM candidates WHERE deleted_at IS NOT NULL;
```

### 4. Restore a Record
```sql
SELECT restore_record('candidates', '123e4567-e89b-12d3-a456-426614174000');
```

### 5. View Audit Trail
```sql
-- Recent changes
SELECT * FROM audit_recent_changes;

-- Specific record history
SELECT * FROM get_audit_history('candidates', '123e4567-e89b-12d3-a456-426614174000');

-- User activity
SELECT * FROM audit_user_activity_summary WHERE user_email = 'user@example.com';
```

## Row Level Security (RLS)

All tables have been updated with RLS policies that:
1. Hide soft-deleted records from regular users
2. Allow service role to see all records
3. Maintain existing access control rules

Example policy:
```sql
CREATE POLICY "Users see only active records" ON table_name
  FOR SELECT
  USING (deleted_at IS NULL AND [existing conditions]);
```

## Automatic Triggers

Every INSERT, UPDATE, or DELETE operation is automatically logged:
- User information is captured
- Changed fields are tracked
- Old and new values are stored
- Soft deletes are distinguished from hard deletes

## Best Practices

### 1. Always Use Soft Delete
```sql
-- Preferred
SELECT soft_delete('table_name', record_id);

-- Avoid hard delete unless necessary
DELETE FROM table_name WHERE id = record_id;
```

### 2. Regular Purging
Set up a scheduled job to purge old soft-deleted records:
```sql
-- Example: Purge records older than 90 days
SELECT scheduled_purge_soft_deletes(90);
```

### 3. Monitoring
Regularly check audit summaries:
```sql
-- Check for unusual activity
SELECT * FROM audit_table_activity_summary 
WHERE soft_deletes > 100 
  AND last_modified > now() - interval '1 day';

-- Monitor pending purges
SELECT * FROM soft_delete_pending_purge;
```

### 4. Recovery Window
Default retention is 30 days. Adjust based on your needs:
- Compliance requirements
- Storage constraints
- Recovery needs

## Integration with Application Code

### TypeScript/JavaScript Example
```typescript
// Soft delete a record
const { data, error } = await supabase
  .rpc('soft_delete', {
    p_table_name: 'candidates',
    p_record_id: candidateId
  });

// Get audit history
const { data: history } = await supabase
  .rpc('get_audit_history', {
    p_table_name: 'candidates',
    p_record_id: candidateId
  });

// Query only active records
const { data: activeCandidates } = await supabase
  .from('active_candidates')
  .select('*');
```

## Maintenance

### 1. Monitor Audit Log Size
```sql
SELECT 
  pg_size_pretty(pg_total_relation_size('audit_logs')) as total_size,
  COUNT(*) as total_records
FROM audit_logs;
```

### 2. Archive Old Audit Logs
Consider archiving audit logs older than 1 year to a separate table or external storage.

### 3. Index Optimization
Monitor and optimize indexes based on query patterns:
```sql
-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Security Considerations

1. **Audit logs are immutable**: Once created, they cannot be modified
2. **Access control**: Users can only see their own audit records
3. **Service role**: Has full access for administrative tasks
4. **Sensitive data**: Consider encrypting sensitive fields in audit logs

## Troubleshooting

### 1. Record Not Restoring
Check if the record exists and is soft-deleted:
```sql
SELECT id, deleted_at FROM table_name WHERE id = 'record_id';
```

### 2. Audit Logs Missing
Verify triggers are active:
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
  AND trigger_name LIKE 'audit_trigger_%';
```

### 3. Performance Issues
Check for missing indexes:
```sql
SELECT * FROM soft_delete_pending_purge;
-- High numbers indicate need for purging
```

## Future Enhancements

1. **Automated Archiving**: Move old audit logs to cold storage
2. **Compliance Reports**: Generate compliance-specific audit reports
3. **Real-time Notifications**: Alert on specific audit events
4. **Data Retention Policies**: Implement table-specific retention rules
5. **Audit Log Analysis**: Machine learning for anomaly detection