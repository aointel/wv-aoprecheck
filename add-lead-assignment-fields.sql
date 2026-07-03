-- Add fields for lead assignment tracking to masterlead table

-- Add previous_cn_email to track which agent last had this lead
ALTER TABLE masterlead 
ADD COLUMN IF NOT EXISTS previous_cn_email TEXT;

-- Add last_assigned_date to track when lead was last assigned
ALTER TABLE masterlead 
ADD COLUMN IF NOT EXISTS last_assigned_date TIMESTAMP WITH TIME ZONE;

-- Add assigned_date to track when lead was assigned to current agent
ALTER TABLE masterlead 
ADD COLUMN IF NOT EXISTS assigned_date TIMESTAMP WITH TIME ZONE;

-- Add index for faster queries on previous_cn_email
CREATE INDEX IF NOT EXISTS idx_masterlead_previous_cn_email 
ON masterlead(previous_cn_email);

-- Add index for faster queries on last_assigned_date
CREATE INDEX IF NOT EXISTS idx_masterlead_last_assigned_date 
ON masterlead(last_assigned_date);

-- Add index for faster queries on assigned_date
CREATE INDEX IF NOT EXISTS idx_masterlead_assigned_date 
ON masterlead(assigned_date);

COMMENT ON COLUMN masterlead.previous_cn_email IS 'Email of agent who last had this lead before unassignment';
COMMENT ON COLUMN masterlead.last_assigned_date IS 'Date when lead was last unassigned (for 7-day cooldown)';
COMMENT ON COLUMN masterlead.assigned_date IS 'Date when lead was assigned to current agent';

