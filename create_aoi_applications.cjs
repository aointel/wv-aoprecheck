/**
 * Create aoi_applications table in Supabase for persisting AOI Application wizard state.
 * Keyed by agent_email + presentation_guid (or agent_email alone as fallback).
 */
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
  // Test if table already exists
  const { data, error } = await sb.from('aoi_applications').select('id').limit(1);
  if (!error) {
    console.log('aoi_applications table already exists');
    if (data && data.length > 0) console.log('  has', data.length, 'rows');
    else console.log('  empty');
    return;
  }
  // Table doesn't exist - need to create it via SQL
  console.log('aoi_applications does not exist:', error.message);
  console.log('\nRun this SQL in Supabase Dashboard SQL Editor:');
  console.log(`
create table if not exists aoi_applications (
  id bigserial primary key,
  agent_email text not null,
  presentation_guid text,
  wizard_state jsonb not null default '{}',
  step text,
  completed_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (agent_email, presentation_guid)
);

-- Allow upsert by agent_email only (no guid) as fallback
create unique index if not exists aoi_apps_agent_only_idx 
  on aoi_applications(agent_email) 
  where presentation_guid is null;
`);
}
run();
