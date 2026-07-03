-- Run in Supabase → SQL Editor (as postgres / owner)
-- Only if you still use RLS on this table and want it off (skip if RLS is already off).
-- Option A — turn RLS off for this table
ALTER TABLE IF EXISTS public.masterlead_recruit DISABLE ROW LEVEL SECURITY;

-- If the table might not exist yet, create it first (adjust columns to match your schema):
-- CREATE TABLE IF NOT EXISTS public.masterlead_recruit (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   created_at timestamptz DEFAULT now(),
--   email text,
--   firstname text,
--   first_name text,
--   lastname text,
--   last_name text,
--   phone text,
--   source text,
--   state text
-- );
-- Then either disable RLS (Option A) or use Option B below.

-- Option B — keep RLS on but allow anon/service via policies (use if you refuse to disable RLS)
-- ALTER TABLE public.masterlead_recruit ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "allow_all_masterlead_recruit"
--   ON public.masterlead_recruit
--   FOR ALL
--   USING (true)
--   WITH CHECK (true);

-- Note: API calls using SUPABASE_SERVICE_ROLE_KEY use the service role JWT (bypasses RLS when enabled).
-- If rows still don’t appear: wrong Supabase URL/project, wrong table name, or column mismatch — check upload API supabaseDebug in the UI.
