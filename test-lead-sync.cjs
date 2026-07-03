const fetch = require('node-fetch');

async function test() {
  console.log('Testing lead-sync service...');
  
  try {
    const response = await fetch('https://lead-sync-mmandella.replit.app/api/bulk-assign-leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentEmail: 'test@example.com',
        associate_id: '123',
        requestedCount: 10
      }),
      signal: AbortSignal.timeout(5000)
    });
    
    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response:', text.substring(0, 200));
    
    if (response.ok) {
      console.log('✅ Lead sync service is accessible');
    } else {
      console.log('❌ Lead sync service returned error');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test().then(() => process.exit(0));

