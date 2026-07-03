const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
  // Check if hppro_eapp_pending exists at all
  const { data, error } = await sb.from('hppro_eapp_pending').select('*').limit(1);
  console.log('hppro_eapp_pending query:', error ? 'ERROR: ' + error.message : 'OK, rows: ' + (data ? data.length : 0));
  if (data && data.length > 0) console.log('cols:', Object.keys(data[0]).join(', '));

  // Check hppro_presentations for RAMSEY
  const { data: p2, error: e2 } = await sb
    .from('hppro_presentations')
    .select('id, member_first_name, member_last_name, what_happened, raw_payload, created_at')
    .order('created_at', {ascending: false})
    .limit(3);
  console.log('presentations:', e2 ? 'ERROR: ' + e2.message : JSON.stringify(p2));
}
run();
