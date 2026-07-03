/**
 * List everyone in the Lafond MGA team (agent_hierarchy).
 * Usage: npx tsx server/list-lafond-mga.ts
 */

import { supabaseAdmin } from './supabase.js';

async function main() {
  if (!supabaseAdmin) {
    console.error('Supabase admin not available');
    process.exit(1);
  }

  const { data, error } = await supabaseAdmin
    .from('agent_hierarchy')
    .select('agent_associate_id, agent_name, agent_email, mga_name, mga_associate_id, rga_name')
    .or('mga_associate_id.eq.409,mga_name.ilike.%lafond%');

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  const rows = (data || []) as { agent_associate_id?: number; agent_name?: string; agent_email?: string; mga_name?: string; mga_associate_id?: number; rga_name?: string }[];
  console.log('Lafond MGA team – everyone under Christopher Lafond (mga_associate_id 409 or mga_name contains lafond)\n');
  console.log('Total:', rows.length, 'agents\n');
  rows.forEach((r, i) => {
    const aid = r.agent_associate_id != null ? String(r.agent_associate_id) : '—';
    const email = (r.agent_email || '').padEnd(42);
    const name = r.agent_name || '—';
    console.log(`${(i + 1).toString().padStart(3)}. ${aid.padEnd(8)} | ${email} | ${name}`);
  });
}

main();
