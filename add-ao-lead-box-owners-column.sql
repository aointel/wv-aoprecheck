-- Add ao_lead_box_owners column to masterlead table
-- This field stores the owner email(s) for AO lead boxes (similar to cn_email but specifically for lead box assignments)
-- Used when uploading CSV files to assign leads to specific owners

ALTER TABLE masterlead
ADD COLUMN IF NOT EXISTS ao_lead_box_owners TEXT;

-- Create index for faster filtering by lead box owners
CREATE INDEX IF NOT EXISTS idx_masterlead_ao_lead_box_owners 
ON masterlead(ao_lead_box_owners) 
WHERE ao_lead_box_owners IS NOT NULL;

-- Add comment
COMMENT ON COLUMN masterlead.ao_lead_box_owners IS 'Owner email(s) for AO lead boxes - assigned via CSV upload (similar to cn_email but for lead box assignments)';
