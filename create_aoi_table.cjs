const { createClient } = require('@supabase/supabase-js');
// Use anon key for REST since service key is sb_secret format
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcxNzQwMzcsImV4cCI6MjA1Mjc1MDAzN30.E0gNaQyQUhfN2I8XfdNVEViVv90HxKZS4Rcwcq19ldc';
const SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
  // Probe
  const { data, error } = await sb.from('aoi_applications').select('id').limit(1);
  if (!error) {
    console.log('Table exists! rows:', data?.length || 0);
    return;
  }
  console.log('Table missing:', error.message);
  console.log('\n--- PASTE THIS IN SUPABASE SQL EDITOR ---');
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
  updated_at timestamptz default now()
);

-- Upsert key: agent + optional guid
create unique index if not exists aoi_apps_uq 
  on aoi_applications(agent_email, coalesce(presentation_guid,''));
`);
}
run();
