-- DIAGNOSTIC: Check why live_call_boardt is not updating
-- Run this in Supabase SQL Editor to diagnose the issue

-- Step 1: Check if triggers exist
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'agent_dial_metrics'
  AND trigger_name LIKE '%live_call_board%'
ORDER BY trigger_name;

-- Step 2: Check if the trigger function exists
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_name LIKE '%live_call_board%'
ORDER BY routine_name;

-- Step 3: Check if update functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'update_live_call_boardt_stats_for_agent',
  'update_live_call_boardt_stats_from_metrics',
  'trigger_update_live_call_boardt_on_metric',
  'get_today_est_range'
)
ORDER BY routine_name;

-- Step 4: Test the trigger function manually
-- Replace 'test@example.com' with a real agent email
SELECT update_live_call_boardt_stats_for_agent('test@example.com');

-- Step 5: Check recent agent_dial_metrics inserts (last 10)
SELECT 
  id,
  agent_email,
  event_type,
  lead_phone,
  event_timestamp,
  created_at
FROM agent_dial_metrics
ORDER BY created_at DESC
LIMIT 10;

-- Step 6: Check if live_call_boardt has recent updates
SELECT 
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  updated_at
FROM live_call_boardt
ORDER BY updated_at DESC
LIMIT 10;

-- Step 7: Check if triggers are enabled
SELECT 
  tgname as trigger_name,
  tgenabled as enabled,
  CASE tgenabled
    WHEN 'O' THEN 'ENABLED'
    WHEN 'D' THEN 'DISABLED'
    WHEN 'R' THEN 'REPLICA'
    WHEN 'A' THEN 'ALWAYS'
    ELSE 'UNKNOWN'
  END as status
FROM pg_trigger
WHERE tgrelid = 'agent_dial_metrics'::regclass
  AND tgname LIKE '%live_call_board%';

-- Step 8: Manually test inserting a metric and see if trigger fires
-- (This will create a test record - you can delete it after)
/*
INSERT INTO agent_dial_metrics (
  agent_email,
  lead_phone,
  event_type,
  event_timestamp,
  source
) VALUES (
  'test@example.com',
  '1234567890',
  'dial',
  now(),
  'test'
);

-- Check if live_call_boardt was updated
SELECT * FROM live_call_boardt WHERE agent_email = 'test@example.com';

-- Clean up test data
DELETE FROM agent_dial_metrics WHERE agent_email = 'test@example.com' AND source = 'test';
DELETE FROM live_call_boardt WHERE agent_email = 'test@example.com';
*/


