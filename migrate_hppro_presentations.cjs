/**
 * Add missing columns to hppro_presentations for the new capture schema
 * and create hppro_eapp_pending if needed.
 */
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// We need to use Supabase SQL editor or direct postgres for DDL.
// Since we only have the JS client, we can check what columns exist
// and use the rpc endpoint if available.

async function checkCols(table) {
  const { data, error } = await sb.from(table).select('*').limit(0);
  if (error) return { error: error.message };
  return { ok: true };
}

async function run() {
  console.log('Checking tables...');

  // hppro_eapp_pending
  const p = await checkCols('hppro_eapp_pending');
  console.log('hppro_eapp_pending:', JSON.stringify(p));

  // Try inserting a test row to see which columns exist
  const { error: testErr } = await sb.from('hppro_eapp_pending').select('id, agent_email, presentation_guid, inject_payload, what_happened, consumed_at, created_at').limit(0);
  if (testErr) {
    console.log('Missing columns in hppro_eapp_pending:', testErr.message);
    console.log('\nRun this SQL in Supabase SQL Editor:\n');
    console.log(`
-- Create hppro_eapp_pending if not exists
create table if not exists hppro_eapp_pending (
  id bigserial primary key,
  agent_email text not null,
  presentation_guid text not null,
  inject_payload jsonb,
  what_happened text,
  consumed_at timestamptz,
  created_at timestamptz default now(),
  unique (agent_email, presentation_guid)
);

-- Add missing columns to hppro_presentations  
alter table hppro_presentations add column if not exists presentation_guid text unique;
alter table hppro_presentations add column if not exists raw_payload jsonb;
alter table hppro_presentations add column if not exists lead_id_str text;
alter table hppro_presentations add column if not exists agent_number text;
alter table hppro_presentations add column if not exists agent_user_id int;
alter table hppro_presentations add column if not exists synced_at timestamptz;
alter table hppro_presentations add column if not exists state_id int;
alter table hppro_presentations add column if not exists total_alp numeric;
alter table hppro_presentations add column if not exists total_ahp numeric;
alter table hppro_presentations add column if not exists is_senior boolean;
alter table hppro_presentations add column if not exists plan_options jsonb;
alter table hppro_presentations add column if not exists basic_info jsonb;
`);
  } else {
    console.log('hppro_eapp_pending columns OK');
  }
}
run();
