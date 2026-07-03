-- Call Analytics: single Supabase view for transfer calls (twilio + csv)
-- Joins taalk_call_analytics + twilio_call_logs; recording_url only when Supabase.
-- CRITICAL: View filters to last 7 days - unbounded scans 23M+ rows. DISTINCT ON dedupes by taalk_call_id.
-- DROP required when changing column order/names (CREATE OR REPLACE treats position changes as renames).

DROP VIEW IF EXISTS call_analytics_transfers;

CREATE VIEW call_analytics_transfers AS
WITH norm AS (
  SELECT
    a.id,
    a.billing_transaction_id,
    a.agent_email,
    a.associate_id,
    a.call_date,
    a.taalk_call_id,
    a.recording_url AS a_recording_url,
    a.transcript,
    a.call_duration,
    a.call_score,
    a.analysis_status,
    a.analyzed_at,
    a.sentiment_label,
    a.call_outcome,
    a.outcome,
    a.ai_analysis,
    a.scorecard_results,
    a.coaching_notes,
    a.key_topics,
    a.objections_detected,
    a.sentiment_score,
    a.agent_talk_time_pct,
    a.client_engagement_level,
    a.call_outcome_confidence,
    a.compliance_flags,
    a.key_moments,
    t.to_number,
    t.owner_email,
    t.recording_url AS t_recording_url,
    t.parent_call_sid,
    p.recording_url AS p_recording_url,
    -- Normalize phone to 10 digits for masterlead match
    CASE
      WHEN length(regexp_replace(coalesce(t.to_number, ''), '[^0-9]', '', 'g')) >= 10
      THEN right(regexp_replace(t.to_number, '[^0-9]', '', 'g'), 10)
      ELSE regexp_replace(coalesce(t.to_number, ''), '[^0-9]', '', 'g')
    END AS phone_norm
  FROM taalk_call_analytics a
  LEFT JOIN twilio_call_logs t ON t.twilio_call_sid = a.taalk_call_id
  LEFT JOIN twilio_call_logs p ON p.twilio_call_sid = t.parent_call_sid
  WHERE (a.billing_transaction_id LIKE 'twilio-%' OR a.billing_transaction_id LIKE 'csv-%')
    AND a.call_date >= (NOW() - INTERVAL '7 days')::date
),
ml AS (
  -- Match masterlead by phone (last 10 digits). When multiple rows match, prefer: valid cn_email first, then most recently updated.
  SELECT DISTINCT ON (norm.id)
    norm.id,
    trim(ml.first_name || ' ' || ml.last_name) AS lead_name,
    ml.taalk_market AS market,
    nullif(trim(lower(ml.cn_email)), '') AS cn_email
  FROM norm
  JOIN masterlead ml ON (
    length(regexp_replace(coalesce(ml.phone, ''), '[^0-9]', '', 'g')) >= 10
    AND right(regexp_replace(coalesce(ml.phone, ''), '[^0-9]', '', 'g'), 10) = norm.phone_norm
  )
  ORDER BY norm.id,
    CASE WHEN nullif(trim(lower(ml.cn_email)), '') IS NOT NULL AND lower(ml.cn_email) NOT IN ('unknown@aoglobelife.com', 'system@aoglobelife.com', 'unknown') THEN 0 ELSE 1 END,
    ml.updated_at DESC NULLS LAST,
    ml.id DESC
),
producer AS (
  -- CRITICAL: Look up phone in masterlead to get cn_email (who owns the lead). owner_email from twilio is often wrong.
  SELECT
    norm.id,
    CASE
      WHEN ml.cn_email IS NOT NULL AND ml.cn_email NOT IN ('unknown@aoglobelife.com', 'system@aoglobelife.com', 'unknown') THEN ml.cn_email
      WHEN nullif(trim(norm.agent_email), '') IS NOT NULL AND norm.agent_email NOT IN ('unknown@aoglobelife.com', 'system@aoglobelife.com', 'unknown') THEN norm.agent_email
      WHEN nullif(trim(norm.owner_email), '') IS NOT NULL AND norm.owner_email NOT IN ('unknown@aoglobelife.com', 'system@aoglobelife.com', 'unknown') THEN norm.owner_email
      ELSE norm.agent_email
    END AS producer_email
  FROM norm
  LEFT JOIN ml ON ml.id = norm.id
),
cust AS (
  SELECT
    producer.id,
    trim(c.first_name || ' ' || c.last_name) AS agent_name,
    c.associate_id
  FROM producer
  JOIN customers c ON lower(c.company_email) = lower(producer.producer_email)
)
SELECT DISTINCT ON (n.taalk_call_id)
  n.id,
  n.billing_transaction_id AS transaction_id,
  n.taalk_call_id,
  n.call_date AS transaction_date,
  coalesce(producer.producer_email, n.agent_email) AS agent_email,
  coalesce(n.associate_id, cust.associate_id) AS associate_id,
  cust.agent_name,
  ml.lead_name,
  n.to_number AS lead_phone,
  ml.market,
  -- Recording URL: only expose when Supabase (child, then parent, then analytics)
  CASE
    WHEN n.t_recording_url IS NOT NULL AND n.t_recording_url::text LIKE '%supabase%' THEN n.t_recording_url
    WHEN n.p_recording_url IS NOT NULL AND n.p_recording_url::text LIKE '%supabase%' THEN n.p_recording_url
    WHEN n.a_recording_url IS NOT NULL AND n.a_recording_url::text LIKE '%supabase%' THEN n.a_recording_url
    ELSE NULL
  END AS recording_url,
  n.transcript,
  n.call_duration,
  n.call_score,
  n.analysis_status,
  n.analyzed_at,
  n.sentiment_label,
  n.call_outcome,
  n.outcome,
  n.ai_analysis,
  n.scorecard_results,
  n.coaching_notes,
  n.key_topics,
  n.objections_detected,
  n.sentiment_score,
  n.agent_talk_time_pct,
  n.client_engagement_level,
  n.call_outcome_confidence,
  n.compliance_flags,
  n.key_moments,
  (n.analysis_status = 'completed') AS has_analysis,
  CASE WHEN n.billing_transaction_id LIKE 'twilio-%' THEN 'CCPRO' ELSE NULL END AS type_label
FROM norm n
LEFT JOIN ml ON ml.id = n.id
LEFT JOIN producer ON producer.id = n.id
LEFT JOIN cust ON cust.id = n.id
ORDER BY n.taalk_call_id, n.id DESC;

COMMENT ON VIEW call_analytics_transfers IS 'Call analytics list: twilio/csv transfers with Supabase recording_url only. Use for Table Editor and /api/call-analytics/transfers.';
