-- One-time migration if `daily_quality_ratings` still has a single `rating` column (Supabase SQL editor).
alter table public.daily_quality_ratings
  add column if not exists connection_quality smallint,
  add column if not exists application_speed smallint,
  add column if not exists platform_satisfaction smallint;

update public.daily_quality_ratings
set
  connection_quality = coalesce(connection_quality, rating),
  application_speed = coalesce(application_speed, rating),
  platform_satisfaction = coalesce(platform_satisfaction, rating)
where rating is not null;

alter table public.daily_quality_ratings drop column if exists rating;

alter table public.daily_quality_ratings
  alter column connection_quality set not null,
  alter column application_speed set not null,
  alter column platform_satisfaction set not null;
