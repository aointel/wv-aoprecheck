-- Create atomic increment functions for weekly_usage_stats to prevent race conditions

-- Function to atomically increment VDP connect stats
CREATE OR REPLACE FUNCTION increment_vdp_stats(
  p_agent_email TEXT,
  p_week_start_date DATE,
  p_vdp_connects INTEGER DEFAULT 1,
  p_vdp_minutes INTEGER DEFAULT 0
) RETURNS void AS $$
BEGIN
  INSERT INTO weekly_usage_stats (
    agent_email,
    week_start_date,
    week_end_date,
    vdp_connects_received,
    vdp_total_minutes,
    updated_at
  )
  VALUES (
    p_agent_email,
    p_week_start_date,
    p_week_start_date + INTERVAL '6 days',
    p_vdp_connects,
    p_vdp_minutes,
    NOW()
  )
  ON CONFLICT (agent_email, week_start_date)
  DO UPDATE SET
    vdp_connects_received = weekly_usage_stats.vdp_connects_received + p_vdp_connects,
    vdp_total_minutes = weekly_usage_stats.vdp_total_minutes + p_vdp_minutes,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to atomically increment dial stats
CREATE OR REPLACE FUNCTION increment_dial_stats(
  p_agent_email TEXT,
  p_week_start_date DATE,
  p_dials INTEGER DEFAULT 1,
  p_call_minutes INTEGER DEFAULT 0
) RETURNS void AS $$
BEGIN
  INSERT INTO weekly_usage_stats (
    agent_email,
    week_start_date,
    week_end_date,
    total_dials_made,
    total_call_minutes,
    updated_at
  )
  VALUES (
    p_agent_email,
    p_week_start_date,
    p_week_start_date + INTERVAL '6 days',
    p_dials,
    p_call_minutes,
    NOW()
  )
  ON CONFLICT (agent_email, week_start_date)
  DO UPDATE SET
    total_dials_made = weekly_usage_stats.total_dials_made + p_dials,
    total_call_minutes = weekly_usage_stats.total_call_minutes + p_call_minutes,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to atomically increment CCPro call minutes
CREATE OR REPLACE FUNCTION increment_ccpro_stats(
  p_agent_email TEXT,
  p_week_start_date DATE,
  p_ccpro_minutes INTEGER,
  p_dials INTEGER DEFAULT 1
) RETURNS void AS $$
BEGIN
  INSERT INTO weekly_usage_stats (
    agent_email,
    week_start_date,
    week_end_date,
    ccpro_call_minutes,
    total_dials_made,
    total_call_minutes,
    updated_at
  )
  VALUES (
    p_agent_email,
    p_week_start_date,
    p_week_start_date + INTERVAL '6 days',
    p_ccpro_minutes,
    p_dials,
    p_ccpro_minutes,
    NOW()
  )
  ON CONFLICT (agent_email, week_start_date)
  DO UPDATE SET
    ccpro_call_minutes = weekly_usage_stats.ccpro_call_minutes + p_ccpro_minutes,
    total_dials_made = weekly_usage_stats.total_dials_made + p_dials,
    total_call_minutes = weekly_usage_stats.total_call_minutes + p_ccpro_minutes,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to atomically increment login count
CREATE OR REPLACE FUNCTION increment_login_stats(
  p_agent_email TEXT,
  p_week_start_date DATE
) RETURNS void AS $$
DECLARE
  v_unique_days INTEGER;
BEGIN
  -- Calculate unique login days
  SELECT COUNT(DISTINCT DATE(timestamp))::INTEGER
  INTO v_unique_days
  FROM agent_activity_log
  WHERE agent_email = p_agent_email
    AND activity_type = 'login'
    AND timestamp >= p_week_start_date;
  
  INSERT INTO weekly_usage_stats (
    agent_email,
    week_start_date,
    week_end_date,
    total_logins,
    unique_login_days,
    updated_at
  )
  VALUES (
    p_agent_email,
    p_week_start_date,
    p_week_start_date + INTERVAL '6 days',
    1,
    COALESCE(v_unique_days, 1),
    NOW()
  )
  ON CONFLICT (agent_email, week_start_date)
  DO UPDATE SET
    total_logins = weekly_usage_stats.total_logins + 1,
    unique_login_days = COALESCE(v_unique_days, weekly_usage_stats.unique_login_days),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to atomically increment appointment count
CREATE OR REPLACE FUNCTION increment_appointment_stats(
  p_agent_email TEXT,
  p_week_start_date DATE
) RETURNS void AS $$
BEGIN
  INSERT INTO weekly_usage_stats (
    agent_email,
    week_start_date,
    week_end_date,
    appointments_scheduled,
    updated_at
  )
  VALUES (
    p_agent_email,
    p_week_start_date,
    p_week_start_date + INTERVAL '6 days',
    1,
    NOW()
  )
  ON CONFLICT (agent_email, week_start_date)
  DO UPDATE SET
    appointments_scheduled = weekly_usage_stats.appointments_scheduled + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to atomically increment sale stats
CREATE OR REPLACE FUNCTION increment_sale_stats(
  p_agent_email TEXT,
  p_week_start_date DATE,
  p_alp_amount NUMERIC
) RETURNS void AS $$
BEGIN
  INSERT INTO weekly_usage_stats (
    agent_email,
    week_start_date,
    week_end_date,
    sales_made,
    total_alp,
    updated_at
  )
  VALUES (
    p_agent_email,
    p_week_start_date,
    p_week_start_date + INTERVAL '6 days',
    1,
    p_alp_amount,
    NOW()
  )
  ON CONFLICT (agent_email, week_start_date)
  DO UPDATE SET
    sales_made = weekly_usage_stats.sales_made + 1,
    total_alp = weekly_usage_stats.total_alp + p_alp_amount,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
