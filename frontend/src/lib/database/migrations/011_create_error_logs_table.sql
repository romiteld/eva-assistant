-- Create error logs table for centralized error tracking
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'unknown',
    severity TEXT NOT NULL DEFAULT 'medium',
    context JSONB,
    stack TEXT,
    user_id UUID,
    session_id TEXT,
    user_agent TEXT,
    url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(category);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_session_id ON error_logs(session_id);

-- Add RLS policies for security
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view their own errors
CREATE POLICY "Users can view their own errors" ON error_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Policy to allow users to insert their own errors
CREATE POLICY "Users can insert their own errors" ON error_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy to allow admins to view all errors
CREATE POLICY "Admins can view all errors" ON error_logs
    FOR SELECT USING (auth.role() = 'admin');

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_error_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER error_logs_updated_at_trigger
    BEFORE UPDATE ON error_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_error_logs_updated_at();

-- Create performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name TEXT NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_unit TEXT NOT NULL DEFAULT 'ms',
    metric_type TEXT NOT NULL DEFAULT 'performance',
    tags JSONB,
    user_id UUID,
    session_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance metrics
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_id ON performance_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_type ON performance_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at ON performance_metrics(created_at);

-- Add RLS policies for performance metrics
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view their own metrics
CREATE POLICY "Users can view their own metrics" ON performance_metrics
    FOR SELECT USING (auth.uid() = user_id);

-- Policy to allow users to insert their own metrics
CREATE POLICY "Users can insert their own metrics" ON performance_metrics
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy to allow admins to view all metrics
CREATE POLICY "Admins can view all metrics" ON performance_metrics
    FOR SELECT USING (auth.role() = 'admin');

-- Create alert configurations table
CREATE TABLE IF NOT EXISTS alert_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_name TEXT NOT NULL,
    alert_type TEXT NOT NULL DEFAULT 'error_threshold',
    conditions JSONB NOT NULL,
    notification_channels JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for alert configurations
CREATE INDEX IF NOT EXISTS idx_alert_configurations_type ON alert_configurations(alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_configurations_active ON alert_configurations(is_active);
CREATE INDEX IF NOT EXISTS idx_alert_configurations_created_by ON alert_configurations(created_by);

-- Add RLS policies for alert configurations
ALTER TABLE alert_configurations ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to manage their own alerts
CREATE POLICY "Users can manage their own alerts" ON alert_configurations
    FOR ALL USING (auth.uid() = created_by);

-- Policy to allow admins to view all alerts
CREATE POLICY "Admins can view all alerts" ON alert_configurations
    FOR SELECT USING (auth.role() = 'admin');

-- Create alert history table
CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID REFERENCES alert_configurations(id) ON DELETE CASCADE,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    alert_data JSONB,
    notification_sent BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID
);

-- Add indexes for alert history
CREATE INDEX IF NOT EXISTS idx_alert_history_alert_id ON alert_history(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_triggered_at ON alert_history(triggered_at);
CREATE INDEX IF NOT EXISTS idx_alert_history_resolved_at ON alert_history(resolved_at);

-- Add RLS policies for alert history
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view alerts for their configurations
CREATE POLICY "Users can view their alert history" ON alert_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM alert_configurations 
            WHERE id = alert_history.alert_id 
            AND created_by = auth.uid()
        )
    );

-- Policy to allow admins to view all alert history
CREATE POLICY "Admins can view all alert history" ON alert_history
    FOR SELECT USING (auth.role() = 'admin');

-- Comments for documentation
COMMENT ON TABLE error_logs IS 'Centralized error logging with categorization and severity levels';
COMMENT ON TABLE performance_metrics IS 'Performance metrics tracking including Core Web Vitals';
COMMENT ON TABLE alert_configurations IS 'Alert rules and notification configurations';
COMMENT ON TABLE alert_history IS 'History of triggered alerts and their resolution';