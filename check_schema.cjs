const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
  const r1 = await sb.from('hppro_presentations').select('*').limit(1);
  if (r1.error) { console.log('hppro_presentations error:', r1.error.message); }
  else if (r1.data && r1.data[0]) { console.log('hppro_presentations cols:', Object.keys(r1.data[0]).join(', ')); }
  else { console.log('hppro_presentations: empty'); }

  const r2 = await sb.from('hppro_eapp_pending').select('*').limit(5).order('created_at', {ascending:false});
  if (r2.error) { console.log('hppro_eapp_pending error:', r2.error.message); }
  else if (r2.data && r2.data.length > 0) {
    console.log('hppro_eapp_pending cols:', Object.keys(r2.data[0]).join(', '));
    console.log('recent rows:', r2.data.map(r => r.presentation_guid + ' consumed=' + r.consumed_at).join('\n'));
  } else { console.log('hppro_eapp_pending: empty'); }
}
run();
