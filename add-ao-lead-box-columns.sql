-- Add ao_lead_box and ao_lead_box_owners columns to masterlead table
-- These fields are used for the My Leads queue filtering

-- Add ao_lead_box column
ALTER TABLE masterlead
ADD COLUMN IF NOT EXISTS ao_lead_box TEXT;

-- Add ao_lead_box_owners column
ALTER TABLE masterlead
ADD COLUMN IF NOT EXISTS ao_lead_box_owners TEXT;

-- Create indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_masterlead_ao_lead_box 
ON masterlead(ao_lead_box) 
WHERE ao_lead_box IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_masterlead_ao_lead_box_owners 
ON masterlead(ao_lead_box_owners) 
WHERE ao_lead_box_owners IS NOT NULL;

-- Add comments
COMMENT ON COLUMN masterlead.ao_lead_box IS 'Lead pool category for My Leads queue: intown, road-trip, list, lapse';
COMMENT ON COLUMN masterlead.ao_lead_box_owners IS 'Owner email(s) for AO lead boxes - assigned via CSV upload (similar to cn_email but for lead box assignments)';
