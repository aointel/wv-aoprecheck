-- Add associate_id column to masterlead table
-- This field stores the Associate ID for lead assignment via CSV upload

ALTER TABLE masterlead
ADD COLUMN IF NOT EXISTS associate_id INTEGER;

-- Create index for faster filtering by associate_id
CREATE INDEX IF NOT EXISTS idx_masterlead_associate_id 
ON masterlead(associate_id) 
WHERE associate_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN masterlead.associate_id IS 'Associate ID for lead assignment - updated via CSV upload';
