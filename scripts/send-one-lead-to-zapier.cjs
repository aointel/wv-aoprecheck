/**
 * Send one lead to Zapier (Planet ALTIG). Usage:
 *   node scripts/send-one-lead-to-zapier.cjs <taalk_lead_id> <agent_email>
 * Example:
 *   node scripts/send-one-lead-to-zapier.cjs 19001639 lynettedurand@aoglobelife.com
 */

const path = require('path');
const fs = require('fs');

const envPaths = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '.env.local'),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    require('dotenv').config({ path: p });
    break;
  }
}

let SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
let SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  const configPath = path.join(__dirname, '..', 'server', 'hardcoded-config.ts');
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf-8');
    const urlM = content.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/);
    const keyM = content.match(/SUPABASE_SERVICE_KEY:\s*['"]([^'"]+)['"]/);
    if (urlM) SUPABASE_URL = urlM[1];
    if (keyM) SUPABASE_SERVICE_KEY = keyM[1];
  }
}

const { createClient } = require('@supabase/supabase-js');

const taalkLeadId = process.argv[2] || '19001639';
const agentEmail = (process.argv[3] || 'lynettedurand@aoglobelife.com').toLowerCase().trim();

const ZAPIER_URL = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: agent, error: agentErr } = await supabase
    .from('customers')
    .select('associate_id')
    .eq('company_email', agentEmail)
    .maybeSingle();
  if (agentErr || !agent?.associate_id) {
    console.error('No associate_id for', agentEmail, agentErr || '');
    process.exit(1);
  }

  const payload = { lead_id: String(taalkLeadId), associate_id: agent.associate_id };
  console.log('Sending to Zapier:', payload);
  const res = await fetch(ZAPIER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error('Zapier failed:', res.status, await res.text());
    process.exit(1);
  }
  console.log('Zapier OK:', res.status);

  const { error: updateErr } = await supabase
    .from('masterlead')
    .update({ webhook_sent_at: new Date().toISOString() })
    .eq('taalk_lead_id', taalkLeadId);
  if (updateErr) {
    console.error('Update webhook_sent_at failed:', updateErr);
    process.exit(1);
  }
  console.log('Updated masterlead.webhook_sent_at for taalk_lead_id', taalkLeadId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
