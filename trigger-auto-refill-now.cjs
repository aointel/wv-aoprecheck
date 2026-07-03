#!/usr/bin/env node

const fetch = require('node-fetch');

const API_URL = 'https://aoirail-production.up.railway.app/api/outbound-dialer/leads';

async function triggerAutoRefill(email) {
  console.log(`\n🚀 Triggering auto-refill for ${email}...`);
  
  try {
    const response = await fetch(`${API_URL}?userEmail=${encodeURIComponent(email)}&market=Veteran&queueType=plus&limit=50`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed for ${email}: ${response.status} - ${errorText}`);
      return;
    }

    const data = await response.json();
    console.log(`✅ ${email}: ${data.leads?.length || 0} leads loaded`);
    console.log(`   Auto-refill triggered and processed`);
    
  } catch (error) {
    console.error(`❌ Error for ${email}:`, error.message);
  }
}

async function refillBothAgents() {
  console.log('🔄 Triggering auto-refill for Patricia and Ankita...\n');
  console.log('This will use the backend auto-refill system with proper:');
  console.log('  - State filtering');
  console.log('  - Market matching');
  console.log('  - State rarity sorting');
  console.log('  - Proper lead assignment\n');
  
  await triggerAutoRefill('patriciasantamarina@aoglobelife.com');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
  await triggerAutoRefill('ankitadas@aoglobelife.com');
  
  console.log('\n✅ Auto-refill process complete for both agents');
  console.log('They should now have leads in Call Connector Pro');
}

refillBothAgents();

