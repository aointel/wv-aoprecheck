-- Create recruit_candidates table for AO Recruit Call Connector Pro
-- This table stores candidate information for the recruitment process

CREATE TABLE IF NOT EXISTS public.recruit_candidates (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  -- Recruitment specific fields
  status TEXT NOT NULL DEFAULT 'new', -- new, contacted, interview, pending, hired, rejected
  position TEXT, -- Position they're applying for
  experience TEXT, -- Years of experience
  rating DECIMAL(3,1), -- 1-5 rating
  notes TEXT, -- Notes about the candidate
  ai_summary TEXT, -- AI-generated summary from screening call
  -- Agent who added this candidate
  agent_id TEXT NOT NULL,
  agent_email TEXT NOT NULL,
  -- Appointment scheduling
  appointment_date TIMESTAMP WITH TIME ZONE,
  appointment_notes TEXT,
  -- Stage tracking
  current_stage_id INTEGER,
  stage_entered_at TIMESTAMP WITH TIME ZONE,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_recruit_candidates_agent_email ON public.recruit_candidates(agent_email);
CREATE INDEX IF NOT EXISTS idx_recruit_candidates_agent_id ON public.recruit_candidates(agent_id);
CREATE INDEX IF NOT EXISTS idx_recruit_candidates_status ON public.recruit_candidates(status);
CREATE INDEX IF NOT EXISTS idx_recruit_candidates_current_stage_id ON public.recruit_candidates(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_recruit_candidates_phone ON public.recruit_candidates(phone);
CREATE INDEX IF NOT EXISTS idx_recruit_candidates_email ON public.recruit_candidates(email);
CREATE INDEX IF NOT EXISTS idx_recruit_candidates_created_at ON public.recruit_candidates(created_at DESC);

-- Create unique constraint on phone + agent_email to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_recruit_candidates_phone_agent_unique 
ON public.recruit_candidates(phone, agent_email);

-- Add comments for documentation
COMMENT ON TABLE public.recruit_candidates IS 'Stores candidate information for AO Recruit Call Connector Pro';
COMMENT ON COLUMN public.recruit_candidates.status IS 'Candidate status: new, contacted, interview, pending, hired, rejected';
COMMENT ON COLUMN public.recruit_candidates.ai_summary IS 'AI-generated summary from screening call (can be JSON or plain text)';
COMMENT ON COLUMN public.recruit_candidates.current_stage_id IS 'Current pipeline stage ID for the candidate';
COMMENT ON COLUMN public.recruit_candidates.agent_email IS 'Email of the agent who owns/manages this candidate';

