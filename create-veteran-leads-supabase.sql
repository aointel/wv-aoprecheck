-- Create veteran_leads table in Supabase for production
CREATE TABLE IF NOT EXISTS public.veteran_leads (
  id SERIAL PRIMARY KEY,
  user_email TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  status TEXT DEFAULT 'pending',
  call_attempts INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  taalk_market TEXT DEFAULT 'Veteran',
  taalk_state TEXT,
  taalk_lead_id TEXT,
  taalk_group_code TEXT,
  taalk_email TEXT,
  taalk_lead_source TEXT,
  taalk_sponsor_org TEXT,
  taalk_referred TEXT,
  taalk_relationship TEXT,
  taalk_secret_key TEXT,
  taalk_city TEXT,
  taalk_zip TEXT,
  taalk_address TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_veteran_leads_user_email ON public.veteran_leads(user_email);
CREATE INDEX IF NOT EXISTS idx_veteran_leads_phone ON public.veteran_leads(phone);
CREATE INDEX IF NOT EXISTS idx_veteran_leads_taalk_market ON public.veteran_leads(taalk_market);
CREATE INDEX IF NOT EXISTS idx_veteran_leads_state ON public.veteran_leads(state);

-- Enable RLS (Row Level Security)
ALTER TABLE public.veteran_leads ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to allow access
CREATE POLICY "Allow authenticated access to veteran_leads" ON public.veteran_leads
  FOR ALL USING (true);