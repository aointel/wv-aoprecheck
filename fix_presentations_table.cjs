/**
 * Add missing columns to hppro_presentations via Supabase SQL RPC.
 */
const https = require('https');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const sql = `
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
alter table hppro_presentations add column if not exists what_happened_string text;
alter table hppro_presentations add column if not exists presented_group_id int;
alter table hppro_presentations add column if not exists premium_plan jsonb;
create unique index if not exists hppro_presentations_guid_idx on hppro_presentations(presentation_guid) where presentation_guid is not null;
`;

const body = JSON.stringify({ query: sql });
const url = new URL('/rest/v1/rpc/exec_sql', SUPABASE_URL);

const req = https.request({
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
    'Content-Length': Buffer.byteLength(body),
  }
}, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => console.log(`${res.statusCode}: ${data.substring(0,500)}`));
});
req.on('error', e => console.error(e.message));
req.write(body);
req.end();
