-- Create VDP Webhook Events table in Supabase
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.vdp_webhook_events (
    id bigserial PRIMARY KEY,
    event_date text NOT NULL,
    event_time text NOT NULL,
    event_type text NOT NULL,
    phone_number text,
    agent_id text,
    lead_id text,
    event_params text,
    raw_webhook_data jsonb,
    created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_vdp_webhook_events_date ON public.vdp_webhook_events(event_date);
CREATE INDEX IF NOT EXISTS idx_vdp_webhook_events_type ON public.vdp_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_vdp_webhook_events_agent ON public.vdp_webhook_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_vdp_webhook_events_phone ON public.vdp_webhook_events(phone_number);
CREATE INDEX IF NOT EXISTS idx_vdp_webhook_events_lead_id ON public.vdp_webhook_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_vdp_webhook_events_created ON public.vdp_webhook_events(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.vdp_webhook_events ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust as needed for security)
CREATE POLICY "Enable all operations for vdp_webhook_events" ON public.vdp_webhook_events
FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.vdp_webhook_events TO authenticated;
GRANT ALL ON public.vdp_webhook_events TO service_role;

-- Test insertion to verify table works
INSERT INTO public.vdp_webhook_events (
    event_date,
    event_time,
    event_type,
    phone_number,
    agent_id,
    event_params,
    raw_webhook_data,
    created_at
) VALUES (
    '2025-09-06',
    '21:45:00',
    'TABLE_CREATION_TEST',
    '+15551234567',
    'TABLE_AGENT',
    '{"test":"table_created"}',
    '{"source":"sql_setup"}',
    now()
);

-- Verify the table was created and data inserted
SELECT * FROM public.vdp_webhook_events WHERE event_type = 'TABLE_CREATION_TEST';