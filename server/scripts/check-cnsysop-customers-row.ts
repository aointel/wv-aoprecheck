/**
 * Print cnsysop's customers row so we can see what market/states columns actually have.
 * Run: npx tsx server/scripts/check-cnsysop-customers-row.ts
 */
import { supabaseAdmin } from '../supabase.js';

const EMAIL = 'cnsysop@aoglobelife.com';

async function main() {
  if (!supabaseAdmin) {
    console.error('Supabase not configured');
    process.exit(1);
  }
  // Fetch by company_email then personal_email; select all columns we might need for routing
  const { data: byCompany, error: e1 } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('company_email', EMAIL)
    .limit(1)
    .maybeSingle();
  if (e1) {
    console.error('Error (company_email):', e1.message);
    process.exit(1);
  }
  let row = byCompany;
  if (!row) {
    const { data: byPersonal, error: e2 } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('personal_email', EMAIL)
      .limit(1)
      .maybeSingle();
    if (e2) {
      console.error('Error (personal_email):', e2.message);
      process.exit(1);
    }
    row = byPersonal;
  }
  if (!row) {
    console.log('No customers row for', EMAIL);
    console.log('→ Add a row with company_email or personal_email =', EMAIL, 'and set market + states (or taalk_market / taalk_state) for routing.');
    return;
  }
  console.log('cnsysop customers row FOUND');
  console.log('');
  // Keys that matter for TaskRouter routing
  const routingKeys = ['market', 'states', 'taalk_market', 'taalk_state', 'MARKET', 'markets', 'company_email', 'personal_email', 'associate_id', 'first_name', 'last_name'];
  console.log('--- Routing-relevant columns ---');
  for (const k of routingKeys) {
    if ((row as any)[k] !== undefined) console.log('  ', k + ':', JSON.stringify((row as any)[k]));
  }
  console.log('');
  console.log('--- All columns (raw) ---');
  console.log(JSON.stringify(row, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
