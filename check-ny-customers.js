const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://ycztjetxwpfgtrzeyytt.supabase.co', 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd');

async function main() {
  // Get all customers with non-null states and filter client-side for NY
  let allData = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await sb.from('customers')
      .select('id,agent_name,company_email,states')
      .not('states', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) { console.error('Error:', error.message); break; }
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  
  const nyCustomers = allData.filter(r => Array.isArray(r.states) && r.states.includes('NY'));
  console.log('Total customers with states:', allData.length);
  console.log('Customers with NY in states:', nyCustomers.length);
  console.log(JSON.stringify(nyCustomers, null, 2));
}

main();
