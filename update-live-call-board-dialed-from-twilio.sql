-- Update the dialed counting to use twilio_call_logs instead of agent_dial_metrics
-- This replaces the dialed counting logic in update-live-call-board-from-agent-dial-metrics.sql

-- Function to update live_call_boardt stats - DIALED from twilio_call_logs, others from agent_dial_metrics
CREATE OR REPLACE FUNCTION update_live_call_boardt_stats_from_metrics()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
BEGIN
  -- Get today's date range in EST timezone
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York';
  today_end := today_start + interval '1 day';
  
  -- Update live_call_boardt with today's stats
  -- DIALED: From twilio_call_logs (calls with duration > 0)
  -- REACHED/BOOKED/INSTANT_PRESENTATION: From agent_dial_metrics
  INSERT INTO live_call_boardt (
    agent_email,
    status,
    today_dialed,
    today_reached,
    today_booked,
    today_instant_presentation,
    updated_at
  )
  SELECT 
    COALESCE(dialed_stats.agent_email, metrics_stats.agent_email) as agent_email,
    'offline' as status,
    COALESCE(dialed_stats.dialed, 0) as dialed,
    COALESCE(metrics_stats.reached, 0) as reached,
    COALESCE(metrics_stats.booked, 0) as booked,
    COALESCE(metrics_stats.instant_presentation, 0) as instant_presentation,
    now() as updated_at
  FROM (
    -- DIALED: Count distinct calls from twilio_call_logs
    SELECT 
      tcl.owner_email as agent_email,
      COUNT(DISTINCT tcl.twilio_call_sid) as dialed
    FROM twilio_call_logs tcl
    WHERE tcl.call_started_at >= today_start
      AND tcl.call_started_at < today_end
      AND tcl.owner_email IS NOT NULL
      AND tcl.owner_email != ''
      AND tcl.call_duration IS NOT NULL
      AND tcl.call_duration > 0
      AND tcl.to_number IS NOT NULL
      AND tcl.to_number != ''  -- Skip parent WebRTC calls
    GROUP BY tcl.owner_email
  ) dialed_stats
  FULL OUTER JOIN (
    -- REACHED/BOOKED/INSTANT_PRESENTATION: From agent_dial_metrics
    SELECT 
      adm.agent_email,
      COUNT(DISTINCT CASE 
        WHEN LOWER(adm.event_type) = 'reach'
          AND adm.call_sid IS NOT NULL
          AND (tcl.call_duration IS NOT NULL OR adm.call_duration IS NOT NULL)
          AND COALESCE(tcl.call_duration, adm.call_duration, 0) >= 50
          AND LOWER(COALESCE(tcl.call_status, adm.call_status, '')) IN ('answered', 'completed')
        THEN adm.lead_phone 
      END) as reached,
      COUNT(DISTINCT CASE 
        WHEN (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
          AND COALESCE(tcl.call_duration, adm.call_duration, 0) > 120
        THEN adm.lead_phone 
      END) as booked,
      COUNT(DISTINCT CASE 
        WHEN (LOWER(adm.event_type) = 'instant_presentation' OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation')
        THEN adm.lead_phone 
      END) as instant_presentation
    FROM agent_dial_metrics adm
    LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
    WHERE adm.event_timestamp >= today_start
      AND adm.event_timestamp < today_end
      AND adm.agent_email IS NOT NULL
      AND adm.agent_email != ''
      AND adm.lead_phone IS NOT NULL
    GROUP BY adm.agent_email
  ) metrics_stats ON dialed_stats.agent_email = metrics_stats.agent_email
  WHERE COALESCE(dialed_stats.agent_email, metrics_stats.agent_email) IS NOT NULL
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    today_dialed = EXCLUDED.today_dialed,
    today_reached = EXCLUDED.today_reached,
    today_booked = EXCLUDED.today_booked,
    today_instant_presentation = EXCLUDED.today_instant_presentation,
    updated_at = EXCLUDED.updated_at;
END;
$$;
