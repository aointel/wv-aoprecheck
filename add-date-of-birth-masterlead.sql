-- Add date_of_birth column to masterlead table (text field for display/capture)
ALTER TABLE masterlead
ADD COLUMN IF NOT EXISTS date_of_birth TEXT;

COMMENT ON COLUMN masterlead.date_of_birth IS 'Lead date of birth (text field for display and capture)';
