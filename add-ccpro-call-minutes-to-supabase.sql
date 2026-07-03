-- Add missing ccpro_call_minutes column to Supabase weekly_usage_stats table

ALTER TABLE weekly_usage_stats
ADD COLUMN IF NOT EXISTS ccpro_call_minutes INTEGER DEFAULT 0;

COMMENT ON COLUMN weekly_usage_stats.ccpro_call_minutes IS 'Total minutes spent on Call Connector Pro calls';
