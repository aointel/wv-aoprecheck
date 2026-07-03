DELETE FROM taalk_call_analytics WHERE call_date < NOW() - INTERVAL '24 hours';
DELETE FROM twilio_call_logs WHERE COALESCE(call_started_at, created_at) < NOW() - INTERVAL '24 hours';
