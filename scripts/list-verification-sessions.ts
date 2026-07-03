import 'dotenv/config';

import { supabaseAdmin } from '../server/supabase';

async function main() {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured');
  }

  const email = process.argv[2];
  if (!email) {
    console.log('Usage: npx tsx scripts/list-verification-sessions.ts <agent_email> [limit=5]');
    process.exit(1);
  }

  const limit = Number(process.argv[3] ?? '5');

  const { data, error } = await supabaseAdmin
    .from('verification_sessions')
    .select('id, session_id, created_at, verification_method, verification_result, agent_first_name, agent_last_name, company_email')
    .ilike('company_email', email)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  if (!data || data.length === 0) {
    console.log('No sessions found for', email);
    return;
  }

  for (const row of data) {
    console.log(`${row.session_id} | id=${row.id} | ${row.created_at} | ${row.verification_method} | ${row.verification_result}`);
  }
}

main().catch(err => {
  console.error('Error listing sessions:', err);
  process.exit(1);
});






