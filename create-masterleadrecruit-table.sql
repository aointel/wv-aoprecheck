-- Create masterleadrecruit table for recruit candidate queue/assignment system
-- This mirrors the masterlead table structure but for recruit candidates
-- Links to recruit_candidates via candidate_id

CREATE TABLE IF NOT EXISTS masterleadrecruit (
  id SERIAL PRIMARY KEY,
  -- Link to source candidate record
  candidate_id INTEGER REFERENCES recruit_candidates(id) ON DELETE CASCADE,
  
  -- Basic candidate info (denormalized for performance)
  first_name TEXT,
  last_name TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  address TEXT,
  
  -- Assignment and status tracking (same as masterlead)
  cn_email TEXT, -- Assigned agent email (NULL = unassigned)
  cnresolution TEXT DEFAULT 'pending', -- Status: pending, called, booked, etc.
  assigned_date TIMESTAMP, -- When candidate was assigned to agent
  previous_cn_email TEXT, -- Previous agent assignment (for rotation)
  last_assigned_date TIMESTAMP, -- Last assignment timestamp
  currently_calling BOOLEAN DEFAULT false, -- Flag for active calls
  
  -- Call tracking
  last_contacted TIMESTAMP,
  dnc BOOLEAN DEFAULT false, -- Do Not Call flag
  
  -- Market/context
  market TEXT DEFAULT 'aorecruit', -- Always 'aorecruit' for recruit candidates
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT unique_candidate_phone UNIQUE (phone)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_masterleadrecruit_cn_email ON masterleadrecruit(cn_email);
CREATE INDEX IF NOT EXISTS idx_masterleadrecruit_cnresolution ON masterleadrecruit(cnresolution);
CREATE INDEX IF NOT EXISTS idx_masterleadrecruit_candidate_id ON masterleadrecruit(candidate_id);
CREATE INDEX IF NOT EXISTS idx_masterleadrecruit_phone ON masterleadrecruit(phone);
CREATE INDEX IF NOT EXISTS idx_masterleadrecruit_market ON masterleadrecruit(market);
CREATE INDEX IF NOT EXISTS idx_masterleadrecruit_assigned_date ON masterleadrecruit(assigned_date);

-- Add comments
COMMENT ON TABLE masterleadrecruit IS 'Queue/assignment system for recruit candidates (mirrors masterlead structure)';
COMMENT ON COLUMN masterleadrecruit.candidate_id IS 'Foreign key to recruit_candidates.id - links to source candidate record';
COMMENT ON COLUMN masterleadrecruit.cn_email IS 'Assigned agent email (NULL = unassigned, same as masterlead.cn_email)';
COMMENT ON COLUMN masterleadrecruit.cnresolution IS 'Call status: pending, called, booked, interview, rejected, etc.';
COMMENT ON COLUMN masterleadrecruit.market IS 'Always "aorecruit" for recruit candidates';
