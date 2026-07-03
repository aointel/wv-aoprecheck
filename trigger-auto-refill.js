// Trigger auto-refill for a specific agent
import fetch from 'node-fetch';

const userEmail = 'alisaharrell@aoglobelife.com';
const serverUrl = process.env.SERVER_URL || 'https://aoirail-production-baa2.up.railway.app';

async function triggerAutoRefill() {
  try {
    console.log(`🔄 Triggering auto-refill for ${userEmail}...`);
    
    const url = `${serverUrl}/api/outbound-dialer/leads?market=hotleads&userEmail=${encodeURIComponent(userEmail)}&limit=1000&offset=0`;
    
    const response = await fetch(url, {
      headers: {
        'x-user-email': userEmail
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    console.log(`✅ Response received:`);
    console.log(`   Leads returned: ${data.leads?.length || 0}`);
    
    if (data.webhookSent) {
      console.log(`   📤 Auto-refill webhook was sent`);
      console.log(`   Leads assigned: ${data.leadsAssigned || 0}`);
    } else {
      console.log(`   ℹ️ No auto-refill needed (agent has sufficient leads)`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    process.exit(1);
  }
}

triggerAutoRefill();

