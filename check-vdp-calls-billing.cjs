// Debug script to check why Connect billing stopped
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcxNzQwMzcsImV4cCI6MjA1Mjc1MDAzN30.E0gNaQyQUhfN2I8XfdNVEViVv90HxKZS4Rcwcq19ldc',
  {
    auth: {
      persistSession: false
    }
  }
);

async function debug() {
  console.log('=== VDP CALLS BILLING DEBUG ===\n');
  
  // 1. Check recent vdp_calls with END event
  console.log('1. RECENT VDP_CALLS WITH event="END" or "end":');
  const { data: endCalls, error: endError } = await supabase
    .from('vdp_calls')
    .select('id, agent, company_email, event, updated_at, time')
    .or('event.eq.END,event.eq.end')
    .gte('updated_at', '2025-11-15T00:00:00Z')
    .order('updated_at', { ascending: false })
    .limit(20);
  
  if (endError) {
    console.log('   ERROR:', endError.message);
  } else if (!endCalls || endCalls.length === 0) {
    console.log('   ⚠️ NO CALLS FOUND with event=END since 11/15');
  } else {
    console.log(`   Found ${endCalls.length} calls (showing up to 20):`);
    endCalls.forEach(c => {
      const date = new Date(c.created_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
      console.log(`   - ID:${c.id} | event:${c.event} | agent:${c.agent || 'N/A'} | ${date}`);
    });
  }
  
  // 2. Check ALL recent vdp_calls (any event)
  console.log('\n2. ALL RECENT VDP_CALLS (any event) since 11/15:');
  const { data: allCalls, error: allError } = await supabase
    .from('vdp_calls')
    .select('id, agent, company_email, event, updated_at')
    .gte('updated_at', '2025-11-15T00:00:00Z')
    .order('updated_at', { ascending: false })
    .limit(30);
  
  if (allError) {
    console.log('   ERROR:', allError.message);
  } else if (!allCalls || allCalls.length === 0) {
    console.log('   ⚠️ NO CALLS FOUND AT ALL since 11/15');
  } else {
    console.log(`   Found ${allCalls.length} total calls (showing up to 30):`);
    
    // Group by event type
    const byEvent = {};
    allCalls.forEach(c => {
      const event = c.event || 'NULL';
      if (!byEvent[event]) byEvent[event] = [];
      byEvent[event].push(c);
    });
    
    Object.entries(byEvent).forEach(([event, calls]) => {
      console.log(`   Event "${event}": ${calls.length} calls`);
      if (calls.length <= 5) {
      calls.forEach(c => {
        const date = new Date(c.updated_at || c.time || Date.now()).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
        console.log(`     - ID:${c.id} | ${date}`);
      });
      }
    });
  }
  
  // 3. Check existing billing transactions
  console.log('\n3. EXISTING BILLING TRANSACTIONS (Connect) since 11/15:');
  const { data: transactions, error: transError } = await supabase
    .from('billing_transactions')
    .select('transaction_id, source_id, transaction_date, agent_email')
    .eq('source_table', 'vdp_calls')
    .gte('transaction_date', '2025-11-15T00:00:00Z')
    .order('transaction_date', { ascending: false })
    .limit(20);
  
  if (transError) {
    console.log('   ERROR:', transError.message);
  } else if (!transactions || transactions.length === 0) {
    console.log('   ⚠️ NO BILLING TRANSACTIONS since 11/15');
  } else {
    console.log(`   Found ${transactions.length} transactions:`);
    transactions.forEach(t => {
      const date = new Date(t.transaction_date).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
      console.log(`   - ${t.transaction_id} | source_id:${t.source_id} | ${t.agent_email} | ${date}`);
    });
  }
  
  // 4. Check what source_ids are already billed
  console.log('\n4. CHECKING: Are there vdp_calls that should be billed but aren\'t?');
  if (allCalls && allCalls.length > 0) {
    const callIds = allCalls.map(c => c.id).filter(id => typeof id === 'number');
    const billedIds = transactions ? transactions.map(t => t.source_id).filter(id => typeof id === 'number') : [];
    const billedSet = new Set(billedIds);
    
    const unbilled = callIds.filter(id => !billedSet.has(id));
    const endUnbilled = allCalls.filter(c => 
      unbilled.includes(c.id) && 
      (c.event === 'END' || c.event === 'end')
    );
    
    if (endUnbilled.length > 0) {
      console.log(`   ⚠️ FOUND ${endUnbilled.length} UNBILLED calls with event=END:`);
      endUnbilled.slice(0, 10).forEach(c => {
        const date = new Date(c.updated_at || c.time || Date.now()).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
        console.log(`   - ID:${c.id} | event:${c.event} | ${date}`);
      });
    } else {
      console.log('   ✅ All END calls are already billed (or no END calls found)');
    }
  }
  
  console.log('\n=== END DEBUG ===');
}

debug().catch(console.error);

