/**
 * Test webhook with REAL associate_id from database
 */

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function testWithRealAssociateId() {
  console.log('\n🔍 CHECKING AGENT ASSOCIATE IDS');
  console.log('═'.repeat(70));
  
  try {
    // Get a few agents' associate_ids
    const { data: agents, error } = await supabase
      .from('producers')
      .select('company_email, associate_id, first_name, last_name')
      .in('company_email', [
        'leynatran@aoglobelife.com',
        'martintoma@aoglobelife.com',
        'chrislafond@aoglobelife.com'
      ]);
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    console.log('\n📊 AGENT ASSOCIATE IDS:\n');
    agents.forEach(agent => {
      console.log(`${agent.first_name} ${agent.last_name} (${agent.company_email})`);
      console.log(`  Associate ID: ${agent.associate_id || 'NULL'}`);
      console.log('');
    });
    
    // Test webhook with Leyna's real associate_id
    const leyna = agents.find(a => a.company_email === 'leynatran@aoglobelife.com');
    
    if (!leyna) {
      console.log('❌ Leyna not found in producers table!');
      return;
    }
    
    console.log('═'.repeat(70));
    console.log('🧪 TESTING WEBHOOK WITH LEYNA\'S REAL ASSOCIATE_ID');
    console.log('═'.repeat(70) + '\n');
    
    const testPayload = {
      lead_id: "TEST-67890",
      associate_id: leyna.associate_id || "999"
    };
    
    console.log('📤 Sending test payload:', testPayload);
    console.log('🎯 Target: https://hooks.zapier.com/hooks/catch/2467580/ud6b4rp/\n');
    
    const response = await fetch('https://hooks.zapier.com/hooks/catch/2467580/ud6b4rp/', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': 'gGOOgk54VsWvy6zJ2S9t14cFxrzk0485EPiVIb23'
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    const responseText = await response.text();
    console.log('📥 Response Body:', responseText);
    
    if (response.ok) {
      console.log('\n✅ WEBHOOK TEST SUCCESSFUL!');
      console.log(`Sent associate_id: ${testPayload.associate_id}`);
    } else {
      console.log('\n❌ WEBHOOK TEST FAILED!');
    }
    
    console.log('\n' + '═'.repeat(70) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

testWithRealAssociateId();

