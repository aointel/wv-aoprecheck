-- Backfill ccpro_enabled flag in agent_live_call_status table
-- Updates all existing records based on connectnow_subscriptions

-- Update ccpro_enabled = true for agents with professional/elite active/trialing subscriptions
UPDATE agent_live_call_status als
SET ccpro_enabled = true
FROM connectnow_subscriptions cs
WHERE als.agent_email = cs.user_email
  AND (cs.status = 'active' OR cs.status = 'trialing')
  AND (cs.plan = 'professional' OR cs.plan = 'elite');

-- Update ccpro_enabled = false for all other agents (starter plan or inactive subscriptions)
UPDATE agent_live_call_status als
SET ccpro_enabled = false
WHERE NOT EXISTS (
  SELECT 1
  FROM connectnow_subscriptions cs
  WHERE als.agent_email = cs.user_email
    AND (cs.status = 'active' OR cs.status = 'trialing')
    AND (cs.plan = 'professional' OR cs.plan = 'elite')
);

-- Show summary
SELECT 
  'CCPRO Enabled' as status,
  COUNT(*) as count
FROM agent_live_call_status
WHERE ccpro_enabled = true

UNION ALL

SELECT 
  'CCPRO Disabled' as status,
  COUNT(*) as count
FROM agent_live_call_status
WHERE ccpro_enabled = false;

-- Show detailed breakdown
SELECT 
  als.agent_email,
  als.status,
  als.ccpro_enabled,
  cs.plan,
  cs.status as subscription_status,
  CASE 
    WHEN (cs.status = 'active' OR cs.status = 'trialing') 
         AND (cs.plan = 'professional' OR cs.plan = 'elite') 
    THEN 'Should be TRUE'
    ELSE 'Should be FALSE'
  END as expected_ccpro
FROM agent_live_call_status als
LEFT JOIN connectnow_subscriptions cs ON als.agent_email = cs.user_email
ORDER BY als.agent_email;

