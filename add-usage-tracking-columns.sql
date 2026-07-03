-- Add usage tracking columns to weekly_usage_stats table
-- Tracks VDP available time and Call Connector Pro call time

ALTER TABLE weekly_usage_stats
ADD COLUMN IF NOT EXISTS vdp_available_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ccpro_call_minutes INTEGER DEFAULT 0;

COMMENT ON COLUMN weekly_usage_stats.vdp_available_minutes IS 'Total minutes VDP was available (toggle ON)';
COMMENT ON COLUMN weekly_usage_stats.ccpro_call_minutes IS 'Total minutes spent on Call Connector Pro calls';
