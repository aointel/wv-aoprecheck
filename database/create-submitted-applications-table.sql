-- ============================================================================
-- SUBMITTED APPLICATIONS (NOPRD paste data)
-- Stores rows pasted from the portal; optional link to connects (billing) or booked (agent_dial_metrics).
-- ============================================================================

CREATE TABLE IF NOT EXISTS submitted_applications (
  id BIGSERIAL PRIMARY KEY,

  -- From portal paste (match portal columns)
  insured TEXT,
  agent_release TIMESTAMPTZ,
  sga_submit TIMESTAMPTZ,
  tenure TEXT,
  policy_number TEXT,
  lob TEXT,
  cwa TEXT,
  alp NUMERIC(12,2),  -- CWA * 12 for Life LOB only (annualized premium)
  submit_type TEXT,
  nilico_status TEXT,
  agent TEXT,
  office TEXT,
  qa_specialist TEXT,
  director TEXT,
  telecheck TEXT,
  verification_result TEXT,
  submitted_by TEXT,
  mac_status TEXT,

  -- Match flags: set when we link to a connect (AOI) or booked/reached (CCPRO)
  transfer_type TEXT CHECK (transfer_type IS NULL OR transfer_type IN ('aoi_connect', 'ccpro_booked', 'ccpro_reached')),
  matched_billing_transaction_id BIGINT,
  matched_agent_dial_metric_id INTEGER,
  -- ALP by origin: so we know and can sum AOI vs CCPRO
  aoi_alp NUMERIC(12,2),   -- ALP when matched to AOI connect (billing)
  ccpro_alp NUMERIC(12,2), -- ALP when matched to CCPRO (booked or reached)

  scrape_run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lookup and matching
CREATE INDEX IF NOT EXISTS idx_submitted_applications_agent ON submitted_applications(agent);
CREATE INDEX IF NOT EXISTS idx_submitted_applications_sga_submit ON submitted_applications(sga_submit);
CREATE INDEX IF NOT EXISTS idx_submitted_applications_insured ON submitted_applications(insured);
CREATE INDEX IF NOT EXISTS idx_submitted_applications_transfer_type ON submitted_applications(transfer_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_submitted_applications_policy_sga ON submitted_applications(policy_number, sga_submit)
  WHERE policy_number IS NOT NULL AND sga_submit IS NOT NULL;

-- Optional: summary per paste run
CREATE TABLE IF NOT EXISTS submitted_applications_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_policies INTEGER,
  total_applications INTEGER,
  current_week_gross_alp DECIMAL(12,2),
  submit_standard_alp DECIMAL(12,2),
  submit_trial_alp DECIMAL(12,2),
  monthly_alp DECIMAL(12,2),
  date_from DATE,
  date_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE submitted_applications IS 'Rows pasted from NOPRD Submitted Applications; transfer_type links to AOI connect or CCPRO booked.';
COMMENT ON COLUMN submitted_applications.transfer_type IS 'aoi_connect = billing_transactions connect; ccpro_booked = agent_dial_metrics booked; ccpro_reached = agent_dial_metrics reach (45+ sec).';
COMMENT ON COLUMN submitted_applications.alp IS 'Annualized premium from portal: CWA * 12 for Life LOB only.';
COMMENT ON COLUMN submitted_applications.aoi_alp IS 'ALP attributed to AOI (set when transfer_type = aoi_connect).';
COMMENT ON COLUMN submitted_applications.ccpro_alp IS 'ALP attributed to Call Connector Pro (set when transfer_type = ccpro_booked or ccpro_reached).';

-- If table already exists, run: ALTER TABLE submitted_applications ADD COLUMN IF NOT EXISTS aoi_alp NUMERIC(12,2); ALTER TABLE submitted_applications ADD COLUMN IF NOT EXISTS ccpro_alp NUMERIC(12,2);
