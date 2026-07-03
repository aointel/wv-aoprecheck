-- Create VDP calls table in Supabase to receive webhook events
CREATE TABLE IF NOT EXISTS public.vdp_calls (
    id bigserial PRIMARY KEY,
    date text,
    time text,
    event text,
    phone text,
    agent text,
    params text,
    created_at timestamp with time zone DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_vdp_calls_date ON public.vdp_calls(date);
CREATE INDEX IF NOT EXISTS idx_vdp_calls_event ON public.vdp_calls(event);
CREATE INDEX IF NOT EXISTS idx_vdp_calls_phone ON public.vdp_calls(phone);
CREATE INDEX IF NOT EXISTS idx_vdp_calls_agent ON public.vdp_calls(agent);
CREATE INDEX IF NOT EXISTS idx_vdp_calls_created_at ON public.vdp_calls(created_at);

-- Add unique constraint to prevent duplicates
ALTER TABLE public.vdp_calls 
ADD CONSTRAINT unique_vdp_call_supabase 
UNIQUE (date, time, event, phone, agent);

-- Enable Row Level Security (RLS)
ALTER TABLE public.vdp_calls ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust as needed for security)
CREATE POLICY "Enable all operations for vdp_calls" ON public.vdp_calls
FOR ALL USING (true) WITH CHECK (true);