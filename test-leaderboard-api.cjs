const fetch = require('node-fetch');

async function testLeaderboard() {
  try {
    console.log('📊 Testing /api/leaderboard endpoint...\n');
    
    const response = await fetch('https://aoirail-production.up.railway.app/api/leaderboard');
    
    console.log(`Status: ${response.status}`);
    
    const data = await response.json();
    
    console.log('\nResponse:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.leaderboard && data.leaderboard.length > 0) {
      console.log(`\n✅ Leaderboard has ${data.leaderboard.length} producers`);
      console.log('\nTop 3:');
      data.leaderboard.slice(0, 3).forEach((p, i) => {
        console.log(`${i + 1}. ${p.agentName} - D:${p.dials} R:${p.reaches} B:${p.bookings}`);
      });
    } else {
      console.log('\n❌ Leaderboard is empty!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testLeaderboard();

