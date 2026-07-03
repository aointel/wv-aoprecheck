import fetch from 'node-fetch';

const testApi = async () => {
  try {
    console.log('🔍 Testing API endpoint...');
    const response = await fetch('http://localhost:5000/api/live-call-board/agents', {
      headers: {
        'x-user-email': 'carringtonhanna@aoglobelife.com'
      }
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const text = await response.text();
      console.log('Error response:', text);
      return;
    }
    
    const data = await response.json();
    console.log(`\n✅ Received ${data.length} agents`);
    
    if (data.length > 0) {
      console.log('\nFirst agent:');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('\n⚠️ No agents returned!');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

// Wait a bit for server to start
setTimeout(testApi, 15000);









