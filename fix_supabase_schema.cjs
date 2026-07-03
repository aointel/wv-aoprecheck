/**
 * Fix hppro_presentations schema and test the full capture pipeline.
 * Uses Supabase REST API to run the migration.
 */
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
  console.log('Checking hppro_presentations columns...');
  
  // Probe for presentation_guid column
  const { data, error } = await sb.from('hppro_presentations').select('id, presentation_guid, raw_payload').limit(1);
  
  if (error && error.message.includes('presentation_guid')) {
    console.log('MISSING presentation_guid column - need SQL migration');
    console.log('\n=== RUN THIS IN SUPABASE SQL EDITOR ===');
    console.log(`
-- Fix hppro_presentations for capture
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

create unique index if not exists hppro_pres_guid_idx 
  on hppro_presentations(presentation_guid) 
  where presentation_guid is not null;

-- Also create aoi_applications if not exists
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
create unique index if not exists aoi_apps_uq 
  on aoi_applications(agent_email, coalesce(presentation_guid,''));
`);
    return;
  }
  
  if (error) {
    console.log('Error:', error.message);
    return;
  }
  
  console.log('hppro_presentations has presentation_guid ✓');
  console.log('Sample row:', JSON.stringify(data?.[0] || 'empty'));
  
  // Check hppro_eapp_pending
  const { data: pend, error: pe } = await sb.from('hppro_eapp_pending').select('*').limit(3).order('created_at', {ascending: false});
  if (pe) { console.log('hppro_eapp_pending error:', pe.message); }
  else { console.log('hppro_eapp_pending rows:', pend?.length, JSON.stringify(pend?.map(r => ({ id: r.id, agent: r.agent_email, guid: r.presentation_guid, has_payload: !!r.inject_payload })))); }
  
  // Check aoi_applications
  const { data: apps, error: ae } = await sb.from('aoi_applications').select('*').limit(1);
  if (ae) { console.log('aoi_applications missing:', ae.message); }
  else { console.log('aoi_applications exists, rows:', apps?.length); }
}

run().catch(console.error);
