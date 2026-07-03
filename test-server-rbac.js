// Test if the server is using the updated RBAC helper
import fetch from 'node-fetch';

async function testServerRbac() {
  try {
    console.log('🔍 Testing server RBAC helper...');
    
    // Test the API endpoint
    const response = await fetch('http://localhost:5000/api/aoi-precheck/sessions', {
      headers: {
        'user-email': 'tomanovichqm@aoglobelife.com'
      }
    });
    
    const data = await response.json();
    
    console.log(`✅ API Response Status: ${response.status}`);
    console.log(`✅ API Response Length: ${data.length}`);
    
    if (data.length > 0) {
      console.log('✅ RBAC filtering is working!');
      console.log('Sample session:', {
        session_id: data[0].session_id,
        client_name: `${data[0].first_name} ${data[0].last_name}`,
        agent_mga_team: data[0].agent_mga_team,
        status: data[0].status
      });
    } else {
      console.log('❌ Still getting empty array - RBAC helper may not be updated');
      
      // Let's also test with a different user to see if it's a general issue
      console.log('\n🔍 Testing with different user...');
      const response2 = await fetch('http://localhost:5000/api/aoi-precheck/sessions', {
        headers: {
          'user-email': 'admin@aoprecheck.net'
        }
      });
      
      const data2 = await response2.json();
      console.log(`✅ Admin Response Length: ${data2.length}`);
      
      if (data2.length > 0) {
        console.log('✅ Admin can see sessions - issue is specific to QM filtering');
      } else {
        console.log('❌ Admin also sees empty array - general API issue');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testServerRbac();
