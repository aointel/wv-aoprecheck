-- Run in Supabase SQL editor if hppro_presentations is missing or has no raw_payload.
-- Full fresh schema: see hppro_tables.sql

ALTER TABLE IF EXISTS public.hppro_presentations
  ADD COLUMN IF NOT EXISTS raw_payload JSONB;

-- If the table does not exist at all, run the full script:
--   server/sql/hppro_tables.sql
