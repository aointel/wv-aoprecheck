-- Recruit Hot Candidate System - mirrors Connect hotlead flow
-- 1) masterrecruit: is_hot_candidate, priority_score for hot queue
-- 2) customers: eligible_for_hot_candidates for Hot Candidate flame when Recruit CCPRO + VDP online

-- Masterrecruit: hot candidate flag and priority
ALTER TABLE masterrecruit
ADD COLUMN IF NOT EXISTS is_hot_candidate BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 0;

COMMENT ON COLUMN masterrecruit.is_hot_candidate IS 'True = hot candidate (high-priority, fresh); shows in Hot Candidates tab';
COMMENT ON COLUMN masterrecruit.priority_score IS 'Higher = first in queue; for hot candidate ordering';

CREATE INDEX IF NOT EXISTS idx_masterrecruit_is_hot_candidate
  ON masterrecruit (is_hot_candidate)
  WHERE is_hot_candidate = true;

-- Customers: eligible for hot candidates (Recruit CCPRO + VDP online)
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS eligible_for_hot_candidates BOOLEAN DEFAULT false;

COMMENT ON COLUMN customers.eligible_for_hot_candidates IS 'True when agent has Recruit CCPRO on + VDP online; enables Hot Candidate flame';

CREATE INDEX IF NOT EXISTS idx_customers_eligible_for_hot_candidates
  ON customers (eligible_for_hot_candidates)
  WHERE eligible_for_hot_candidates = true;
