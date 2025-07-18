-- OAuth Sessions table for Edge Functions
-- This table stores temporary OAuth state during the authentication flow
create table if not exists public.oauth_sessions (
  id uuid primary key default gen_random_uuid(),
  state text unique not null,
  code_verifier text not null,
  provider text not null,
  user_agent text,
  ip_address inet,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  
  -- Indexes for performance
  constraint oauth_sessions_state_key unique (state)
);

-- Index for efficient lookups
create index idx_oauth_sessions_state on public.oauth_sessions (state);
create index idx_oauth_sessions_expires on public.oauth_sessions (expires_at);
create index idx_oauth_sessions_provider on public.oauth_sessions (provider, created_at);

-- OAuth Tokens table for storing provider tokens
create table if not exists public.user_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  token_type text default 'Bearer',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Ensure one token per provider per user
  constraint user_oauth_tokens_unique unique (user_id, provider)
);

-- Indexes for performance
create index idx_user_oauth_tokens_user on public.user_oauth_tokens (user_id);
create index idx_user_oauth_tokens_provider on public.user_oauth_tokens (provider);
create index idx_user_oauth_tokens_expires on public.user_oauth_tokens (expires_at);

-- RLS Policies
alter table public.oauth_sessions enable row level security;
alter table public.user_oauth_tokens enable row level security;

-- OAuth sessions are only accessible by service role (Edge Functions)
create policy "Service role can manage oauth_sessions"
  on public.oauth_sessions
  for all
  to service_role
  using (true)
  with check (true);

-- Users can only access their own OAuth tokens
create policy "Users can view own oauth tokens"
  on public.user_oauth_tokens
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Service role can manage all tokens
create policy "Service role can manage oauth tokens"
  on public.user_oauth_tokens
  for all
  to service_role
  using (true)
  with check (true);

-- Function to clean up expired OAuth sessions
create or replace function public.cleanup_expired_oauth_sessions()
returns void as $$
begin
  delete from public.oauth_sessions 
  where expires_at < now();
end;
$$ language plpgsql security definer;

-- Function to encrypt sensitive token data (implement based on your security requirements)
create or replace function public.encrypt_token(token text)
returns text as $$
begin
  -- In production, implement proper encryption using pgcrypto or Vault
  -- This is a placeholder that returns the token as-is
  return token;
end;
$$ language plpgsql security definer;

-- Function to decrypt sensitive token data
create or replace function public.decrypt_token(encrypted_token text)
returns text as $$
begin
  -- In production, implement proper decryption using pgcrypto or Vault
  -- This is a placeholder that returns the token as-is
  return encrypted_token;
end;
$$ language plpgsql security definer;

-- Trigger to update the updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_user_oauth_tokens_updated_at
  before update on public.user_oauth_tokens
  for each row
  execute function public.update_updated_at_column();

-- OAuth error tracking for monitoring
create table if not exists public.oauth_errors (
  id uuid primary key default gen_random_uuid(),
  trace_id text,
  provider text,
  error_type text,
  error_message text,
  error_details jsonb,
  user_agent text,
  ip_address inet,
  created_at timestamptz default now()
);

-- Index for error analysis
create index idx_oauth_errors_provider on public.oauth_errors (provider, created_at);
create index idx_oauth_errors_type on public.oauth_errors (error_type, created_at);
create index idx_oauth_errors_trace on public.oauth_errors (trace_id);

-- RLS for error tracking
alter table public.oauth_errors enable row level security;

create policy "Service role can manage oauth errors"
  on public.oauth_errors
  for all
  to service_role
  using (true)
  with check (true);

-- Metrics table for tracking OAuth performance
create table if not exists public.oauth_metrics (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  action text not null, -- 'login', 'callback', 'refresh'
  duration_ms integer,
  success boolean,
  error_type text,
  user_agent text,
  created_at timestamptz default now()
);

-- Indexes for metrics analysis
create index idx_oauth_metrics_provider on public.oauth_metrics (provider, created_at);
create index idx_oauth_metrics_action on public.oauth_metrics (action, created_at);
create index idx_oauth_metrics_success on public.oauth_metrics (success, created_at);

-- RLS for metrics
alter table public.oauth_metrics enable row level security;

create policy "Service role can manage oauth metrics"
  on public.oauth_metrics
  for all
  to service_role
  using (true)
  with check (true);

-- View for OAuth analytics
create or replace view public.oauth_analytics as
select 
  provider,
  action,
  date_trunc('hour', created_at) as hour,
  count(*) as total_attempts,
  count(*) filter (where success = true) as successful_attempts,
  count(*) filter (where success = false) as failed_attempts,
  round(100.0 * count(*) filter (where success = true) / count(*), 2) as success_rate,
  avg(duration_ms) filter (where success = true) as avg_success_duration_ms,
  percentile_cont(0.5) within group (order by duration_ms) filter (where success = true) as median_duration_ms,
  percentile_cont(0.95) within group (order by duration_ms) filter (where success = true) as p95_duration_ms
from public.oauth_metrics
where created_at > now() - interval '7 days'
group by provider, action, hour
order by hour desc, provider, action;

-- Grant access to the analytics view
grant select on public.oauth_analytics to authenticated;

-- Schedule cleanup job (requires pg_cron extension)
-- Run cleanup every hour
-- select cron.schedule(
--   'cleanup-oauth-sessions',
--   '0 * * * *',
--   'select public.cleanup_expired_oauth_sessions()'
-- );

comment on table public.oauth_sessions is 'Temporary storage for OAuth state during authentication flow';
comment on table public.user_oauth_tokens is 'Stores OAuth tokens for third-party provider access';
comment on table public.oauth_errors is 'Tracks OAuth errors for debugging and monitoring';
comment on table public.oauth_metrics is 'Performance metrics for OAuth operations';
comment on view public.oauth_analytics is 'Analytics dashboard for OAuth performance';