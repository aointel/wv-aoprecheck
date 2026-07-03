-- Create live_call_board table for real-time agent monitoring
-- This table is managed entirely by Supabase (workers/services update it)
-- The app ONLY reads from this table - never writes to it

CREATE TABLE IF NOT EXISTS live_call_board (
  agent_email        text PRIMARY KEY,
  
  -- Agent Info
  agent_name         text,
  associate_id       integer,
  mga_name           text,
  rga_name           text,
  mga_associate_id   integer,
  rga_associate_id   integer,
  mga_team           text,
  
  -- Status
  status             text NOT NULL CHECK (status IN ('online', 'calling', 'presenting', 'live', 'dialing', 'active', 'offline')),
  ccpro_enabled      boolean DEFAULT false,
  available_for_inbound boolean DEFAULT false,
  has_call_connector_heartbeat boolean DEFAULT false,
  has_recruit_heartbeat boolean DEFAULT false,
  
  -- Current Call Info (JSONB for flexibility)
  current_call       jsonb, -- { phoneNumber, duration, clientName, direction, callStatus, callSid, startedAt, answeredAt }
  
  -- Current Presentation Info (JSONB)
  current_presentation jsonb, -- { type, presentationType, duration, clientName, clientPhone, presentationUrl, sessionId, startTime }
  
  -- Current Live Info (JSONB)
  current_live       jsonb, -- { type, lastActivity, duration }
  
  -- Today's Stats
  today_dialed       integer DEFAULT 0,
  today_reached      integer DEFAULT 0,
  today_booked       integer DEFAULT 0,
  today_instant_presentation integer DEFAULT 0,
  today_presentations integer DEFAULT 0,
  today_sales        integer DEFAULT 0,
  today_alp          numeric DEFAULT 0,
  
  -- Time Tracking (in seconds)
  available_time     integer DEFAULT 0,
  waiting_time       integer DEFAULT 0,
  call_time          integer DEFAULT 0,
  
  -- Other Metrics
  connects           integer DEFAULT 0,
  credits_remaining  integer,
  pending_leads      integer DEFAULT 0,
  
  -- Timestamps
  last_activity      timestamptz,
  last_heartbeat_at  timestamptz DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_live_call_board_status 
  ON live_call_board (status, updated_at);

CREATE INDEX IF NOT EXISTS idx_live_call_board_ccpro 
  ON live_call_board (ccpro_enabled, status)
  WHERE ccpro_enabled = true;

CREATE INDEX IF NOT EXISTS idx_live_call_board_mga 
  ON live_call_board (mga_name, status);

CREATE INDEX IF NOT EXISTS idx_live_call_board_rga 
  ON live_call_board (rga_name, status);

CREATE INDEX IF NOT EXISTS idx_live_call_board_associate_id 
  ON live_call_board (associate_id);

CREATE INDEX IF NOT EXISTS idx_live_call_board_last_activity 
  ON live_call_board (last_activity DESC);

-- Comments
COMMENT ON TABLE live_call_board IS 'Real-time live call board data. Managed by Supabase workers/services. App only reads.';
COMMENT ON COLUMN live_call_board.agent_email IS 'Primary key - must match agent_live_call_status.agent_email';
COMMENT ON COLUMN live_call_board.status IS 'Current agent status: online, calling, presenting, live, dialing, active, offline';
COMMENT ON COLUMN live_call_board.current_call IS 'JSONB object with current call details: { phoneNumber, duration, clientName, direction, callStatus, callSid, startedAt, answeredAt }';
COMMENT ON COLUMN live_call_board.current_presentation IS 'JSONB object with current presentation details';
COMMENT ON COLUMN live_call_board.current_live IS 'JSONB object with current live session details';
COMMENT ON COLUMN live_call_board.today_dialed IS 'Number of calls dialed today';
COMMENT ON COLUMN live_call_board.today_reached IS 'Number of calls reached/answered today';
COMMENT ON COLUMN live_call_board.today_booked IS 'Number of appointments booked today';
COMMENT ON COLUMN live_call_board.available_time IS 'Total seconds agent has been available today';
COMMENT ON COLUMN live_call_board.call_time IS 'Total seconds agent has been on calls today';
COMMENT ON COLUMN live_call_board.last_heartbeat_at IS 'Last time agent sent heartbeat - used to determine if still active';

