-- Agent Availability Tracking Table
-- Tracks daily agent availability, status changes, and cumulative time

CREATE TABLE IF NOT EXISTS agent_availability_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id VARCHAR(50) NOT NULL,
  agent_email VARCHAR(255) NOT NULL,
  agent_name VARCHAR(255),
  tracking_date DATE NOT NULL,
  
  -- Status tracking
  current_status VARCHAR(20) NOT NULL CHECK (current_status IN ('online', 'calling', 'offline')),
  status_changed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  previous_status VARCHAR(20),
  
  -- Time tracking (in seconds)
  total_available_time INTEGER DEFAULT 0, -- Total seconds available today
  total_calling_time INTEGER DEFAULT 0,   -- Total seconds on calls today
  total_offline_time INTEGER DEFAULT 0,   -- Total seconds offline today
  
  -- Session tracking
  current_session_start TIMESTAMP WITH TIME ZONE,
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_availability_agent_id ON agent_availability_tracking(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_availability_date ON agent_availability_tracking(tracking_date);
CREATE INDEX IF NOT EXISTS idx_agent_availability_status ON agent_availability_tracking(current_status);
CREATE INDEX IF NOT EXISTS idx_agent_availability_agent_date ON agent_availability_tracking(agent_id, tracking_date);

-- Unique constraint to prevent duplicate entries per agent per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_availability_unique 
ON agent_availability_tracking(agent_id, tracking_date);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_agent_availability_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_agent_availability_updated_at
  BEFORE UPDATE ON agent_availability_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_availability_updated_at();

-- Function to get or create daily tracking record
CREATE OR REPLACE FUNCTION get_or_create_daily_tracking(
  p_agent_id VARCHAR(50),
  p_agent_email VARCHAR(255),
  p_agent_name VARCHAR(255),
  p_tracking_date DATE DEFAULT CURRENT_DATE
)
RETURNS agent_availability_tracking AS $$
DECLARE
  result agent_availability_tracking;
BEGIN
  -- Try to get existing record
  SELECT * INTO result 
  FROM agent_availability_tracking 
  WHERE agent_id = p_agent_id 
    AND tracking_date = p_tracking_date;
  
  -- If not found, create new record
  IF NOT FOUND THEN
    INSERT INTO agent_availability_tracking (
      agent_id, 
      agent_email, 
      agent_name, 
      tracking_date,
      current_status,
      status_changed_at,
      last_activity
    ) VALUES (
      p_agent_id,
      p_agent_email,
      p_agent_name,
      p_tracking_date,
      'offline',
      NOW(),
      NOW()
    ) RETURNING * INTO result;
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to update agent status and track time
CREATE OR REPLACE FUNCTION update_agent_status(
  p_agent_id VARCHAR(50),
  p_agent_email VARCHAR(255),
  p_agent_name VARCHAR(255),
  p_new_status VARCHAR(20),
  p_tracking_date DATE DEFAULT CURRENT_DATE
)
RETURNS agent_availability_tracking AS $$
DECLARE
  tracking_record agent_availability_tracking;
  time_diff INTEGER;
  current_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
  -- Get or create tracking record
  SELECT * INTO tracking_record 
  FROM get_or_create_daily_tracking(p_agent_id, p_agent_email, p_agent_name, p_tracking_date);
  
  -- Calculate time difference since last update
  time_diff := EXTRACT(EPOCH FROM (current_time - tracking_record.status_changed_at))::INTEGER;
  
  -- Add time to appropriate category based on previous status
  IF tracking_record.current_status = 'online' THEN
    tracking_record.total_available_time := tracking_record.total_available_time + time_diff;
  ELSIF tracking_record.current_status = 'calling' THEN
    tracking_record.total_calling_time := tracking_record.total_calling_time + time_diff;
  ELSIF tracking_record.current_status = 'offline' THEN
    tracking_record.total_offline_time := tracking_record.total_offline_time + time_diff;
  END IF;
  
  -- Update the record with new status
  UPDATE agent_availability_tracking SET
    current_status = p_new_status,
    previous_status = tracking_record.current_status,
    status_changed_at = current_time,
    last_activity = current_time,
    current_session_start = CASE 
      WHEN p_new_status = 'online' THEN current_time 
      ELSE tracking_record.current_session_start 
    END,
    total_available_time = tracking_record.total_available_time,
    total_calling_time = tracking_record.total_calling_time,
    total_offline_time = tracking_record.total_offline_time
  WHERE id = tracking_record.id
  RETURNING * INTO tracking_record;
  
  RETURN tracking_record;
END;
$$ LANGUAGE plpgsql;

-- Function to get daily summary for an agent
CREATE OR REPLACE FUNCTION get_agent_daily_summary(
  p_agent_id VARCHAR(50),
  p_tracking_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  agent_id VARCHAR(50),
  agent_email VARCHAR(255),
  agent_name VARCHAR(255),
  tracking_date DATE,
  current_status VARCHAR(20),
  total_available_time INTEGER,
  total_calling_time INTEGER,
  total_offline_time INTEGER,
  formatted_available_time TEXT,
  formatted_calling_time TEXT,
  formatted_offline_time TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    aat.agent_id,
    aat.agent_email,
    aat.agent_name,
    aat.tracking_date,
    aat.current_status,
    aat.total_available_time,
    aat.total_calling_time,
    aat.total_offline_time,
    TO_CHAR(INTERVAL '1 second' * aat.total_available_time, 'HH24:MI:SS') as formatted_available_time,
    TO_CHAR(INTERVAL '1 second' * aat.total_calling_time, 'HH24:MI:SS') as formatted_calling_time,
    TO_CHAR(INTERVAL '1 second' * aat.total_offline_time, 'HH24:MI:SS') as formatted_offline_time
  FROM agent_availability_tracking aat
  WHERE aat.agent_id = p_agent_id 
    AND aat.tracking_date = p_tracking_date;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old records (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_availability_records()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM agent_availability_tracking 
  WHERE tracking_date < CURRENT_DATE - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON agent_availability_tracking TO your_app_user;
-- GRANT EXECUTE ON FUNCTION get_or_create_daily_tracking TO your_app_user;
-- GRANT EXECUTE ON FUNCTION update_agent_status TO your_app_user;
-- GRANT EXECUTE ON FUNCTION get_agent_daily_summary TO your_app_user;
-- GRANT EXECUTE ON FUNCTION cleanup_old_availability_records TO your_app_user;

COMMENT ON TABLE agent_availability_tracking IS 'Tracks daily agent availability, status changes, and cumulative time spent in each status';
COMMENT ON COLUMN agent_availability_tracking.total_available_time IS 'Total seconds spent in online status today';
COMMENT ON COLUMN agent_availability_tracking.total_calling_time IS 'Total seconds spent on calls today';
COMMENT ON COLUMN agent_availability_tracking.total_offline_time IS 'Total seconds spent offline today';


