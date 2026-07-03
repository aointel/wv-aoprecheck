-- Create Manager Billing Portal tables for MGA/RGA to pay for agent calls

-- 1. Manager Billing Allocations Table - Tracks when MGA/RGA pays for agent services
CREATE TABLE IF NOT EXISTS public.manager_billing_allocations (
  id SERIAL PRIMARY KEY,
  allocation_id TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  
  -- Manager info (MGA/RGA)
  manager_email TEXT NOT NULL,
  manager_associate_id INTEGER,
  manager_name TEXT,
  manager_role TEXT CHECK (manager_role IN ('MGA', 'RGA', 'BOTH')),
  
  -- Agent info (the producer receiving the allocation)
  agent_email TEXT NOT NULL,
  agent_associate_id INTEGER,
  agent_name TEXT,
  
  -- Allocation details
  service_type TEXT NOT NULL CHECK (service_type IN ('connect', 'recruit', 'precheck', 'hotconnect', 'all')),
  allocation_type TEXT NOT NULL CHECK (allocation_type IN ('credits', 'unlimited', 'percentage')),
  
  -- For credits allocation: number of credits allocated
  credits_allocated INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  credits_remaining INTEGER DEFAULT 0,
  
  -- For percentage allocation: what percentage the manager covers
  percentage_covered DECIMAL(5,2) DEFAULT 100.00,
  
  -- Billing configuration
  billing_to TEXT DEFAULT 'manager' CHECK (billing_to IN ('manager', 'agent', 'split')),
  
  -- Dollar amounts
  total_amount_allocated DECIMAL(10,2) DEFAULT 0.00,
  total_amount_used DECIMAL(10,2) DEFAULT 0.00,
  total_amount_remaining DECIMAL(10,2) DEFAULT 0.00,
  
  -- Date range for allocation validity
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'exhausted', 'expired', 'cancelled')),
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Manager Billing Transactions Table - Records each charge to manager account
CREATE TABLE IF NOT EXISTS public.manager_billing_transactions (
  id SERIAL PRIMARY KEY,
  transaction_id TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  
  -- Link to allocation
  allocation_id TEXT REFERENCES manager_billing_allocations(allocation_id),
  
  -- Manager info
  manager_email TEXT NOT NULL,
  manager_associate_id INTEGER,
  manager_name TEXT,
  
  -- Agent info (who incurred the charge)
  agent_email TEXT NOT NULL,
  agent_associate_id INTEGER,
  agent_name TEXT,
  
  -- Transaction details
  service_type TEXT NOT NULL CHECK (service_type IN ('connect', 'recruit', 'precheck', 'hotconnect')),
  transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Amounts
  amount_charged DECIMAL(10,2) NOT NULL,
  credits_deducted INTEGER DEFAULT 0,
  
  -- Lead/Call info
  lead_id TEXT,
  lead_name TEXT,
  lead_phone TEXT,
  call_duration INTEGER, -- in seconds
  
  -- Source reference
  source_table TEXT,
  source_id TEXT,
  
  -- Status
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'disputed')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Manager Credit Balance Table - Tracks MGA/RGA credit balances for paying agent charges
CREATE TABLE IF NOT EXISTS public.manager_credit_balance (
  id SERIAL PRIMARY KEY,
  
  -- Manager info
  manager_email TEXT UNIQUE NOT NULL,
  manager_associate_id INTEGER,
  manager_name TEXT,
  manager_role TEXT CHECK (manager_role IN ('MGA', 'RGA', 'BOTH')),
  
  -- Credit balance
  credits_balance INTEGER DEFAULT 0,
  credits_purchased INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  
  -- Dollar balance (for pay-as-you-go)
  dollar_balance DECIMAL(10,2) DEFAULT 0.00,
  total_spent DECIMAL(10,2) DEFAULT 0.00,
  
  -- Billing preferences
  auto_replenish BOOLEAN DEFAULT FALSE,
  replenish_threshold INTEGER DEFAULT 50,
  replenish_amount INTEGER DEFAULT 100,
  
  -- Status
  account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'paused', 'suspended')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_manager_allocations_manager_email ON manager_billing_allocations(manager_email);
CREATE INDEX IF NOT EXISTS idx_manager_allocations_agent_email ON manager_billing_allocations(agent_email);
CREATE INDEX IF NOT EXISTS idx_manager_allocations_status ON manager_billing_allocations(status);
CREATE INDEX IF NOT EXISTS idx_manager_allocations_service_type ON manager_billing_allocations(service_type);

CREATE INDEX IF NOT EXISTS idx_manager_transactions_manager_email ON manager_billing_transactions(manager_email);
CREATE INDEX IF NOT EXISTS idx_manager_transactions_agent_email ON manager_billing_transactions(agent_email);
CREATE INDEX IF NOT EXISTS idx_manager_transactions_date ON manager_billing_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_manager_transactions_allocation ON manager_billing_transactions(allocation_id);

CREATE INDEX IF NOT EXISTS idx_manager_credits_email ON manager_credit_balance(manager_email);
CREATE INDEX IF NOT EXISTS idx_manager_credits_associate_id ON manager_credit_balance(manager_associate_id);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_manager_billing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER manager_allocations_updated_at
  BEFORE UPDATE ON manager_billing_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_manager_billing_updated_at();

CREATE TRIGGER manager_credits_updated_at
  BEFORE UPDATE ON manager_credit_balance
  FOR EACH ROW
  EXECUTE FUNCTION update_manager_billing_updated_at();

-- Add comments
COMMENT ON TABLE manager_billing_allocations IS 'Manager (MGA/RGA) allocations for paying agent service charges';
COMMENT ON TABLE manager_billing_transactions IS 'Transaction log for manager-covered agent charges';
COMMENT ON TABLE manager_credit_balance IS 'MGA/RGA credit balances for agent billing allocations';

-- Service pricing reference:
-- connect: $8.00 per connection
-- recruit: $5.00 per call
-- precheck: $4.00 per check
-- hotconnect: $2.00 per assignment






























