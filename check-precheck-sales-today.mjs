import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

const today = new Date();
today.setHours(0, 0, 0, 0);
const todayISO = today.toISOString();

console.log('\n🔍 CHECKING AO PRECHECK SALES TODAY...\n');
console.log(`Date: ${today.toDateString()}`);
console.log(`Start of day: ${todayISO}\n`);

// Get verified precheck sessions from today
const { data: precheckSales, error } = await supabase
  .from('verification_sessions')
  .select('*')
  .eq('verification_result', 'verified')
  .gte('created_at', todayISO);

if (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

if (!precheckSales || precheckSales.length === 0) {
  console.log('❌ NO PRECHECK SALES TODAY\n');
  process.exit(0);
}

console.log(`✅ Found ${precheckSales.length} precheck sales today:\n`);

let totalALP = 0;

precheckSales.forEach((sale, index) => {
  const monthlyPremium = parseFloat(sale.monthly_premium) || 0;
  const alp = monthlyPremium * 12;
  totalALP += alp;
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Sale #${index + 1}:`);
  console.log(`   Agent: ${sale.agent_email}`);
  console.log(`   Client: ${sale.client_name || 'N/A'}`);
  console.log(`   Monthly Premium: $${monthlyPremium.toFixed(2)}`);
  console.log(`   ALP (×12): $${alp.toFixed(2)}`);
  console.log(`   Verified: ${sale.created_at}`);
  console.log();
});

console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`\n💰 TOTAL ALP TODAY: $${totalALP.toFixed(2)}\n`);

