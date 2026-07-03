-- Add ao_lead_box column to masterlead table
-- This field categorizes leads into different pools for the "My Leads" queue
-- Values: 'intown', 'road-trip', 'list', 'lapse', or NULL

ALTER TABLE masterlead
ADD COLUMN IF NOT EXISTS ao_lead_box TEXT;

-- Create index for faster filtering by lead pool
CREATE INDEX IF NOT EXISTS idx_masterlead_ao_lead_box 
ON masterlead(ao_lead_box) 
WHERE ao_lead_box IS NOT NULL;

-- Add comment
COMMENT ON COLUMN masterlead.ao_lead_box IS 'Lead pool category for My Leads queue: intown, road-trip, list, lapse';
