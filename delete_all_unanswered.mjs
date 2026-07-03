const SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPA_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

async function supaFetch(path, opts = {}) {
  return fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal', ...(opts.headers||{}) }
  });
}

// Fetch all messages
let all = [], from = 0;
while (true) {
  const r = await supaFetch(`support_messages?select=ticket_id,phone,direction&limit=1000&offset=${from}`);
  const rows = await r.json();
  if (!rows.length) break;
  all = all.concat(rows);
  if (rows.length < 1000) break;
  from += 1000;
}
console.log('Total messages:', all.length);

// Find tickets with no outbound
const tickets = {};
for (const m of all) {
  if (!tickets[m.ticket_id]) tickets[m.ticket_id] = { hasOutbound: false };
  if (m.direction === 'outbound') tickets[m.ticket_id].hasOutbound = true;
}
const toDelete = Object.entries(tickets).filter(([,t]) => !t.hasOutbound).map(([id]) => id).filter(Boolean);
console.log('Threads to delete (no outbound reply):', toDelete.length);

let deleted = 0;
for (let i = 0; i < toDelete.length; i += 50) {
  const batch = toDelete.slice(i, i+50);
  const list = batch.map(id => `"${id}"`).join(',');
  await supaFetch(`support_messages?ticket_id=in.(${list})`, { method: 'DELETE' });
  await supaFetch(`support_tickets?id=in.(${list})`, { method: 'DELETE' });
  deleted += batch.length;
  process.stdout.write('.');
}
console.log(`\nDeleted ${deleted} threads.`);

// Verify final count
const check = await supaFetch('support_messages?select=count', { headers: { Prefer: 'count=exact' } });
console.log('Messages remaining:', check.headers.get('content-range'));
const checkT = await supaFetch('support_tickets?select=count', { headers: { Prefer: 'count=exact' } });
console.log('Tickets remaining:', checkT.headers.get('content-range'));
