-- Fix SQL Functions - Recreate with correct syntax
-- Run this to fix the "COUNT(DISTINCT lead_phone)" syntax error

-- First, drop the existing functions to ensure clean recreation
DROP FUNCTION IF EXISTS update_live_call_boardt_stats_from_metrics() CASCADE;
DROP FUNCTION IF EXISTS update_live_call_boardt_recruit_stats_all() CASCADE;
DROP FUNCTION IF EXISTS update_live_call_boardt_recruit_connects() CASCADE;
DROP FUNCTION IF EXISTS backfill_live_call_boardt_stats_corrected() CASCADE;

-- Now run the full function definitions from the original files
-- This will recreate them with the correct syntax

\i update-live-call-board-from-agent-dial-metrics.sql
\i update-live-call-boardt-recruit-from-metrics.sql

-- Verify functions were created
SELECT 
  routine_name, 
  routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'update_live_call_boardt_stats_from_metrics',
    'update_live_call_boardt_recruit_stats_all',
    'update_live_call_boardt_recruit_connects',
    'backfill_live_call_boardt_stats_corrected'
  )
ORDER BY routine_name;
