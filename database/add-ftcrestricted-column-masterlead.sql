-- Add FTCRESTRICTED column to masterlead (optional - for FTC queue cleaner)
-- Run this if you want the FTC queue cleaner to restrict leads outside 8 AM - 9 PM local time

ALTER TABLE masterlead 
ADD COLUMN IF NOT EXISTS FTCRESTRICTED TEXT DEFAULT NULL;

COMMENT ON COLUMN masterlead.FTCRESTRICTED IS 'FTC calling hours: YES = outside hours (restricted), NO = callable';
