const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function getPhantomAgents() {
  try {
    // Get all booked calls from masterlead
    const { data: bookedCalls, error } = await supabase
      .from('masterlead')
      .select('*')
      .eq('cnresolution', 'booked');

    if (error) {
      console.error('Error fetching booked calls:', error);
      return;
    }

    console.log(`\n📊 Found ${bookedCalls.length} calls marked as "booked"`);
    
    // Count by agent
    const agentCounts = {};
    bookedCalls.forEach(call => {
      const agentId = call.owned_by_user_id || 'UNASSIGNED';
      if (!agentCounts[agentId]) {
        agentCounts[agentId] = 0;
      }
      agentCounts[agentId]++;
    });

    console.log('\n🚨 PHANTOM BOOKINGS BY AGENT:');
    console.log('================================');
    
    // Sort by count (highest first)
    const sortedAgents = Object.entries(agentCounts).sort((a, b) => b[1] - a[1]);
    
    sortedAgents.forEach(([agentId, count]) => {
      console.log(`Agent ${agentId}: ${count} phantom bookings`);
    });

    console.log('\n📋 AGENT ID MAPPING NEEDED:');
    sortedAgents.forEach(([agentId]) => {
      if (agentId !== 'UNASSIGNED') {
        console.log(`- ${agentId}`);
      }
    });

  } catch (error) {
    console.error('Script error:', error);
  }
}

getPhantomAgents();