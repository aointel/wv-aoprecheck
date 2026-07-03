const https = require('https');

async function testLeadCount() {
  try {
    const response = await fetch('https://aoirail-production-baa2.up.railway.app/api/twilio/analyze-leads');
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ SUCCESS!');
      console.log('Total leads:', data.summary.totalLeads);
      console.log('Unique area codes:', data.summary.uniqueAreaCodes);
      console.log('Top 5 area codes:');
      data.areaCodeDistribution.slice(0, 5).forEach(item => {
        console.log(`  ${item.areaCode}: ${item.leadCount} leads (${item.percentage}%)`);
      });
    } else {
      console.log('❌ ERROR:', data.error);
      console.log('Details:', data.details);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

testLeadCount();
