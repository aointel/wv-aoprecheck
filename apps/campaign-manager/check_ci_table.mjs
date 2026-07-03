const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const r = await fetch(`${SUPABASE_URL}/rest/v1/call_intelligence?limit=1`, {
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
});
console.log('Status:', r.status);
const body = await r.text();
console.log('Body:', body.slice(0, 200));
