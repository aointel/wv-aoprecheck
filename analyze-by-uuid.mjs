import fetch from 'node-fetch';

const sessions = [
  { uuid: 'd514a326-d927-47f4-80aa-d2960614c37d', agent: 'leynatran' },
  { uuid: '7ded4b13-57a4-4c93-9f4a-2698fc6926d6', agent: 'leynatran' },
  { uuid: '595a226a-f136-46ab-94cd-6d43acb1c35d', agent: 'diankablash' }
];

console.log('🤖 Analyzing sessions by UUID...\n');

for (const { uuid, agent } of sessions) {
  console.log(`Analyzing ${agent}: ${uuid}`);
  
  try {
    const response = await fetch(`https://aoirail-production.up.railway.app/api/presentations/analyze/${uuid}`, {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`  ✅ Success!`);
      console.log(`     Client: ${data.analysis?.clientInfo?.full_name || data.analysis?.clientName || 'N/A'}`);
      console.log(`     Phase: ${data.analysis?.currentPhase || 'N/A'}`);
      console.log(`     ALP: ${data.analysis?.alp || 'N/A'}`);
      console.log(`     Disposition: ${data.analysis?.disposition || data.analysis?.result || 'N/A'}`);
    } else {
      console.log(`  ❌ Failed: ${data.error}`);
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
  
  console.log('');
  await new Promise(resolve => setTimeout(resolve, 3000));
}

console.log('✅ Done! Check presentation-analytics now.');

