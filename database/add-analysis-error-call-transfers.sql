-- Add analysis_error to call_analytics_transfers so UI can show failure reason
-- (synced from taalk_call_analytics.analysis_error)

ALTER TABLE call_analytics_transfers ADD COLUMN IF NOT EXISTS analysis_error TEXT;
COMMENT ON COLUMN call_analytics_transfers.analysis_error IS 'Failure reason when analysis_status=failed. Synced from taalk_call_analytics.';
