/**
 * Run Supabase migration via the REST management API
 * Project ref: ycztjetxwpfgtrzeyytt
 */
const https = require('https');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcxNzQwMzcsImV4cCI6MjA1Mjc1MDAzN30.E0gNaQyQUhfN2I8XfdNVEViVv90HxKZS4Rcwcq19ldc';

// Try via Supabase RPC - create a temporary stored procedure to run DDL
const sql = `
alter table hppro_presentations add column if not exists presentation_guid uuid;
alter table hppro_presentations add column if not exists raw_payload jsonb;
alter table hppro_presentations add column if not exists agent_number text;
alter table hppro_presentations add column if not exists agent_user_id int;
alter table hppro_presentations add column if not exists synced_at timestamptz;
alter table hppro_presentations add column if not exists state_id int;
alter table hppro_presentations add column if not exists total_alp numeric;
alter table hppro_presentations add column if not exists total_ahp numeric;
alter table hppro_presentations add column if not exists is_senior boolean;
alter table hppro_presentations add column if not exists plan_options jsonb;
alter table hppro_presentations add column if not exists basic_info jsonb;
alter table hppro_presentations add column if not exists premium_plan jsonb;
alter table hppro_presentations add column if not exists what_happened text;
alter table hppro_presentations add column if not exists is_sale boolean default false;
alter table hppro_presentations add column if not exists lead_id int;
alter table hppro_presentations add column if not exists group_id int;
alter table hppro_presentations add column if not exists general_questions jsonb;
alter table hppro_presentations add column if not exists medical_answers jsonb;
alter table hppro_presentations add column if not exists need_analysis_items jsonb;
`;

async function post(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  // Try each ALTER separately
  const stmts = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  
  for (const stmt of stmts) {
    // Use the REST API query endpoint
    const r = await post(
      `${SUPABASE_URL}/rest/v1/rpc/exec`,
      {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
      { query: stmt }
    );
    console.log(stmt.substring(0, 60) + '...');
    console.log('  →', r.status, r.body.substring(0, 100));
  }
}

run().catch(console.error);
