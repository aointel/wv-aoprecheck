-- Create comprehensive billing tables for PreCheck, Recruit, and Connect

-- 1. Billing Transactions Table - Master table for all billing events
CREATE TABLE IF NOT EXISTS public.billing_transactions (
  id SERIAL PRIMARY KEY,
  transaction_id TEXT UNIQUE NOT NULL,
  
  -- Agent info
  agent_email TEXT NOT NULL,
  agent_associate_id INTEGER,
  agent_name TEXT,
  
  -- Transaction details
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('precheck', 'recruit', 'connect', 'purchase', 'refund', 'adjustment')),
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Billing amount and credits
  amount_usd DECIMAL(10,2) NOT NULL,
  credits_charged INTEGER NOT NULL,
  
  -- Lead/Client info
  lead_name TEXT,
  lead_phone TEXT,
  lead_email TEXT,
  
  -- Source record references
  source_table TEXT, -- 'verification_sessions', 'recruit_candidates', 'vdp_calls'
  source_id INTEGER,
  
  -- Additional metadata
  description TEXT,
  notes TEXT,
  metadata JSONB,
  
  -- Status tracking
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'disputed')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for fast lookups
  CONSTRAINT unique_transaction_id UNIQUE (transaction_id)
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_billing_transactions_agent_email ON billing_transactions(agent_email);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_agent_associate_id ON billing_transactions(agent_associate_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_transaction_date ON billing_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_transaction_type ON billing_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_status ON billing_transactions(status);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_source ON billing_transactions(source_table, source_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_billing_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER billing_transactions_updated_at
  BEFORE UPDATE ON billing_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_transactions_updated_at();

-- Add comments
COMMENT ON TABLE billing_transactions IS 'Master billing transactions table tracking all PreCheck, Recruit, and Connect charges';
COMMENT ON COLUMN billing_transactions.transaction_type IS 'Type: precheck (4 credits), recruit (5 credits), connect (8 credits), purchase, refund, adjustment';
COMMENT ON COLUMN billing_transactions.source_table IS 'Source table: verification_sessions, recruit_candidates, vdp_calls';
COMMENT ON COLUMN billing_transactions.source_id IS 'ID from the source table';

