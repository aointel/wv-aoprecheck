const fetch = require('node-fetch');

async function testLeaderboard() {
  try {
    console.log('📊 Testing /api/leaderboard endpoint...\n');
    
    // Test local first if running, otherwise production
    const url = process.env.API_URL || 'https://aoirail-production.up.railway.app/api/leaderboard';
    console.log(`Testing: ${url}\n`);
    
    const response = await fetch(url);
    
    console.log(`Status: ${response.status} ${response.statusText}\n`);
    
    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    
    if (!data.leaderboard) {
      console.error('❌ Response missing leaderboard array!');
      console.log('Full response:', JSON.stringify(data, null, 2));
      return;
    }
    
    const leaderboard = data.leaderboard;
    
    console.log(`✅ Leaderboard has ${leaderboard.length} agents (should be max 20)\n`);
    
    // Validate top 20 limit
    if (leaderboard.length > 20) {
      console.error(`❌ ERROR: Leaderboard has ${leaderboard.length} agents, should be max 20!`);
    }
    
    // Show top 10 with full details including presentations and sales
    console.log('📊 TOP 10 LEADERBOARD:\n');
    console.log('Rank | Name              | Email                        | Dials | Reaches | Bookings | Pres | Sales | Points');
    console.log('-----|-------------------|------------------------------|-------|---------|----------|------|-------|--------');
    
    leaderboard.slice(0, 10).forEach((agent, i) => {
      const rank = (i + 1).toString().padStart(4);
      const name = (agent.agentName || 'Unknown').substring(0, 17).padEnd(17);
      const email = (agent.email || '').substring(0, 28).padEnd(28);
      const dials = (agent.dials || 0).toString().padStart(5);
      const reaches = (agent.reaches || 0).toString().padStart(7);
      const bookings = (agent.bookings || 0).toString().padStart(8);
      const presentations = (agent.presentations || 0).toString().padStart(4);
      const sales = (agent.sales || 0).toString().padStart(5);
      const points = (agent.points || 0).toString().padStart(6);
      
      console.log(`${rank} | ${name} | ${email} | ${dials} | ${reaches} | ${bookings} | ${presentations} | ${sales} | ${points}`);
    });
    
    // Validate data structure
    console.log('\n🔍 VALIDATION:\n');
    
    let errors = 0;
    
    leaderboard.forEach((agent, index) => {
      // Check if points match calculation
      const expectedPoints = 
        (agent.dials || 0) * 1 + 
        (agent.reaches || 0) * 25 + 
        (agent.bookings || 0) * 50 + 
        (agent.presentations || 0) * 200 + 
        (agent.sales || 0) * 800;
      
      if (agent.points !== expectedPoints) {
        console.error(`❌ Rank ${index + 1} (${agent.agentName}): Points mismatch!`);
        console.error(`   Expected: ${expectedPoints} (D:${agent.dials}*1 + R:${agent.reaches}*25 + B:${agent.bookings}*50 + P:${agent.presentations}*200 + S:${agent.sales}*800)`);
        console.error(`   Got: ${agent.points}`);
        errors++;
      }
      
      // Check if rank matches index
      if (agent.rank !== index + 1) {
        console.error(`❌ Rank ${index + 1} (${agent.agentName}): Rank field mismatch! Expected ${index + 1}, got ${agent.rank}`);
        errors++;
      }
      
      // Check if sorted correctly (points descending)
      if (index > 0 && leaderboard[index - 1].points < agent.points) {
        console.error(`❌ Rank ${index + 1} (${agent.agentName}): Not sorted correctly! Previous rank has ${leaderboard[index - 1].points} points, this one has ${agent.points}`);
        errors++;
      }
    });
    
    if (errors === 0) {
      console.log('✅ All validations passed!');
      console.log(`✅ Leaderboard correctly shows top ${leaderboard.length} agents sorted by points`);
    } else {
      console.error(`\n❌ Found ${errors} validation errors!`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testLeaderboard();

