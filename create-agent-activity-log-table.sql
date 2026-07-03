-- AGENT ACTIVITY LOG: tracks activity states (active, idle, away, on_call, etc.)
-- Telemetry only - tracks agent activity for reporting/analytics
-- Focuses on WHAT agents are doing, not just login/logout

create table if not exists agent_activity_log (
  id bigserial primary key,
  agent_email text not null,
  activity_type text not null,        -- 'active' | 'idle' | 'away' | 'on_call' | 'on_presentation' | 'browsing'
  session_id text,                     -- Unique session identifier
  page_path text,                      -- What page/feature they're on
  feature text,                        -- What feature they're using (dialer, precheck, meet, etc.)
  started_at timestamptz not null,
  ended_at timestamptz,                -- When activity state changed
  duration_seconds int,                 -- Calculated duration in this state
  metadata jsonb,                      -- Additional context (lead_id, call_sid, etc.)
  created_at timestamptz default now()
);

create index if not exists idx_agent_activity_agent_date
  on agent_activity_log (agent_email, started_at);

create index if not exists idx_agent_activity_type
  on agent_activity_log (activity_type);

create index if not exists idx_agent_activity_session
  on agent_activity_log (session_id);

create index if not exists idx_agent_activity_active
  on agent_activity_log (agent_email, activity_type, started_at)
  where activity_type IN ('active', 'on_call', 'on_presentation');

-- AGENT SESSIONS: tracks current activity state (real-time status)
-- One row per agent session, updated continuously as they use the system
create table if not exists agent_sessions (
  id bigserial primary key,
  agent_email text not null,
  session_id text not null unique,
  current_status text not null default 'active',  -- 'active' | 'idle' | 'away' | 'on_call' | 'on_presentation'
  current_page text,                              -- Current page/route
  current_feature text,                            -- Current feature (dialer, precheck, meet, etc.)
  last_activity_at timestamptz not null,          -- Last time agent was active (mouse/keyboard)
  last_heartbeat_at timestamptz not null,         -- Last heartbeat received
  total_active_seconds int default 0,             -- Total active time (excluding idle)
  total_idle_seconds int default 0,               -- Total idle time
  total_call_seconds int default 0,                -- Total time on calls
  total_presentation_seconds int default 0,      -- Total time in presentations
  metadata jsonb,                                  -- Additional context (current_lead_id, etc.)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_agent_sessions_agent
  on agent_sessions (agent_email, updated_at);

create index if not exists idx_agent_sessions_active
  on agent_sessions (agent_email, current_status, last_activity_at)
  where current_status IN ('active', 'on_call', 'on_presentation');

create index if not exists idx_agent_sessions_session_id
  on agent_sessions (session_id);

create index if not exists idx_agent_sessions_heartbeat
  on agent_sessions (last_heartbeat_at)
  where current_status IN ('active', 'idle', 'on_call', 'on_presentation');

