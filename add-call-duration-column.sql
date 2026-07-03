-- Add call_duration column to taalk_call_analytics table
ALTER TABLE taalk_call_analytics 
ADD COLUMN IF NOT EXISTS call_duration INTEGER;

COMMENT ON COLUMN taalk_call_analytics.call_duration IS 'Call duration in seconds';
