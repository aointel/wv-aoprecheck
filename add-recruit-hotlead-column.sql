-- Add is_hot_lead to masterleadrecruit for recruit hotlead system (like masterlead.is_hot_lead)
ALTER TABLE masterleadrecruit
  ADD COLUMN IF NOT EXISTS is_hot_lead BOOLEAN DEFAULT false;

COMMENT ON COLUMN masterleadrecruit.is_hot_lead IS 'High-priority recruit candidate (recruit hotlead system)';
