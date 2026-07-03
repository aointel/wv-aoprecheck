-- CALL LOG: one row per call attempt, no billing fields.
-- Telemetry only - tracks calls and presentations for reporting/analytics

create table if not exists call_log (
  id bigserial primary key,
  lead_id bigint not null,
  agent_email text not null,
  taalk_market text,
  is_plus_lead boolean,
  call_sid text,
  direction text not null,          -- 'outbound' | 'inbound' | 'vdp' | 'meet'
  source text not null,             -- 'dialer' | 'vdp' | 'meet' | 'manual' | 'hotlead'
  started_at timestamptz not null,
  connected_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  talk_seconds int,
  call_status text not null,        -- 'started' | 'completed' | 'no_answer' | 'busy' | 'failed'...
  reached boolean,
  disposition text,
  notes text,
  connect_id text,
  meeting_id text,
  created_at timestamptz default now()
);

create index if not exists idx_call_log_agent_date
  on call_log (agent_email, started_at);

create index if not exists idx_call_log_lead_date
  on call_log (lead_id, started_at);

create index if not exists idx_call_log_plus_lead
  on call_log (is_plus_lead);

create index if not exists idx_call_log_source
  on call_log (source);

create index if not exists idx_call_log_call_sid
  on call_log (call_sid);

-- PRESENTATION LOG: one row per presentation / meet session.
create table if not exists presentation_log (
  id bigserial primary key,
  lead_id bigint not null,
  agent_email text not null,
  taalk_market text,
  is_plus_lead boolean,
  meeting_id text,
  source text not null,              -- 'meet' | 'in_person' | 'phone_presentation'
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds int,
  presentation_status text not null, -- 'completed' | 'no_show' | 'cancelled' | 'reschedule'
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_presentation_log_agent_date
  on presentation_log (agent_email, started_at);

create index if not exists idx_presentation_log_lead_date
  on presentation_log (lead_id, started_at);

create index if not exists idx_presentation_log_meeting_id
  on presentation_log (meeting_id);




