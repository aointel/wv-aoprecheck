-- Look up agent_dial_metrics by normalized phone (last 10 digits).
-- Fixes ilike matching: "555-123-4567" does NOT match ilike '%5551234567%'.
-- Returns agent_email, agent_name, lead_name for each phone. Most recent event wins.
-- Run in Supabase SQL Editor. Required for call-transfers sync/update/backfill.

CREATE OR REPLACE FUNCTION get_agent_dial_metrics_by_phones(phone_arr text[])
RETURNS TABLE(
  norm_phone text,
  agent_email text,
  agent_name text,
  lead_name text
)
LANGUAGE sql
STABLE
AS $$
  WITH bad AS (
    SELECT unnest(ARRAY['unknown@aoglobelife.com','system@aoglobelife.com','unknown','cnsysop@aoglobelife.com']) AS e
  ),
  adm_norm AS (
    SELECT
      right(regexp_replace(coalesce(adm.lead_phone, ''), '[^0-9]', '', 'g'), 10) AS norm_phone,
      nullif(trim(lower(adm.agent_email)), '') AS agent_email,
      trim(adm.agent_name) AS agent_name,
      trim(adm.lead_name) AS lead_name,
      adm.event_timestamp,
      CASE WHEN b.e IS NOT NULL THEN 1 ELSE 0 END AS is_bad
    FROM agent_dial_metrics adm
    LEFT JOIN bad b ON lower(trim(adm.agent_email)) = b.e
    WHERE length(regexp_replace(coalesce(adm.lead_phone, ''), '[^0-9]', '', 'g')) >= 10
      AND right(regexp_replace(coalesce(adm.lead_phone, ''), '[^0-9]', '', 'g'), 10) = ANY(phone_arr)
      AND adm.agent_email IS NOT NULL
      AND trim(adm.agent_email) != ''
      AND adm.agent_email LIKE '%@%'
      AND (b.e IS NULL)
  ),
  ranked AS (
    SELECT
      norm_phone,
      agent_email,
      agent_name,
      lead_name,
      row_number() OVER (PARTITION BY norm_phone ORDER BY event_timestamp DESC NULLS LAST) AS rn
    FROM adm_norm
  )
  SELECT r.norm_phone, r.agent_email, r.agent_name, r.lead_name
  FROM ranked r
  WHERE r.rn = 1;
$$;
