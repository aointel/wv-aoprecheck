-- Look up a single masterlead row by caller phone (last 10 digits, normalized).
-- Use for 609 /incomingcall so "(123) 456-7890" and "+1 123 456 7890" both match.
-- Run in Supabase SQL Editor, or via: npx tsx server/scripts/setup-masterlead-by-phone-last10.ts

CREATE OR REPLACE FUNCTION get_masterlead_by_phone_last10(last10 text)
RETURNS TABLE(
  id int,
  state text,
  taalk_state text,
  taalk_market text,
  first_name text,
  last_name text,
  taalk_lead_id text,
  email text,
  cn_email text,
  city text,
  taalk_city text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ml.id,
    ml.state,
    ml.taalk_state,
    ml.taalk_market,
    ml.first_name,
    ml.last_name,
    ml.taalk_lead_id,
    ml.email,
    ml.cn_email,
    ml.city,
    ml.taalk_city
  FROM masterlead ml
  WHERE length(regexp_replace(coalesce(ml.phone, ''), '[^0-9]', '', 'g')) >= 10
    AND right(regexp_replace(coalesce(ml.phone, ''), '[^0-9]', '', 'g'), 10) = trim(last10)
  ORDER BY ml.updated_at DESC NULLS LAST
  LIMIT 1;
$$;
