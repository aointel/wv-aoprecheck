-- TEST: Verify agent_live_call_status table updates
-- Run these queries to check if CCPro is updating Supabase correctly

-- ============================================
-- 1. CHECK IF TABLE EXISTS AND STRUCTURE
-- ============================================
SELECT 
  'Table Structure Check' as test_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'agent_live_call_status'
ORDER BY ordinal_position;

-- ============================================
-- 2. CHECK ALL CURRENT RECORDS IN TABLE
-- ============================================
SELECT 
  'Current Records' as test_name,
  agent_email,
  status,
  last_heartbeat_at,
  updated_at,
  EXTRACT(EPOCH FROM (now() - last_heartbeat_at)) / 60 as minutes_since_heartbeat
FROM agent_live_call_status
ORDER BY updated_at DESC;

-- ============================================
-- 3. CHECK AGENTS WITH CCPRO ACCESS
-- ============================================
SELECT 
  'Agents with CCPRO Access' as test_name,
  company_email,
  personal_email,
  CCPRO,
  CASE 
    WHEN company_email IS NOT NULL THEN company_email
    WHEN personal_email IS NOT NULL THEN personal_email
    ELSE NULL
  END as primary_email
FROM customers
WHERE CCPRO = true
ORDER BY company_email, personal_email;

-- ============================================
-- 4. COMPARE: CCPRO AGENTS vs agent_live_call_status
-- ============================================
SELECT 
  'CCPRO Agents vs Status Table' as test_name,
  COALESCE(c.company_email, c.personal_email) as agent_email,
  c.CCPRO,
  als.status,
  als.last_heartbeat_at,
  als.updated_at,
  CASE 
    WHEN als.agent_email IS NULL THEN '❌ NOT IN STATUS TABLE'
    WHEN EXTRACT(EPOCH FROM (now() - als.last_heartbeat_at)) / 60 > 5 THEN '⚠️ STALE (>5 min)'
    ELSE '✅ ACTIVE'
  END as status_check
FROM customers c
LEFT JOIN agent_live_call_status als ON (
  als.agent_email = c.company_email OR als.agent_email = c.personal_email
)
WHERE c.CCPRO = true
ORDER BY als.last_heartbeat_at DESC NULLS LAST;

-- ============================================
-- 5. CHECK RECENT UPDATES (LAST 10 MINUTES)
-- ============================================
SELECT 
  'Recent Updates (Last 10 min)' as test_name,
  agent_email,
  status,
  last_heartbeat_at,
  updated_at,
  EXTRACT(EPOCH FROM (now() - updated_at)) / 60 as minutes_ago
FROM agent_live_call_status
WHERE updated_at > now() - INTERVAL '10 minutes'
ORDER BY updated_at DESC;

-- ============================================
-- 6. CHECK AGENTS WITHOUT CCPRO BUT IN STATUS TABLE
-- ============================================
SELECT 
  'Agents WITHOUT CCPRO but IN status table' as test_name,
  als.agent_email,
  als.status,
  als.last_heartbeat_at,
  c.CCPRO,
  CASE 
    WHEN c.agent_email IS NULL THEN '❌ NOT IN CUSTOMERS TABLE'
    WHEN c.CCPRO = false THEN '❌ CCPRO = false'
    WHEN c.CCPRO IS NULL THEN '❌ CCPRO IS NULL'
    ELSE 'UNKNOWN'
  END as issue
FROM agent_live_call_status als
LEFT JOIN customers c ON (
  c.company_email = als.agent_email OR c.personal_email = als.agent_email
)
WHERE c.CCPRO IS NOT TRUE
ORDER BY als.updated_at DESC;

-- ============================================
-- 7. MONITOR REAL-TIME (Run this repeatedly)
-- ============================================
-- Run this query every few seconds to watch for updates
SELECT 
  agent_email,
  status,
  last_heartbeat_at,
  updated_at,
  now() as current_time,
  EXTRACT(EPOCH FROM (now() - updated_at)) as seconds_since_update
FROM agent_live_call_status
ORDER BY updated_at DESC
LIMIT 20;

