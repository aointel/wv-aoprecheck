-- Backfill call_analytics_transfers from taalk_call_analytics (last 24 hours only).
-- CRITICAL: recording_url ONLY when Supabase URL - never Twilio API or /api/ proxy URLs.

INSERT INTO call_analytics_transfers (
  taalk_call_analytics_id,
  transaction_id,
  taalk_call_id,
  transaction_date,
  agent_email,
  associate_id,
  agent_name,
  lead_name,
  lead_phone,
  market,
  recording_url,
  transcript,
  call_duration,
  call_score,
  analysis_status,
  analyzed_at,
  sentiment_label,
  call_outcome,
  outcome,
  ai_analysis,
  scorecard_results,
  coaching_notes,
  key_topics,
  objections_detected,
  sentiment_score,
  agent_talk_time_pct,
  client_engagement_level,
  call_outcome_confidence,
  compliance_flags,
  key_moments,
  has_analysis,
  type_label,
  updated_at
)
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
    CASE
      WHEN length(regexp_replace(coalesce(t.to_number, ''), '[^0-9]', '', 'g')) >= 10
      THEN right(regexp_replace(t.to_number, '[^0-9]', '', 'g'), 10)
      ELSE regexp_replace(coalesce(t.to_number, ''), '[^0-9]', '', 'g')
    END AS phone_norm
  FROM taalk_call_analytics a
  LEFT JOIN twilio_call_logs t ON t.twilio_call_sid = a.taalk_call_id
  LEFT JOIN twilio_call_logs p ON p.twilio_call_sid = t.parent_call_sid
  WHERE (a.billing_transaction_id LIKE 'twilio-%' OR a.billing_transaction_id LIKE 'csv-%')
    AND a.call_date >= (NOW() - INTERVAL '24 hours')
),
ml AS (
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
),
deduped AS (
  SELECT DISTINCT ON (n.taalk_call_id)
    n.id,
    n.billing_transaction_id,
    n.taalk_call_id,
    n.call_date,
    coalesce(producer.producer_email, n.agent_email) AS agent_email,
    coalesce(n.associate_id, cust.associate_id) AS associate_id,
    cust.agent_name,
    ml.lead_name,
    n.to_number AS lead_phone,
    ml.market,
    CASE
      WHEN n.t_recording_url IS NOT NULL AND n.t_recording_url::text LIKE '%supabase%' AND n.t_recording_url::text NOT LIKE '%/api/%' THEN n.t_recording_url
      WHEN n.p_recording_url IS NOT NULL AND n.p_recording_url::text LIKE '%supabase%' AND n.p_recording_url::text NOT LIKE '%/api/%' THEN n.p_recording_url
      WHEN n.a_recording_url IS NOT NULL AND n.a_recording_url::text LIKE '%supabase%' AND n.a_recording_url::text NOT LIKE '%/api/%' THEN n.a_recording_url
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
  ORDER BY n.taalk_call_id, n.id DESC
)
SELECT
  d.id,
  d.billing_transaction_id,
  d.taalk_call_id,
  d.call_date,
  d.agent_email,
  d.associate_id,
  d.agent_name,
  d.lead_name,
  d.lead_phone,
  d.market,
  d.recording_url,
  d.transcript,
  d.call_duration,
  d.call_score,
  d.analysis_status,
  d.analyzed_at,
  d.sentiment_label,
  d.call_outcome,
  d.outcome,
  d.ai_analysis,
  d.scorecard_results,
  d.coaching_notes,
  d.key_topics,
  d.objections_detected,
  d.sentiment_score,
  d.agent_talk_time_pct,
  d.client_engagement_level,
  d.call_outcome_confidence,
  d.compliance_flags,
  d.key_moments,
  d.has_analysis,
  d.type_label,
  NOW()
FROM deduped d
ON CONFLICT (transaction_id) DO UPDATE SET
  taalk_call_analytics_id = EXCLUDED.taalk_call_analytics_id,
  taalk_call_id = EXCLUDED.taalk_call_id,
  transaction_date = EXCLUDED.transaction_date,
  agent_email = EXCLUDED.agent_email,
  associate_id = EXCLUDED.associate_id,
  agent_name = EXCLUDED.agent_name,
  lead_name = EXCLUDED.lead_name,
  lead_phone = EXCLUDED.lead_phone,
  market = EXCLUDED.market,
  recording_url = EXCLUDED.recording_url,
  transcript = EXCLUDED.transcript,
  call_duration = EXCLUDED.call_duration,
  call_score = EXCLUDED.call_score,
  analysis_status = EXCLUDED.analysis_status,
  analyzed_at = EXCLUDED.analyzed_at,
  sentiment_label = EXCLUDED.sentiment_label,
  call_outcome = EXCLUDED.call_outcome,
  outcome = EXCLUDED.outcome,
  ai_analysis = EXCLUDED.ai_analysis,
  scorecard_results = EXCLUDED.scorecard_results,
  coaching_notes = EXCLUDED.coaching_notes,
  key_topics = EXCLUDED.key_topics,
  objections_detected = EXCLUDED.objections_detected,
  sentiment_score = EXCLUDED.sentiment_score,
  agent_talk_time_pct = EXCLUDED.agent_talk_time_pct,
  client_engagement_level = EXCLUDED.client_engagement_level,
  call_outcome_confidence = EXCLUDED.call_outcome_confidence,
  compliance_flags = EXCLUDED.compliance_flags,
  key_moments = EXCLUDED.key_moments,
  has_analysis = EXCLUDED.has_analysis,
  type_label = EXCLUDED.type_label,
  updated_at = EXCLUDED.updated_at;
