import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://ycztjetxwpfgtrzeyytt.supabase.co', 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd');

async function main() {
  // Fetch all customers with states, paginate to get all
  let allData = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await sb.from('customers')
      .select('id,agent_name,company_email,states')
      .not('states', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) { console.error('Fetch error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  
  const nyCustomers = allData.filter(r => Array.isArray(r.states) && r.states.includes('NY'));
  console.log(`Found ${nyCustomers.length} customers with NY in states`);
  
  let success = 0;
  let failed = 0;
  
  for (const customer of nyCustomers) {
    const newStates = customer.states.filter(s => s !== 'NY');
    const { error } = await sb.from('customers')
      .update({ states: newStates })
      .eq('id', customer.id);
    
    if (error) {
      console.error(`❌ FAILED ${customer.company_email}: ${error.message}`);
      failed++;
    } else {
      const note = newStates.length === 0 ? ' (now empty)' : ` (remaining: ${newStates.join(', ')})`;
      console.log(`✅ ${customer.company_email || customer.agent_name || customer.id}${note}`);
      success++;
    }
  }
  
  console.log(`\nDone. ${success} updated, ${failed} failed.`);
}

main();
