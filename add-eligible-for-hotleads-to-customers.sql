-- Add eligible_for_hotleads to customers table
-- When Hot Lead is selected and agent goes online with VDP, set true; when offline or Standard, set false.
-- Only agents with eligible_for_hotleads = true are eligible to receive hot leads.

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS eligible_for_hotleads BOOLEAN DEFAULT false;

COMMENT ON COLUMN customers.eligible_for_hotleads IS 'True when agent has Hot Lead selected and is online with VDP; false when offline or Standard mode. Used to filter who receives hot leads.';

CREATE INDEX IF NOT EXISTS idx_customers_eligible_for_hotleads
  ON customers (eligible_for_hotleads)
  WHERE eligible_for_hotleads = true;
