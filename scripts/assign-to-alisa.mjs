import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

if (!globalThis.fetch) {
  globalThis.fetch = fetch;
}

const supabase = createClient(
  'https://ycztjetxwpfgtrzeytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

const agentEmail = 'alisaharrell@aoglobelife.com';
const allowedStates = ['OH', 'SC', 'WA', 'TX', 'FL'];
const maxLeads = 50;

const { count: currentAssigned } = await supabase
  .from('masterlead')
  .select('*', { count: 'exact', head: true })
  .eq('cn_email', agentEmail)
  .neq('taalk_market', 'Plus Leads')
  .in('cnresolution', ['pending', 'called', null]);

const needed = Math.max(0, maxLeads - (currentAssigned || 0));

console.log(`Currently assigned: ${currentAssigned || 0}. Need: ${needed}.`);

if (needed === 0) {
  console.log('No assignment needed.');
  process.exit(0);
}

const { data: available, error } = await supabase
  .from('masterlead')
  .select('id, taalk_state, state')
  .is('cn_email', null)
  .eq('dnc', false)
  .neq('taalk_market', 'Plus Leads')
  .eq('taalk_market', 'Globe Market')
  .in('taalk_state', allowedStates)
  .limit(needed);

if (error) {
  console.error('Fetch error', error);
  process.exit(1);
}

if (!available?.length) {
  console.log('No leads available to assign.');
  process.exit(0);
}

const ids = available.map(l => l.id);

const { data: updated, error: updateError } = await supabase
  .from('masterlead')
  .update({
    previous_cn_email: null,
    cn_email: agentEmail,
    cnresolution: 'pending',
    assigned_date: new Date().toISOString()
  })
  .in('id', ids)
  .select();

if (updateError) {
  console.error('Update error', updateError);
  process.exit(1);
}

console.log(`Assigned ${updated?.length || 0} leads to ${agentEmail}. IDs:`, updated?.map(l => l.id));










