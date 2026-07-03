import fetch from 'node-fetch';

const testEmail = 'leynatran@aoglobelife.com';
const apiUrl = `https://aoirail-production.up.railway.app/api/presentations/agent/${testEmail}`;

console.log(`🔍 Testing API: ${apiUrl}\n`);

try {
  const response = await fetch(apiUrl);
  const data = await response.json();
  
  console.log('📊 API Response:');
  console.log('  Status:', response.status);
  console.log('  Success:', data.success);
  console.log('  Active:', data.active?.length || 0);
  console.log('  Recent:', data.recent?.length || 0);
  console.log('  Presentations:', data.presentations?.length || 0);
  console.log('\n');
  
  if (data.presentations && data.presentations.length > 0) {
    console.log('✅ Presentations found:');
    data.presentations.forEach((p, i) => {
      console.log(`\n  [${i + 1}] ${p.id}`);
      console.log(`      Agent: ${p.agent_email}`);
      console.log(`      Started: ${p.started_at}`);
      console.log(`      Status: ${p.status}`);
      console.log(`      Screenshots: ${p.screenshot_count || 0}`);
      console.log(`      Has screenshots array: ${!!p.screenshots}`);
      console.log(`      Screenshots length: ${p.screenshots?.length || 0}`);
    });
  } else {
    console.log('❌ No presentations returned');
    console.log('\nFull response:', JSON.stringify(data, null, 2));
  }
} catch (error) {
  console.error('❌ Error:', error.message);
}

