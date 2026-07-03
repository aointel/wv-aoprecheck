-- Add aointel boolean column to masterlead table
-- This allows any lead to be marked as AOIntel regardless of market/resolution

ALTER TABLE masterlead 
ADD COLUMN IF NOT EXISTS aointel BOOLEAN DEFAULT FALSE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_masterlead_aointel ON masterlead(aointel) WHERE aointel = true;

-- Update existing leads with cnresolution='AOintel' or 'AOIntel' or 'aointel' to set aointel=true
UPDATE masterlead 
SET aointel = true 
WHERE LOWER(cnresolution) = 'aointel' 
   OR cnresolution = 'AOIntel' 
   OR cnresolution = 'AOintel';

-- Verify the update
SELECT COUNT(*) as total_aointel_leads 
FROM masterlead 
WHERE aointel = true;

