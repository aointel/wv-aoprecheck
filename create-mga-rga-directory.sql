-- Create MGA/RGA Directory table
-- This is the master reference for all MGAs and RGAs with their associate IDs

CREATE TABLE IF NOT EXISTS public.mga_rga_directory (
  id SERIAL PRIMARY KEY,
  associate_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('MGA', 'RGA', 'BOTH')),
  
  -- Markets they manage
  aoi_market TEXT,
  ao_market_2 TEXT,
  designated_market TEXT,
  
  -- Hierarchy - if this MGA/RGA reports to another RGA
  reports_to_rga_id INTEGER,
  reports_to_rga_name TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_mga_rga_associate_id UNIQUE (associate_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_mga_rga_name ON mga_rga_directory(UPPER(name));
CREATE INDEX IF NOT EXISTS idx_mga_rga_email ON mga_rga_directory(email);
CREATE INDEX IF NOT EXISTS idx_mga_rga_role ON mga_rga_directory(role);
CREATE INDEX IF NOT EXISTS idx_mga_rga_reports_to ON mga_rga_directory(reports_to_rga_id);

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_mga_rga_directory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mga_rga_directory_updated_at
  BEFORE UPDATE ON mga_rga_directory
  FOR EACH ROW
  EXECUTE FUNCTION update_mga_rga_directory_updated_at();

-- Add comment to table
COMMENT ON TABLE mga_rga_directory IS 'Master directory of all MGAs and RGAs with their associate IDs for hierarchy lookups';

