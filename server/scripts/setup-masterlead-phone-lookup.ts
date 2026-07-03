/**
 * Create get_masterlead_cn_email_by_phones RPC for normalized phone → cn_email lookup.
 * Run: npx tsx server/scripts/setup-masterlead-phone-lookup.ts
 * Or run database/get-masterlead-cn-email-by-phones.sql in Supabase SQL Editor.
 */

import { supabaseAdmin } from '../supabase';

const SQL = `
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
      right(regexp_replace(coalesce(ml.phone, ''), '[^0-9]', '', 'g'), 10) AS norm_phone,
      nullif(trim(lower(ml.cn_email)), '') AS cn_email,
      trim(ml.first_name || ' ' || ml.last_name) AS lead_name,
      ml.taalk_market,
      ml.updated_at,
      CASE WHEN b.e IS NOT NULL THEN 1 ELSE 0 END AS is_bad,
      CASE WHEN lower(trim(ml.cn_email)) = 'michaelmandella@aoglobelife.com' THEN 1 ELSE 0 END AS is_michael
    FROM masterlead ml
    LEFT JOIN bad b ON lower(trim(ml.cn_email)) = b.e
    WHERE length(regexp_replace(coalesce(ml.phone, ''), '[^0-9]', '', 'g')) >= 10
      AND right(regexp_replace(coalesce(ml.phone, ''), '[^0-9]', '', 'g'), 10) = ANY(phone_arr)
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
`;

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin not configured');
    process.exit(1);
  }
  const { error } = await supabaseAdmin.rpc('exec_sql', { sql: SQL });
  if (error) {
    console.error('❌ Failed. Run database/get-masterlead-cn-email-by-phones.sql in Supabase SQL Editor:', error);
    process.exit(1);
  }
  console.log('✅ get_masterlead_cn_email_by_phones function created');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
