-- Safe migration: Create recruit_candidates table with all columns
-- This script checks if columns exist before adding them
-- Run this in Supabase SQL Editor

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.recruit_candidates (
  id SERIAL PRIMARY KEY
);

-- Add columns if they don't exist
DO $$ 
BEGIN
  -- Basic candidate information
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'first_name') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN first_name TEXT NOT NULL DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'last_name') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN last_name TEXT NOT NULL DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'phone') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN phone TEXT NOT NULL DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'email') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN email TEXT NOT NULL DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'city') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN city TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'state') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN state TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'zip_code') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN zip_code TEXT;
  END IF;
  
  -- Recruitment specific fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'status') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'position') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN position TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'experience') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN experience TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'rating') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN rating DECIMAL(3,1);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'notes') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN notes TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'ai_summary') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN ai_summary TEXT;
  END IF;
  
  -- Agent information
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'agent_id') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN agent_id TEXT NOT NULL DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'agent_email') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN agent_email TEXT NOT NULL DEFAULT '';
  END IF;
  
  -- Appointment scheduling
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'appointment_date') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN appointment_date TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'appointment_notes') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN appointment_notes TEXT;
  END IF;
  
  -- Stage tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'current_stage_id') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN current_stage_id INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'stage_entered_at') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN stage_entered_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  -- Timestamps
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'created_at') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruit_candidates' AND column_name = 'updated_at') THEN
    ALTER TABLE public.recruit_candidates ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Create indexes for better query performance (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_recruit_candidates_agent_email ON public.recruit_candidates(agent_email);
CREATE INDEX IF NOT EXISTS idx_recruit_candidates_agent_id ON public.recruit_candidates(agent_id);
CREATE INDEX IF NOT EXISTS idx_recruit_candidates_status ON public.recruit_candidates(status);
CREATE INDEX IF NOT EXISTS idx_recruit_candidates_current_stage_id ON public.recruit_candidates(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_recruit_candidates_phone ON public.recruit_candidates(phone);
CREATE INDEX IF NOT EXISTS idx_recruit_candidates_email ON public.recruit_candidates(email);
CREATE INDEX IF NOT EXISTS idx_recruit_candidates_created_at ON public.recruit_candidates(created_at DESC);

-- Create unique constraint on phone + agent_email to prevent duplicates (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_recruit_candidates_phone_agent_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_recruit_candidates_phone_agent_unique 
    ON public.recruit_candidates(phone, agent_email);
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE public.recruit_candidates IS 'Stores candidate information for AO Recruit Call Connector Pro';
COMMENT ON COLUMN public.recruit_candidates.status IS 'Candidate status: new, contacted, interview, pending, hired, rejected';
COMMENT ON COLUMN public.recruit_candidates.ai_summary IS 'AI-generated summary from screening call (can be JSON or plain text)';
COMMENT ON COLUMN public.recruit_candidates.current_stage_id IS 'Current pipeline stage ID for the candidate';
COMMENT ON COLUMN public.recruit_candidates.agent_email IS 'Email of the agent who owns/manages this candidate';

