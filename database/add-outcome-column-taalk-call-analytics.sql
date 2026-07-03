-- Add outcome column: CCPRO disposition derived from transcript AI analysis
-- Maps AI callOutcome (SOLD, CALLBACK, etc.) to Call Connector Pro disposition values

ALTER TABLE taalk_call_analytics
  ADD COLUMN IF NOT EXISTS outcome TEXT;

COMMENT ON COLUMN taalk_call_analytics.outcome IS 'CCPRO disposition (booked, sale, call_back, not_interested, etc.) - derived from transcript AI analysis to match Call Connector Pro';
