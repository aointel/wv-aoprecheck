const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
  // Check hppro_presentations for recent rows
  const { data: pres, error: e1 } = await sb.from('hppro_presentations').select('*').order('created_at', {ascending:false}).limit(5);
  if (e1) { console.log('pres error:', e1.message); }
  else { console.log('hppro_presentations recent:', JSON.stringify(pres.map(r => ({id:r.id, what:r.what_happened, raw: !!r.raw_payload})))); }

  // Check hppro_eapp_pending
  const { data: pend, error: e2 } = await sb.from('hppro_eapp_pending').select('id, agent_email, presentation_guid, consumed_at, created_at').order('created_at', {ascending:false}).limit(5);
  if (e2) { console.log('pending error:', e2.message); }
  else { console.log('hppro_eapp_pending:', JSON.stringify(pend)); }
}
run();
