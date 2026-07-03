-- Add meeting link, password, and timezone to meets for virtual meetings and reminder system
-- meeting_link: ties to agent's Zoom URL from profile (https://zoom.us/j/{zoom_id}); password optional
-- scheduled_date is already TIMESTAMPTZ (UTC); timezone stores IANA for conversion when sending reminders

ALTER TABLE meets
  ADD COLUMN IF NOT EXISTS meeting_link TEXT,
  ADD COLUMN IF NOT EXISTS meeting_password TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Los_Angeles';

COMMENT ON COLUMN meets.meeting_link IS 'Virtual meeting URL (e.g. Zoom join link from agent profile)';
COMMENT ON COLUMN meets.meeting_password IS 'Meeting password if required; leave blank if none';
COMMENT ON COLUMN meets.timezone IS 'IANA timezone for this meet (agent scheduling timezone) for reminder conversion';
