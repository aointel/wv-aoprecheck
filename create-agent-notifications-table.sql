-- Agent notifications table for billing transactions and other alerts
CREATE TABLE IF NOT EXISTS agent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_email TEXT NOT NULL,
  notification_type TEXT NOT NULL, -- 'billing_transaction', 'credit_low', 'missed_call', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  metadata JSONB, -- Additional data (transaction_id, amount, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_agent_notifications_agent_email ON agent_notifications (agent_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_notifications_unread ON agent_notifications (agent_email, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_agent_notifications_type ON agent_notifications (notification_type, created_at DESC);




