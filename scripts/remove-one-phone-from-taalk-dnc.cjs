/**
 * Add or remove one phone from Taalk company + FTC DNC. Uses db param.
 * PATCH body: { "10-digit": true } to add, { "10-digit": false } to remove.
 * Run: node AOIrail/scripts/remove-one-phone-from-taalk-dnc.cjs [add|remove] <phone>
 * Example: node scripts/remove-one-phone-from-taalk-dnc.cjs add 8047219548
 *          node scripts/remove-one-phone-from-taalk-dnc.cjs 8047219548  (remove)
 */

const TAALK_API_KEY = process.env.TAALK_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4';
const LETS_BASE = 'https://lets.taalk.ai/api';
const DB = process.env.TAALK_DB || 'michaelmandella';

/** Always return 10-digit string (strip leading 1 if 11 digits). */
function digits(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  return d;
}

function e164(phone) {
  const d = digits(phone);
  return d ? '+1' + d : '';
}

const HEADERS = {
  'Authorization': 'Bearer ' + TAALK_API_KEY,
  'Content-Type': 'application/json',
  'x-app-db': DB,
};

async function getDncStatus(phone) {
  const url = `${LETS_BASE}/dnc/${encodeURIComponent(phone)}`;
  const r = await fetch(url, { headers: { ...HEADERS } });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, payload: j.payload || j };
}

async function patchDnc(path, body) {
  const url = `${LETS_BASE}${path}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  return { status: r.status, ok: r.ok, payload };
}

async function main() {
  const arg1 = process.argv[2];
  const arg2 = process.argv[3];
  const isAdd = arg1 === 'add' || arg2 === 'add';
  const phone = (arg1 === 'add' ? arg2 : arg1) || (arg2 === 'add' ? arg1 : null) || '8047219548';
  const d = digits(phone);
  const e = e164(phone);
  if (!d) {
    console.error('Usage: node remove-one-phone-from-taalk-dnc.cjs [add|remove] <phone>');
    process.exit(1);
  }

  console.log('Mode:', isAdd ? 'ADD to DNC' : 'REMOVE from DNC');
  console.log('Phone:', phone, '| digits:', d, '| E.164:', e);
  console.log('DB param:', DB, '\n');

  console.log('--- Current DNC status ---');
  const before = await getDncStatus(d);
  console.log('GET /dnc/' + d, before);

  const value = isAdd;
  const body = { [d]: value };

  console.log('\n--- PATCH /dnc/OUT/local (company DNC) { "10-digit": ' + value + ' } ---');
  const local1 = await patchDnc('/dnc/OUT/local', body);
  console.log(JSON.stringify(body), '->', local1.status, local1.payload);

  if (isAdd) {
    console.log('\n--- PATCH /dnc/OUT/ftc { "10-digit": ' + value + ' } ---');
    const ftc1 = await patchDnc('/dnc/OUT/ftc', body);
    console.log(JSON.stringify(body), '->', ftc1.status, ftc1.payload);
  } else {
    console.log('\n(Skipping FTC PATCH on remove — API cannot clear federal DNC; only company/local is removed.)');
  }

  console.log('\n--- DNC status after (GET) ---');
  const after = await getDncStatus(d);
  console.log('GET /dnc/' + d, after);

  if (!isAdd && after.payload && (after.payload[d] === 2 || after.payload[d] === 1)) {
    console.log('\nNote: Response still shows blocked (1=company, 2=FTC). If 2 persists, the number may be on the federal DNC registry; Taalk may not allow API removal for that. Try removing in Taalk UI or contact Taalk support.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
