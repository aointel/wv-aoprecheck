import fetch from 'node-fetch';

const sessionId = '595a226a-f136-46ab-94cd-6d43acb1c35d'; // Dianka's session with 1000 scraped records

console.log('🤖 Analyzing Dianka\'s session with 1000 scraped data points...\n');
console.log(`Session ID: ${sessionId}\n`);

try {
  const response = await fetch(`https://aoirail-production.up.railway.app/api/presentations/analyze/${sessionId}`, {
    method: 'POST'
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('✅ ANALYSIS COMPLETE!\n');
    console.log('Extracted Data:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(JSON.stringify(data.analysis, null, 2));
    console.log('\nMetadata:');
    console.log(JSON.stringify(data.metadata, null, 2));
  } else {
    console.error('❌ ANALYSIS FAILED');
    console.error('Error:', data.error);
    console.error('Details:', data.details);
  }
  
} catch (error) {
  console.error('❌ Request failed:', error.message);
}

