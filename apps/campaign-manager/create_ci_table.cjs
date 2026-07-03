const { Client } = require('pg');

const sql = `
CREATE TABLE IF NOT EXISTS call_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vdp_call_id text UNIQUE,
  agent_email text NOT NULL,
  associate_id int,
  call_date timestamptz,
  duration_seconds int,
  cnresolution text,
  intro_score int CHECK (intro_score BETWEEN 1 AND 10),
  converted boolean DEFAULT false,
  outcome_grade text CHECK (outcome_grade IN ('A','B','C','D','F')),
  ai_summary text,
  talk_ratio_estimate float,
  flags text[],
  ai_raw jsonb,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ci_agent_email ON call_intelligence(agent_email);
CREATE INDEX IF NOT EXISTS idx_ci_call_date ON call_intelligence(call_date DESC);
CREATE INDEX IF NOT EXISTS idx_ci_vdp_call_id ON call_intelligence(vdp_call_id);
`;

const c = new Client({
  connectionString: 'postgresql://postgres.ycztjetxwpfgtrzeyytt:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

c.connect()
  .then(() => c.query(sql))
  .then(() => { console.log('✓ call_intelligence table created'); c.end(); })
  .catch(e => { console.error('ERR:', e.message); c.end(); });
