// Query Globe Market leads by state from masterlead table
import { createClient } from '@supabase/supabase-js';

// Supabase credentials from hardcoded-config
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getGlobeMarketLeadsByState() {
  try {
    console.log('📊 Querying Globe Market leads by state...\n');

    // First, get all Globe Market leads with their state information
    // Use pagination to get all leads (Supabase default limit is 1000)
    let allLeads = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: leads, error } = await supabase
        .from('masterlead')
        .select('state, taalk_state, taalk_market')
        .or('taalk_market.ilike.%globe%,taalk_market.ilike.%Globe Market%')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('❌ Error querying masterlead:', error);
        break;
      }

      if (leads && leads.length > 0) {
        allLeads = allLeads.concat(leads);
        hasMore = leads.length === pageSize;
        page++;
        console.log(`📄 Fetched page ${page}: ${leads.length} leads (total so far: ${allLeads.length})`);
      } else {
        hasMore = false;
      }
    }

    const leads = allLeads;

    if (!leads || leads.length === 0) {
      console.log('❌ No Globe Market leads found');
      return;
    }

    console.log(`✅ Found ${leads.length} total Globe Market leads\n`);

    // Group by state
    const stateCounts = {};
    let nullStateCount = 0;

    leads.forEach(lead => {
      // Use state or taalk_state, whichever is available
      const state = lead.state || lead.taalk_state || 'NULL/UNKNOWN';
      
      if (state === 'NULL/UNKNOWN') {
        nullStateCount++;
      } else {
        stateCounts[state] = (stateCounts[state] || 0) + 1;
      }
    });

    // Sort states alphabetically
    const sortedStates = Object.keys(stateCounts).sort();

    console.log('📈 Globe Market Leads by State:');
    console.log('=' .repeat(50));
    
    let total = 0;
    sortedStates.forEach(state => {
      const count = stateCounts[state];
      total += count;
      console.log(`${state.padEnd(20)} ${count.toString().padStart(6)} leads`);
    });

    if (nullStateCount > 0) {
      console.log(`${'NULL/UNKNOWN'.padEnd(20)} ${nullStateCount.toString().padStart(6)} leads`);
      total += nullStateCount;
    }

    console.log('=' .repeat(50));
    console.log(`${'TOTAL'.padEnd(20)} ${total.toString().padStart(6)} leads`);
    console.log(`\n✅ Query complete!`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

getGlobeMarketLeadsByState();

