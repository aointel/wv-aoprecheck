-- ============================================================================
-- AOI SCORE TRACKER
--
-- Tracks AOI (AO Intelligence) score for every user with an associate_id.
-- The /landing page pulls realtime AOI score from this table.
--
-- Score components (from AOIScore.tsx):
--   - Dial to Connect (20%): dials that reach a live person
--   - Appointment Book Rate (20%): connects that book appointments
--   - Presentation Rate (15%): appointments that complete presentations
--   - Closing Rate (25%): presentations that result in sales
--   - Follow-up Consistency (10%): consistent follow-up execution
--   - Lead Quality (10%): lead qualification accuracy
-- ============================================================================

-- Table: aoi_score_tracker
-- One row per associate_id; updated by backend calculation jobs
CREATE TABLE IF NOT EXISTS aoi_score_tracker (
  id BIGSERIAL PRIMARY KEY,
  
  -- Identity: associate_id is the primary key for lookup (from customers table)
  associate_id INTEGER NOT NULL UNIQUE,
  agent_email TEXT, -- Denormalized for lookup by email (company_email/personal_email from customers)
  
  -- Raw metric data points (0-100 scale, percentage)
  dial_to_connect_rate DECIMAL(5,2) DEFAULT 0,      -- 20% weight - dials → live connects
  appointment_book_rate DECIMAL(5,2) DEFAULT 0,     -- 20% weight - connects → booked
  presentation_rate DECIMAL(5,2) DEFAULT 0,         -- 15% weight - appointments → presentations
  closing_rate DECIMAL(5,2) DEFAULT 0,              -- 25% weight - presentations → sales
  follow_up_consistency DECIMAL(5,2) DEFAULT 0,     -- 10% weight
  lead_quality_score DECIMAL(5,2) DEFAULT 0,        -- 10% weight
  
  -- Computed overall AOI score (0-100)
  aoi_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  
  -- Performance tier (derived: Elite 80+, Strong 60+, Developing 40+, Needs Improvement <40)
  performance_tier TEXT DEFAULT 'needs_improvement',
  
  -- Metadata
  sample_size INTEGER DEFAULT 0,                    -- Number of data points used for calculation
  date_range_start TIMESTAMPTZ,                     -- Start of calculation window
  date_range_end TIMESTAMPTZ,                       -- End of calculation window
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_aoi_score_tracker_associate_id ON aoi_score_tracker(associate_id);
CREATE INDEX IF NOT EXISTS idx_aoi_score_tracker_agent_email ON aoi_score_tracker(agent_email) WHERE agent_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aoi_score_tracker_aoi_score ON aoi_score_tracker(aoi_score DESC);
CREATE INDEX IF NOT EXISTS idx_aoi_score_tracker_updated_at ON aoi_score_tracker(updated_at DESC);

-- Enable RLS (Row Level Security) - users can read their own score
ALTER TABLE aoi_score_tracker ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own row (via associate_id from customers)
-- Note: Backend service role will bypass RLS for writes
CREATE POLICY "Users can read own AOI score" ON aoi_score_tracker
  FOR SELECT
  USING (
    associate_id IN (
      SELECT associate_id FROM customers 
      WHERE company_email = auth.jwt() ->> 'email' 
         OR personal_email = auth.jwt() ->> 'email'
    )
  );

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION aoi_score_tracker_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_aoi_score_tracker_updated_at ON aoi_score_tracker;
CREATE TRIGGER trigger_aoi_score_tracker_updated_at
  BEFORE UPDATE ON aoi_score_tracker
  FOR EACH ROW
  EXECUTE PROCEDURE aoi_score_tracker_updated_at();

-- Function to upsert AOI score (called by backend when recalculating)
CREATE OR REPLACE FUNCTION upsert_aoi_score(
  p_associate_id INTEGER,
  p_agent_email TEXT DEFAULT NULL,
  p_dial_to_connect_rate DECIMAL DEFAULT 0,
  p_appointment_book_rate DECIMAL DEFAULT 0,
  p_presentation_rate DECIMAL DEFAULT 0,
  p_closing_rate DECIMAL DEFAULT 0,
  p_follow_up_consistency DECIMAL DEFAULT 0,
  p_lead_quality_score DECIMAL DEFAULT 0,
  p_sample_size INTEGER DEFAULT 0,
  p_date_range_start TIMESTAMPTZ DEFAULT NULL,
  p_date_range_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS aoi_score_tracker
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_score DECIMAL(5,2);
  v_tier TEXT;
  v_row aoi_score_tracker;
BEGIN
  -- Compute AOI score using same formula as AOIScore.tsx
  v_score := LEAST(100, GREATEST(0,
    (p_dial_to_connect_rate / 50 * 100 * 0.2) +
    (p_appointment_book_rate / 35 * 100 * 0.2) +
    (p_presentation_rate * 0.15) +
    (p_closing_rate / 50 * 100 * 0.25) +
    (p_follow_up_consistency * 0.1) +
    (p_lead_quality_score * 0.1)
  ));
  
  -- Derive performance tier
  v_tier := CASE 
    WHEN v_score >= 80 THEN 'elite'
    WHEN v_score >= 60 THEN 'strong'
    WHEN v_score >= 40 THEN 'developing'
    ELSE 'needs_improvement'
  END;
  
  INSERT INTO aoi_score_tracker (
    associate_id,
    agent_email,
    dial_to_connect_rate,
    appointment_book_rate,
    presentation_rate,
    closing_rate,
    follow_up_consistency,
    lead_quality_score,
    aoi_score,
    performance_tier,
    sample_size,
    date_range_start,
    date_range_end,
    calculated_at,
    updated_at
  ) VALUES (
    p_associate_id,
    COALESCE(p_agent_email, (SELECT COALESCE(company_email, personal_email) FROM customers WHERE associate_id = p_associate_id LIMIT 1)),
    p_dial_to_connect_rate,
    p_appointment_book_rate,
    p_presentation_rate,
    p_closing_rate,
    p_follow_up_consistency,
    p_lead_quality_score,
    v_score,
    v_tier,
    p_sample_size,
    p_date_range_start,
    p_date_range_end,
    NOW(),
    NOW()
  )
  ON CONFLICT (associate_id) DO UPDATE SET
    agent_email = COALESCE(EXCLUDED.agent_email, aoi_score_tracker.agent_email),
    dial_to_connect_rate = EXCLUDED.dial_to_connect_rate,
    appointment_book_rate = EXCLUDED.appointment_book_rate,
    presentation_rate = EXCLUDED.presentation_rate,
    closing_rate = EXCLUDED.closing_rate,
    follow_up_consistency = EXCLUDED.follow_up_consistency,
    lead_quality_score = EXCLUDED.lead_quality_score,
    aoi_score = EXCLUDED.aoi_score,
    performance_tier = EXCLUDED.performance_tier,
    sample_size = EXCLUDED.sample_size,
    date_range_start = EXCLUDED.date_range_start,
    date_range_end = EXCLUDED.date_range_end,
    calculated_at = NOW(),
    updated_at = NOW()
  RETURNING * INTO v_row;
  
  RETURN v_row;
END;
$$;

-- Seed rows for existing customers with associate_id (initial zeros, to be calculated by backend)
-- Uses company_email or personal_email (customers table structure)
INSERT INTO aoi_score_tracker (associate_id, agent_email)
SELECT associate_id, COALESCE(company_email, personal_email)
FROM customers
WHERE associate_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM aoi_score_tracker ast WHERE ast.associate_id = customers.associate_id)
ON CONFLICT (associate_id) DO NOTHING;

-- Comments
COMMENT ON TABLE aoi_score_tracker IS 'Realtime AOI score per associate. Landing page and Dashboard pull from here.';
COMMENT ON COLUMN aoi_score_tracker.dial_to_connect_rate IS 'Percent of dials that reach a live person (20% weight)';
COMMENT ON COLUMN aoi_score_tracker.appointment_book_rate IS 'Percent of connects that book appointments (20% weight)';
COMMENT ON COLUMN aoi_score_tracker.presentation_rate IS 'Percent of appointments that complete presentations (15% weight)';
COMMENT ON COLUMN aoi_score_tracker.closing_rate IS 'Percent of presentations that result in sales (25% weight)';
COMMENT ON COLUMN aoi_score_tracker.follow_up_consistency IS 'Follow-up execution consistency (10% weight)';
COMMENT ON COLUMN aoi_score_tracker.lead_quality_score IS 'Lead qualification accuracy (10% weight)';
COMMENT ON COLUMN aoi_score_tracker.performance_tier IS 'elite|strong|developing|needs_improvement';

SELECT '✅ AOI score tracker table created!' AS status;
