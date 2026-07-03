import pg from 'pg';
const { Pool } = pg;

const connectionString = 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString });

const sql = `
CREATE TABLE IF NOT EXISTS public.recruitmasterlead (
  id bigserial PRIMARY KEY,
  taalk_lead_id text UNIQUE,
  first_name text,
  last_name text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  zip text,
  taalk_market text DEFAULT 'aorecruit',
  taalk_state text,
  taalk_city text,
  taalk_email text,
  taalk_lead_source text,
  taalk_group_code text,
  taalk_groupname text,
  taalk_sponsor_org text,
  taalk_beneficiary text,
  taalk_relationship text,
  taalk_reffered text,
  cn_email text,
  cnresolution text DEFAULT 'pending',
  is_hot_lead boolean DEFAULT true,
  priority_score integer DEFAULT 6,
  hot_lead_reason text,
  call_duration integer,
  transfer_status text,
  dnc boolean DEFAULT false,
  last_contacted timestamptz,
  assigned_at timestamptz,
  "TaalkResolve" boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recruitmasterlead_cn_email ON public.recruitmasterlead(cn_email);
CREATE INDEX IF NOT EXISTS idx_recruitmasterlead_cnresolution ON public.recruitmasterlead(cnresolution);
CREATE INDEX IF NOT EXISTS idx_recruitmasterlead_taalk_lead_id ON public.recruitmasterlead(taalk_lead_id);
CREATE INDEX IF NOT EXISTS idx_recruitmasterlead_updated_at ON public.recruitmasterlead(updated_at DESC);
`;

try {
  await pool.query(sql);
  console.log('✅ recruitmasterlead table created');
  const { rows } = await pool.query("SELECT COUNT(*) as cnt FROM information_schema.columns WHERE table_name = 'recruitmasterlead'");
  console.log('✅ Columns:', rows[0].cnt);
} catch(e) {
  console.error('❌', e.message);
} finally {
  pool.end();
}
