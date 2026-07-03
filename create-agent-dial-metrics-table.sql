-- AGENT DIAL METRICS TABLE
-- This table tracks dial/reach/booked metrics independently of masterlead
-- This allows cleaning up and reassigning leads in masterlead without losing historical tracking data
-- CRITICAL: This is the source of truth for agent performance metrics across date ranges

CREATE TABLE IF NOT EXISTS agent_dial_metrics (
  id BIGSERIAL PRIMARY KEY,
  agent_email TEXT NOT NULL,
  agent_name TEXT,
  lead_id BIGINT, -- Reference to masterlead.id (nullable since leads can be deleted/reassigned)
  lead_phone TEXT NOT NULL, -- Store phone for historical tracking even if lead is deleted
  lead_name TEXT,
  lead_state TEXT,
  event_type TEXT NOT NULL, -- 'dial', 'reach', 'booked'
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  call_duration INTEGER, -- Duration in seconds
  call_status TEXT, -- 'completed', 'no_answer', 'busy', 'failed', etc.
  disposition TEXT, -- Call disposition if available
  call_sid TEXT, -- Twilio call SID if available
  source TEXT, -- 'dialer', 'vdp', 'manual', 'hotlead', etc.
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes for fast queries
  CONSTRAINT agent_dial_metrics_agent_email_check CHECK (agent_email IS NOT NULL AND agent_email != ''),
  CONSTRAINT agent_dial_metrics_event_type_check CHECK (event_type IN ('dial', 'reach', 'booked'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_dial_metrics_agent_email ON agent_dial_metrics(agent_email);
CREATE INDEX IF NOT EXISTS idx_agent_dial_metrics_event_timestamp ON agent_dial_metrics(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_dial_metrics_agent_date ON agent_dial_metrics(agent_email, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_dial_metrics_event_type ON agent_dial_metrics(event_type);
CREATE INDEX IF NOT EXISTS idx_agent_dial_metrics_lead_id ON agent_dial_metrics(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_dial_metrics_lead_phone ON agent_dial_metrics(lead_phone);

-- Composite index for common query pattern: agent + date range + event type
CREATE INDEX IF NOT EXISTS idx_agent_dial_metrics_agent_date_type ON agent_dial_metrics(agent_email, event_timestamp DESC, event_type);

COMMENT ON TABLE agent_dial_metrics IS 'Tracks dial/reach/booked metrics independently of masterlead table. Allows accurate tracking across date ranges even when leads are cleaned up or reassigned.';
COMMENT ON COLUMN agent_dial_metrics.lead_id IS 'Reference to masterlead.id - nullable since leads can be deleted/reassigned';
COMMENT ON COLUMN agent_dial_metrics.lead_phone IS 'Stored for historical tracking even if lead is deleted from masterlead';
COMMENT ON COLUMN agent_dial_metrics.event_type IS 'Type of event: dial (contact attempted), reach (contact made), booked (appointment set)';
COMMENT ON COLUMN agent_dial_metrics.event_timestamp IS 'When the event occurred - used for date range queries';

