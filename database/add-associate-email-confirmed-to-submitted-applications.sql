-- Add associate_id, company_email, and confirmed columns to submitted_applications table

ALTER TABLE submitted_applications
  ADD COLUMN IF NOT EXISTS associate_id INTEGER,
  ADD COLUMN IF NOT EXISTS company_email TEXT,
  ADD COLUMN IF NOT EXISTS confirmed BOOLEAN DEFAULT FALSE;

-- Create index on associate_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_submitted_applications_associate_id ON submitted_applications(associate_id);

-- Create index on company_email for faster lookups
CREATE INDEX IF NOT EXISTS idx_submitted_applications_company_email ON submitted_applications(company_email);

-- Create index on confirmed for filtering
CREATE INDEX IF NOT EXISTS idx_submitted_applications_confirmed ON submitted_applications(confirmed);

COMMENT ON COLUMN submitted_applications.associate_id IS 'Associate ID linked to the submitted application';
COMMENT ON COLUMN submitted_applications.company_email IS 'Company email associated with the submitted application';
COMMENT ON COLUMN submitted_applications.confirmed IS 'Yes/No flag indicating if the submitted application is confirmed';
