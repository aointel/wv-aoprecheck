/**
 * Send the 10 leads assigned to Lisa Vanzille to Zapier (Planet ALTIG).
 * Uses same webhook as send-one-lead-to-zapier.cjs. Only sends leads that have taalk_lead_id.
 *
 * Run: node scripts/send-lisa-assigned-leads-to-zapier.cjs
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const CN_EMAIL = 'lisavanzile@aoglobelife.com';
const LISA_ASSOCIATE_ID = '185556'; // Lisa Vanzille (from send-lead-to-lisavanzile.cjs)
const ZAPIER_URL = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';

// Masterlead IDs we assigned to Lisa
const LEAD_IDS = [795874, 742292, 555248, 862420, 857974, 913777, 844161, 411344, 914095, 914150];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('Sending leads (cn_email =', CN_EMAIL, ') to Zapier...\n');

  // Lisa Vanzille - associate_id 185556 (from send-lead-to-lisavanzile.cjs)
  let associateId = LISA_ASSOCIATE_ID;
  const { data: cust } = await supabase
    .from('customers')
    .select('associate_id')
    .eq('company_email', CN_EMAIL)
    .maybeSingle();
  if (cust?.associate_id) associateId = String(cust.associate_id);
  else {
    const { data: cust2 } = await supabase
      .from('customers')
      .select('associate_id')
      .eq('company_email', 'lisavanzile@aoglobelife.com')
      .maybeSingle();
    if (cust2?.associate_id) associateId = String(cust2.associate_id);
  }
  console.log('Using associate_id:', associateId, '\n');

  // Mark all 10 as booked in masterlead
  const { error: updateBookedErr } = await supabase
    .from('masterlead')
    .update({ cnresolution: 'booked', updated_at: new Date().toISOString() })
    .in('id', LEAD_IDS);
  if (updateBookedErr) {
    console.error('Failed to mark leads as booked:', updateBookedErr.message);
    process.exit(1);
  }
  console.log('Marked', LEAD_IDS.length, 'leads as booked in masterlead.\n');

  const { data: leads, error } = await supabase
    .from('masterlead')
    .select('id, taalk_lead_id, first_name, last_name')
    .in('id', LEAD_IDS);

  if (error) {
    console.error('Fetch error:', error.message);
    process.exit(1);
  }

  let sent = 0;
  let skipped = 0;

  for (const lead of leads || []) {
    const tid = lead.taalk_lead_id ? String(lead.taalk_lead_id).trim() : null;
    if (!tid) {
      console.log('Skip (no taalk_lead_id):', lead.id, lead.first_name, lead.last_name);
      skipped++;
      continue;
    }
    const payload = { lead_id: tid, associate_id: associateId };
    const res = await fetch(ZAPIER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error('Zapier failed for', lead.id, res.status, await res.text());
      continue;
    }
    await supabase
      .from('masterlead')
      .update({ webhook_sent_at: new Date().toISOString() })
      .eq('id', lead.id);
    console.log('Sent:', lead.id, lead.first_name, lead.last_name, 'taalk_lead_id', tid);
    sent++;
  }

  console.log('\n--- Summary ---');
  console.log('Sent to Zapier:', sent);
  console.log('Skipped (no taalk_lead_id):', skipped);
}

main().catch((e) => { console.error(e); process.exit(1); });
