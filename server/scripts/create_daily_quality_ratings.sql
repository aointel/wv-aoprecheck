-- Run in Supabase SQL editor. ConnectNow daily check-in (3 dimensions, not lead quality).
create table if not exists public.daily_quality_ratings (
  id uuid primary key default gen_random_uuid(),
  agent_email text not null,
  connection_quality smallint not null check (connection_quality >= 1 and connection_quality <= 5),
  application_speed smallint not null check (application_speed >= 1 and application_speed <= 5),
  platform_satisfaction smallint not null check (platform_satisfaction >= 1 and platform_satisfaction <= 5),
  comment text,
  rated_date date not null,
  path text,
  created_at timestamptz not null default now(),
  unique (agent_email, rated_date)
);

create index if not exists daily_quality_ratings_rated_date_idx on public.daily_quality_ratings (rated_date desc);
create index if not exists daily_quality_ratings_agent_email_idx on public.daily_quality_ratings (agent_email);

alter table public.daily_quality_ratings enable row level security;
