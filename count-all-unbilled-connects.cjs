// Count ALL unbilled Connect calls since 11/15
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcxNzQwMzcsImV4cCI6MjA1Mjc1MDAzN30.E0gNaQyQUhfN2I8XfdNVEViVv90HxKZS4Rcwcq19ldc',
  { auth: { persistSession: false } }
);

async function countUnbilled() {
  console.log('=== COUNTING ALL UNBILLED CONNECTS SINCE 11/15 ===\n');
  
  // 1. Get ALL vdp_calls with event=END since 11/15
  console.log('1. ALL VDP_CALLS with event=END since 11/15:');
  const { data: allEndCalls, error: endError, count: endCount } = await supabase
    .from('vdp_calls')
    .select('id', { count: 'exact' })
    .or('event.eq.END,event.eq.end')
    .gte('updated_at', '2025-11-15T00:00:00Z');
  
  if (endError) {
    console.log('   ERROR:', endError.message);
  } else {
    console.log(`   TOTAL END CALLS: ${endCount || allEndCalls?.length || 0}`);
  }
  
  // 2. Get all billing transactions since 11/15
  console.log('\n2. BILLING TRANSACTIONS (Connect) since 11/15:');
  const { data: billedTrans, error: billError, count: billCount } = await supabase
    .from('billing_transactions')
    .select('source_id', { count: 'exact' })
    .eq('source_table', 'vdp_calls')
    .gte('transaction_date', '2025-11-15T00:00:00Z');
  
  if (billError) {
    console.log('   ERROR:', billError.message);
  } else {
    console.log(`   BILLED TRANSACTIONS: ${billCount || billedTrans?.length || 0}`);
  }
  
  // 3. Get ALL existing billing source_ids for vdp_calls
  console.log('\n3. COMPARING: Finding unbilled calls...');
  const { data: allBilled } = await supabase
    .from('billing_transactions')
    .select('source_id')
    .eq('source_table', 'vdp_calls')
    .not('source_id', 'is', null);
  
  const billedIds = new Set((allBilled || []).map(b => b.source_id));
  console.log(`   Total ever-billed source_ids: ${billedIds.size}`);
  
  // 4. Get ALL END calls and check which are unbilled
  const { data: allCalls } = await supabase
    .from('vdp_calls')
    .select('id, agent, company_email, updated_at, time')
    .or('event.eq.END,event.eq.end')
    .gte('updated_at', '2025-11-15T00:00:00Z')
    .order('updated_at', { ascending: false });
  
  if (!allCalls) {
    console.log('   No calls found');
    return;
  }
  
  const unbilledCalls = allCalls.filter(c => !billedIds.has(c.id));
  
  console.log(`\n=== RESULTS ===`);
  console.log(`   END calls since 11/15: ${allCalls.length}`);
  console.log(`   Already billed: ${allCalls.length - unbilledCalls.length}`);
  console.log(`   🔥 UNBILLED: ${unbilledCalls.length}`);
  console.log(`   💰 MISSING REVENUE: $${unbilledCalls.length * 8}`);
  
  if (unbilledCalls.length > 0) {
    console.log('\n   First 20 unbilled calls:');
    unbilledCalls.slice(0, 20).forEach(c => {
      const date = c.updated_at ? new Date(c.updated_at).toLocaleDateString('en-US') : 'N/A';
      console.log(`   - ID:${c.id} | agent:${c.agent || 'N/A'} | ${date}`);
    });
  }
  
  // 5. Group by date
  console.log('\n   UNBILLED BY DATE:');
  const byDate = {};
  unbilledCalls.forEach(c => {
    const date = c.updated_at ? new Date(c.updated_at).toLocaleDateString('en-US') : 'Unknown';
    byDate[date] = (byDate[date] || 0) + 1;
  });
  Object.entries(byDate).sort((a, b) => new Date(b[0]) - new Date(a[0])).forEach(([date, count]) => {
    console.log(`   ${date}: ${count} unbilled ($${count * 8})`);
  });
  
  console.log('\n=== END ===');
}

countUnbilled().catch(console.error);



























