/**
 * Test Twilio token generation for Leyna vs cnsysop
 */

const fetch = require('node-fetch');

async function testTokens() {
  console.log('\n🧪 TESTING TWILIO TOKEN GENERATION');
  console.log('═'.repeat(70));
  
  const agents = [
    { name: 'CNSYSOP (WORKING)', email: 'cnsysop@aoglobelife.com' },
    { name: 'LEYNA (BROKEN)', email: 'leynatran@aoglobelife.com' }
  ];
  
  for (const agent of agents) {
    console.log(`\n📧 Testing: ${agent.name}`);
    console.log(`   Email: ${agent.email}\n`);
    
    try {
      const response = await fetch(`http://localhost:5000/api/twilio/token?identity=${encodeURIComponent(agent.email)}`);
      
      if (!response.ok) {
        console.log(`   ❌ Token generation failed: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      console.log(`   ✅ Token generated successfully`);
      console.log(`   📊 Token length: ${data.token.length} chars`);
      console.log(`   🔑 Identity: ${data.identity}`);
      console.log(`   📱 App SID: ${data.appSid}`);
      console.log(`   🎯 Token preview: ${data.token.substring(0, 50)}...`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log('💡 If both tokens generate successfully, the issue is:');
  console.log('   1. Twilio account restrictions on her identity');
  console.log('   2. Browser WebRTC permissions');
  console.log('   3. Network/firewall blocking for her specific session');
  console.log('═'.repeat(70) + '\n');
}

testTokens();

