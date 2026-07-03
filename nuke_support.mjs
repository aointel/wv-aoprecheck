const SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPA_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';
const h = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Prefer: 'return=minimal' };

const r1 = await fetch(`${SUPA_URL}/rest/v1/support_messages?id=not.is.null`, { method: 'DELETE', headers: h });
console.log('support_messages deleted:', r1.status);

const r2 = await fetch(`${SUPA_URL}/rest/v1/support_tickets?id=not.is.null`, { method: 'DELETE', headers: h });
console.log('support_tickets deleted:', r2.status);

// Verify
const c1 = await fetch(`${SUPA_URL}/rest/v1/support_messages?select=count`, { headers: { ...h, Prefer: 'count=exact' } });
const c2 = await fetch(`${SUPA_URL}/rest/v1/support_tickets?select=count`, { headers: { ...h, Prefer: 'count=exact' } });
console.log('Messages remaining:', c1.headers.get('content-range'));
console.log('Tickets remaining:', c2.headers.get('content-range'));
