-- Fix numeric emails in weekly_usage_stats table
-- Maps numeric emails (e.g., 103021@aoglobelife.com) to real emails from customers table
-- Handles merging stats when real email record already exists

-- Step 1: Create a mapping of numeric emails to real emails
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
    -- Only process numeric emails (email prefix is all digits)
    SPLIT_PART(wus.agent_email, '@', 1) ~ '^[0-9]+$'
    AND CAST(SPLIT_PART(wus.agent_email, '@', 1) AS INTEGER) > 0
    AND COALESCE(LOWER(TRIM(c.company_email)), LOWER(TRIM(c.personal_email))) IS NOT NULL
    AND COALESCE(LOWER(TRIM(c.company_email)), LOWER(TRIM(c.personal_email))) != LOWER(TRIM(wus.agent_email))
),
-- Step 2: Find cases where real email record already exists for the same week
existing_real_records AS (
  SELECT 
    em.numeric_record_id,
    em.numeric_email,
    em.real_email,
    em.week_start_date,
    real_wus.id as real_record_id,
    real_wus.vdp_total_minutes as real_vdp_total,
    real_wus.vdp_available_minutes as real_vdp_available,
    real_wus.vdp_call_minutes as real_vdp_call,
    real_wus.total_online_minutes as real_online
  FROM email_mapping em
  INNER JOIN weekly_usage_stats real_wus ON (
    real_wus.agent_email = em.real_email
    AND real_wus.week_start_date = em.week_start_date
  )
),
-- Step 3: Get numeric record stats for merging
numeric_record_stats AS (
  SELECT 
    err.numeric_record_id,
    err.real_record_id,
    err.numeric_email,
    err.real_email,
    err.week_start_date,
    err.real_vdp_total,
    err.real_vdp_available,
    err.real_vdp_call,
    err.real_online,
    numeric_wus.vdp_total_minutes as numeric_vdp_total,
    numeric_wus.vdp_available_minutes as numeric_vdp_available,
    numeric_wus.vdp_call_minutes as numeric_vdp_call,
    numeric_wus.total_online_minutes as numeric_online
  FROM existing_real_records err
  INNER JOIN weekly_usage_stats numeric_wus ON numeric_wus.id = err.numeric_record_id
)

-- Step 4: Update real email records with merged stats (take max values)
UPDATE weekly_usage_stats wus
SET 
  vdp_total_minutes = GREATEST(
    COALESCE(nrs.real_vdp_total, 0),
    COALESCE(nrs.numeric_vdp_total, 0)
  ),
  vdp_available_minutes = GREATEST(
    COALESCE(nrs.real_vdp_available, 0),
    COALESCE(nrs.numeric_vdp_available, 0)
  ),
  vdp_call_minutes = GREATEST(
    COALESCE(nrs.real_vdp_call, 0),
    COALESCE(nrs.numeric_vdp_call, 0)
  ),
  total_online_minutes = GREATEST(
    COALESCE(nrs.real_online, 0),
    COALESCE(nrs.numeric_online, 0)
  ),
  updated_at = NOW()
FROM numeric_record_stats nrs
WHERE wus.id = nrs.real_record_id;

-- Step 5: Delete numeric email records that were merged
DELETE FROM weekly_usage_stats
WHERE id IN (
  SELECT numeric_record_id
  FROM (
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
        SPLIT_PART(wus.agent_email, '@', 1) ~ '^[0-9]+$'
        AND CAST(SPLIT_PART(wus.agent_email, '@', 1) AS INTEGER) > 0
        AND COALESCE(LOWER(TRIM(c.company_email)), LOWER(TRIM(c.personal_email))) IS NOT NULL
    )
    SELECT em.numeric_record_id
    FROM email_mapping em
    INNER JOIN weekly_usage_stats real_wus ON (
      real_wus.agent_email = em.real_email
      AND real_wus.week_start_date = em.week_start_date
    )
  ) merged_records
);

-- Step 6: Update numeric emails to real emails where no real email record exists
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
    SPLIT_PART(wus.agent_email, '@', 1) ~ '^[0-9]+$'
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

-- Verification query: Check remaining numeric emails
SELECT 
  agent_email,
  week_start_date,
  COUNT(*) as record_count
FROM weekly_usage_stats
WHERE SPLIT_PART(agent_email, '@', 1) ~ '^[0-9]+$'
  AND CAST(SPLIT_PART(agent_email, '@', 1) AS INTEGER) > 0
GROUP BY agent_email, week_start_date
ORDER BY agent_email, week_start_date;
