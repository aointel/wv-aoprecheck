-- Call Connector Tracker Table
-- Tracks all outbound calls made from Call Connector Pro
-- Used to send webhooks for calls over 60 seconds

CREATE TABLE IF NOT EXISTS call_connector_tracker (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id BIGINT NOT NULL, -- Changed from UUID to BIGINT to match masterlead.id
    agent_email TEXT NOT NULL,
    agent_name TEXT,
    call_sid TEXT, -- Twilio Call SID
    lead_phone TEXT,
    lead_name TEXT,
    lead_state TEXT,
    conference_name TEXT,
    duration INTEGER DEFAULT 0, -- Duration in seconds
    status TEXT DEFAULT 'dialing', -- dialing, ringing, answered, completed, failed
    reached BOOLEAN DEFAULT FALSE, -- True if call was answered
    disposition TEXT, -- booked, no_answer, callback, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    answered_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    webhook_sent_at TIMESTAMP WITH TIME ZONE, -- When webhook was sent to Planet ALTIG
    
    -- Indexes for fast queries
    CONSTRAINT fk_lead FOREIGN KEY (lead_id) REFERENCES masterlead(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_connector_tracker_agent_email ON call_connector_tracker(agent_email);
CREATE INDEX IF NOT EXISTS idx_call_connector_tracker_lead_id ON call_connector_tracker(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_connector_tracker_call_sid ON call_connector_tracker(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_connector_tracker_created_at ON call_connector_tracker(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_connector_tracker_duration ON call_connector_tracker(duration) WHERE duration >= 60;
CREATE INDEX IF NOT EXISTS idx_call_connector_tracker_webhook_pending ON call_connector_tracker(webhook_sent_at) WHERE webhook_sent_at IS NULL AND duration >= 60;

-- Add webhook_sent_at column to masterlead table
-- This tracks when booked leads have been sent to Planet ALTIG webhook
ALTER TABLE masterlead 
ADD COLUMN IF NOT EXISTS webhook_sent_at TIMESTAMP WITH TIME ZONE;

-- Index for finding booked leads that haven't been sent to webhook yet
CREATE INDEX IF NOT EXISTS idx_masterlead_webhook_pending 
ON masterlead(webhook_sent_at, cnresolution, resolved_at) 
WHERE webhook_sent_at IS NULL AND cnresolution = 'booked';

-- View for debugging webhook queue
CREATE OR REPLACE VIEW webhook_queue_debug AS
SELECT 
    m.id,
    m.taalk_lead_id,
    m.first_name,
    m.last_name,
    m.phone,
    m.cn_email,
    m.cnresolution,
    m.resolved_at,
    m.webhook_sent_at,
    c.associate_id,
    CASE 
        WHEN m.webhook_sent_at IS NOT NULL THEN 'SENT'
        WHEN m.taalk_lead_id IS NULL THEN 'NO_TAALK_ID'
        WHEN c.associate_id IS NULL THEN 'NO_ASSOCIATE_ID'
        ELSE 'PENDING'
    END as webhook_status
FROM masterlead m
LEFT JOIN customers c ON c.company_email = LOWER(TRIM(m.cn_email))
WHERE m.cnresolution = 'booked' 
  AND m.resolved_at > NOW() - INTERVAL '7 days'
ORDER BY m.resolved_at DESC;

COMMENT ON TABLE call_connector_tracker IS 'Tracks all outbound calls from Call Connector Pro for webhook sending and analytics';
COMMENT ON COLUMN call_connector_tracker.webhook_sent_at IS 'Timestamp when the 60+ second call webhook was sent to Planet ALTIG via Zapier';
COMMENT ON COLUMN masterlead.webhook_sent_at IS 'Timestamp when the booked lead was sent to Planet ALTIG webhook via Zapier';

