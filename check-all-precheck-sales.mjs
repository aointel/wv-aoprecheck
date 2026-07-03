import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

console.log('\n🔍 CHECKING ALL PRECHECK SALES (EVER)...\n');

const { data: precheckSales, error } = await supabase
  .from('verification_sessions')
  .select('*')
  .eq('verification_result', 'verified')
  .order('created_at', { ascending: false })
  .limit(20);

if (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

if (!precheckSales || precheckSales.length === 0) {
  console.log('❌ NO PRECHECK SALES EVER\n');
  console.log('Either:');
  console.log('1. No one has completed a precheck verification');
  console.log('2. verification_sessions table doesn\'t exist');
  console.log('3. No records have verification_result = "verified"');
  process.exit(0);
}

console.log(`✅ Found ${precheckSales.length} total precheck sales:\n`);

precheckSales.forEach((sale, index) => {
  const monthlyPremium = parseFloat(sale.monthly_premium) || 0;
  const alp = monthlyPremium * 12;
  
  console.log(`${index + 1}. ${sale.agent_email || 'N/A'} - ${sale.client_name || 'N/A'}`);
  console.log(`   Premium: $${monthlyPremium}/mo → ALP: $${alp.toFixed(2)}`);
  console.log(`   Date: ${sale.created_at}`);
  console.log();
});

