-- Look up masterlead.cn_email by normalized phone (last 10 digits).
-- Fixes ilike matching: "555-123-4567" does NOT match ilike '%5551234567%'.
-- Use right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) for reliable matching.

CREATE OR REPLACE FUNCTION get_masterlead_cn_email_by_phones(phone_arr text[])
RETURNS TABLE(norm_phone text, cn_email text, lead_name text, taalk_market text)
LANGUAGE sql
STABLE
AS $$
  WITH bad AS (
    SELECT unnest(ARRAY['unknown@aoglobelife.com','system@aoglobelife.com','unknown','cnsysop@aoglobelife.com']) AS e
  ),
  ml_norm AS (
    SELECT
      right(regexp_replace(coalesce(ml.phone, ml.phone_number, ''), '[^0-9]', '', 'g'), 10) AS norm_phone,
      nullif(trim(lower(ml.cn_email)), '') AS cn_email,
      trim(ml.first_name || ' ' || ml.last_name) AS lead_name,
      ml.taalk_market,
      ml.updated_at,
      CASE WHEN b.e IS NOT NULL THEN 1 ELSE 0 END AS is_bad,
      CASE WHEN lower(trim(ml.cn_email)) = 'michaelmandella@aoglobelife.com' THEN 1 ELSE 0 END AS is_michael
    FROM masterlead ml
    LEFT JOIN bad b ON lower(trim(ml.cn_email)) = b.e
    WHERE length(regexp_replace(coalesce(ml.phone, ml.phone_number, ''), '[^0-9]', '', 'g')) >= 10
      AND right(regexp_replace(coalesce(ml.phone, ml.phone_number, ''), '[^0-9]', '', 'g'), 10) = ANY(phone_arr)
      AND ml.cn_email IS NOT NULL
      AND trim(ml.cn_email) != ''
      AND ml.cn_email LIKE '%@%'
  ),
  ranked AS (
    SELECT
      norm_phone,
      cn_email,
      lead_name,
      taalk_market,
      row_number() OVER (
        PARTITION BY norm_phone
        ORDER BY is_bad ASC, is_michael ASC, updated_at DESC NULLS LAST
      ) AS rn
    FROM ml_norm
  )
  SELECT r.norm_phone, r.cn_email, r.lead_name, r.taalk_market
  FROM ranked r
  WHERE r.rn = 1;
$$;
