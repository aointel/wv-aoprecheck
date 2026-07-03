import fetch from 'node-fetch';

const apiUrl = 'https://aoirail-production.up.railway.app/api/presentations/sessions';

console.log(`🔍 Testing sessions API: ${apiUrl}\n`);

try {
  const response = await fetch(apiUrl);
  const data = await response.json();
  
  console.log('📊 API Response:');
  console.log('  Status:', response.status);
  console.log('  Success:', data.success);
  console.log('  Total:', data.total);
  console.log('  Sessions:', data.sessions?.length || 0);
  console.log('\n');
  
  if (data.sessions && data.sessions.length > 0) {
    console.log('✅ First 3 sessions:');
    data.sessions.slice(0, 3).forEach((s, i) => {
      console.log(`\n  [${i + 1}] ${s.session_id || s.id}`);
      console.log(`      Agent: ${s.agent_email}`);
      console.log(`      Started: ${s.started_at}`);
      console.log(`      Status: ${s.status}`);
    });
  } else {
    console.log('❌ No sessions returned');
  }
  
  if (data.error) {
    console.log('\n❌ Error:', data.error);
  }
} catch (error) {
  console.error('❌ Request failed:', error.message);
}

