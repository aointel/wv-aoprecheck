-- Create hotlead_webhooks table to track webhook sends and prevent duplicates

CREATE TABLE IF NOT EXISTS hotlead_webhooks (
  id SERIAL PRIMARY KEY,
  call_sid VARCHAR(50) NOT NULL,
  hotlead_id INTEGER,
  agent_email VARCHAR(255),
  webhook_payload JSONB,
  webhook_status VARCHAR(20) DEFAULT 'sent',
  webhook_response TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast duplicate checking
CREATE INDEX IF NOT EXISTS idx_hotlead_webhooks_call_sid 
ON hotlead_webhooks(call_sid);

-- Index for agent tracking
CREATE INDEX IF NOT EXISTS idx_hotlead_webhooks_agent_email 
ON hotlead_webhooks(agent_email);

-- Index for date queries
CREATE INDEX IF NOT EXISTS idx_hotlead_webhooks_sent_at 
ON hotlead_webhooks(sent_at DESC);

COMMENT ON TABLE hotlead_webhooks IS 'Tracks hotlead assignment webhooks sent to Planet ALTIG for calls over 60 seconds';

