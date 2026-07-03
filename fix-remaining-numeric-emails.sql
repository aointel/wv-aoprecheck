-- Fix remaining numeric emails in weekly_usage_stats
-- First, check which records can be mapped and which can't

-- DIAGNOSTIC: Check which of these specific records can be mapped
SELECT 
  wus.id,
  wus.agent_email as numeric_email,
  wus.week_start_date,
  wus.vdp_total_minutes,
  wus.vdp_available_minutes,
  wus.vdp_call_minutes,
  CAST(SPLIT_PART(wus.agent_email, '@', 1) AS INTEGER) as associate_id,
  COALESCE(
    LOWER(TRIM(c.company_email)),
    LOWER(TRIM(c.personal_email))
  ) as real_email,
  CASE 
    WHEN c.associate_id IS NULL THEN 'NO_CUSTOMER_RECORD'
    WHEN COALESCE(LOWER(TRIM(c.company_email)), LOWER(TRIM(c.personal_email))) IS NULL THEN 'NO_EMAIL_IN_CUSTOMER'
    ELSE 'CAN_MAP'
  END as mapping_status
FROM weekly_usage_stats wus
LEFT JOIN customers c ON (
  CAST(SPLIT_PART(wus.agent_email, '@', 1) AS INTEGER) = c.associate_id
)
WHERE 
  wus.id IN (
    17701558, 17701547, 72420, 77945, 17701546, 73367, 17701555, 74995, 
    17701542, 78269, 72944, 76171, 76999, 78701, 72193, 72233, 76569, 
    72684, 72680, 72496, 81512, 72577, 72162, 72807, 72592, 72394, 72846, 
    74123, 74068, 73232, 74271, 77039, 75413, 79360, 77825, 17701539, 
    77676, 76152, 74367, 79332, 74721
  )
  AND SPLIT_PART(wus.agent_email, '@', 1) ~ '^[0-9]+$'
ORDER BY mapping_status, wus.agent_email;

-- ============================================
-- FIX RECORDS THAT CAN BE MAPPED
-- ============================================

-- Step 1: Merge stats for records where real email already exists
WITH email_mapping AS (
  SELECT DISTINCT
    wus.id as numeric_record_id,
    wus.agent_email as numeric_email,
    wus.week_start_date,
    COALESCE(
      LOWER(TRIM(c.company_email)),
      LOWER(TRIM(c.personal_email))
    ) as real_email
  FROM weekly_usage_stats wus
  INNER JOIN customers c ON (
    CAST(SPLIT_PART(wus.agent_email, '@', 1) AS INTEGER) = c.associate_id
  )
  WHERE 
    wus.id IN (
      17701558, 17701547, 72420, 77945, 17701546, 73367, 17701555, 74995, 
      17701542, 78269, 72944, 76171, 76999, 78701, 72193, 72233, 76569, 
      72684, 72680, 72496, 81512, 72577, 72162, 72807, 72592, 72394, 72846, 
      74123, 74068, 73232, 74271, 77039, 75413, 79360, 77825, 17701539, 
      77676, 76152, 74367, 79332, 74721
    )
    AND SPLIT_PART(wus.agent_email, '@', 1) ~ '^[0-9]+$'
    AND CAST(SPLIT_PART(wus.agent_email, '@', 1) AS INTEGER) > 0
    AND COALESCE(LOWER(TRIM(c.company_email)), LOWER(TRIM(c.personal_email))) IS NOT NULL
),
existing_real AS (
  SELECT 
    em.numeric_record_id,
    em.real_email,
    em.week_start_date,
    real_wus.id as real_record_id,
    real_wus.vdp_total_minutes as real_vdp_total,
    real_wus.vdp_available_minutes as real_vdp_available,
    real_wus.vdp_call_minutes as real_vdp_call,
    real_wus.total_online_minutes as real_online,
    numeric_wus.vdp_total_minutes as numeric_vdp_total,
    numeric_wus.vdp_available_minutes as numeric_vdp_available,
    numeric_wus.vdp_call_minutes as numeric_vdp_call,
    numeric_wus.total_online_minutes as numeric_online
  FROM email_mapping em
  INNER JOIN weekly_usage_stats real_wus ON (
    real_wus.agent_email = em.real_email
    AND real_wus.week_start_date = em.week_start_date
  )
  INNER JOIN weekly_usage_stats numeric_wus ON numeric_wus.id = em.numeric_record_id
)
UPDATE weekly_usage_stats wus
SET 
  vdp_total_minutes = GREATEST(
    COALESCE(er.real_vdp_total, 0),
    COALESCE(er.numeric_vdp_total, 0)
  ),
  vdp_available_minutes = GREATEST(
    COALESCE(er.real_vdp_available, 0),
    COALESCE(er.numeric_vdp_available, 0)
  ),
  vdp_call_minutes = GREATEST(
    COALESCE(er.real_vdp_call, 0),
    COALESCE(er.numeric_vdp_call, 0)
  ),
  total_online_minutes = GREATEST(
    COALESCE(er.real_online, 0),
    COALESCE(er.numeric_online, 0)
  ),
  updated_at = NOW()
FROM existing_real er
WHERE wus.id = er.real_record_id;

-- Step 2: Delete numeric records that were merged
DELETE FROM weekly_usage_stats
WHERE id IN (
  WITH email_mapping AS (
    SELECT DISTINCT
      wus.id as numeric_record_id,
      wus.agent_email as numeric_email,
      wus.week_start_date,
      COALESCE(
        LOWER(TRIM(c.company_email)),
        LOWER(TRIM(c.personal_email))
      ) as real_email
    FROM weekly_usage_stats wus
    INNER JOIN customers c ON (
      CAST(SPLIT_PART(wus.agent_email, '@', 1) AS INTEGER) = c.associate_id
    )
    WHERE 
      wus.id IN (
        17701558, 17701547, 72420, 77945, 17701546, 73367, 17701555, 74995, 
        17701542, 78269, 72944, 76171, 76999, 78701, 72193, 72233, 76569, 
        72684, 72680, 72496, 81512, 72577, 72162, 72807, 72592, 72394, 72846, 
        74123, 74068, 73232, 74271, 77039, 75413, 79360, 77825, 17701539, 
        77676, 76152, 74367, 79332, 74721
      )
      AND SPLIT_PART(wus.agent_email, '@', 1) ~ '^[0-9]+$'
      AND COALESCE(LOWER(TRIM(c.company_email)), LOWER(TRIM(c.personal_email))) IS NOT NULL
  )
  SELECT em.numeric_record_id
  FROM email_mapping em
  INNER JOIN weekly_usage_stats real_wus ON (
    real_wus.agent_email = em.real_email
    AND real_wus.week_start_date = em.week_start_date
  )
);

-- Step 3: Update numeric emails to real emails where no real email record exists
UPDATE weekly_usage_stats wus
SET 
  agent_email = em.real_email,
  updated_at = NOW()
FROM (
  SELECT DISTINCT
    wus.id as numeric_record_id,
    wus.agent_email as numeric_email,
    wus.week_start_date,
    COALESCE(
      LOWER(TRIM(c.company_email)),
      LOWER(TRIM(c.personal_email))
    ) as real_email
  FROM weekly_usage_stats wus
  INNER JOIN customers c ON (
    CAST(SPLIT_PART(wus.agent_email, '@', 1) AS INTEGER) = c.associate_id
  )
  WHERE 
    wus.id IN (
      17701558, 17701547, 72420, 77945, 17701546, 73367, 17701555, 74995, 
      17701542, 78269, 72944, 76171, 76999, 78701, 72193, 72233, 76569, 
      72684, 72680, 72496, 81512, 72577, 72162, 72807, 72592, 72394, 72846, 
      74123, 74068, 73232, 74271, 77039, 75413, 79360, 77825, 17701539, 
      77676, 76152, 74367, 79332, 74721
    )
    AND SPLIT_PART(wus.agent_email, '@', 1) ~ '^[0-9]+$'
    AND CAST(SPLIT_PART(wus.agent_email, '@', 1) AS INTEGER) > 0
    AND COALESCE(LOWER(TRIM(c.company_email)), LOWER(TRIM(c.personal_email))) IS NOT NULL
    AND COALESCE(LOWER(TRIM(c.company_email)), LOWER(TRIM(c.personal_email))) != LOWER(TRIM(wus.agent_email))
    -- Only update if no real email record exists for this week
    AND NOT EXISTS (
      SELECT 1
      FROM weekly_usage_stats real_wus
      WHERE real_wus.agent_email = COALESCE(
        LOWER(TRIM(c.company_email)),
        LOWER(TRIM(c.personal_email))
      )
      AND real_wus.week_start_date = wus.week_start_date
    )
) em
WHERE wus.id = em.numeric_record_id;

-- ============================================
-- HANDLE RECORDS THAT CAN'T BE MAPPED
-- ============================================

-- Option 1: Delete records with invalid/missing associate IDs
-- (Uncomment if you want to delete these)
/*
DELETE FROM weekly_usage_stats
WHERE id IN (
  SELECT wus.id
  FROM weekly_usage_stats wus
  LEFT JOIN customers c ON (
    CAST(SPLIT_PART(wus.agent_email, '@', 1) AS INTEGER) = c.associate_id
  )
  WHERE 
    wus.id IN (
      17701558, 17701547, 72420, 77945, 17701546, 73367, 17701555, 74995, 
      17701542, 78269, 72944, 76171, 76999, 78701, 72193, 72233, 76569, 
      72684, 72680, 72496, 81512, 72577, 72162, 72807, 72592, 72394, 72846, 
      74123, 74068, 73232, 74271, 77039, 75413, 79360, 77825, 17701539, 
      77676, 76152, 74367, 79332, 74721
    )
    AND SPLIT_PART(wus.agent_email, '@', 1) ~ '^[0-9]+$'
    AND (c.associate_id IS NULL OR COALESCE(LOWER(TRIM(c.company_email)), LOWER(TRIM(c.personal_email))) IS NULL)
);
*/

-- Final verification: Check remaining numeric emails from these IDs
SELECT 
  wus.id,
  wus.agent_email,
  wus.week_start_date,
  wus.vdp_total_minutes,
  CAST(SPLIT_PART(wus.agent_email, '@', 1) AS INTEGER) as associate_id,
  CASE 
    WHEN c.associate_id IS NULL THEN 'STILL_NO_CUSTOMER'
    WHEN COALESCE(LOWER(TRIM(c.company_email)), LOWER(TRIM(c.personal_email))) IS NULL THEN 'STILL_NO_EMAIL'
    ELSE 'FIXED'
  END as status
FROM weekly_usage_stats wus
LEFT JOIN customers c ON (
  CAST(SPLIT_PART(wus.agent_email, '@', 1) AS INTEGER) = c.associate_id
)
WHERE 
  wus.id IN (
    17701558, 17701547, 72420, 77945, 17701546, 73367, 17701555, 74995, 
    17701542, 78269, 72944, 76171, 76999, 78701, 72193, 72233, 76569, 
    72684, 72680, 72496, 81512, 72577, 72162, 72807, 72592, 72394, 72846, 
    74123, 74068, 73232, 74271, 77039, 75413, 79360, 77825, 17701539, 
    77676, 76152, 74367, 79332, 74721
  )
ORDER BY status, wus.agent_email;
