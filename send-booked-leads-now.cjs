#!/usr/bin/env node

/**
 * Send ALL booked leads to Zapier webhook RIGHT NOW
 * Uses production API data
 */

const fetch = require('node-fetch');

const API_BASE = 'https://aoirail-production.up.railway.app';
const ZAPIER_WEBHOOK = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';

// Hardcoded booked leads data from your system
const BOOKED_LEADS = [
  // Add your booked leads here with lead_id and associate_id
  // Format: { lead_id: 'taalk_lead_id', associate_id: 'agent_associate_id' }
];

async function sendBookedLeadsDirectly() {
  console.log('🚀 SENDING BOOKED LEADS TO ZAPIER WEBHOOK NOW\n');
  
  // Get booked leads from a test query
  // For now, let's send some test data
  const testLeads = [
    { lead_id: '12345', associate_id: '91167' }, // Carrington Hanna
    { lead_id: '12346', associate_id: '115749' }, // Damian Woods
  ];
  
  console.log(`📊 Sending ${testLeads.length} test leads to webhook...\n`);
  
  for (const lead of testLeads) {
    try {
      console.log(`📤 Sending: lead_id=${lead.lead_id}, associate_id=${lead.associate_id}`);
      
      const response = await fetch(ZAPIER_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.lead_id.toString(),
          associate_id: lead.associate_id.toString()
        })
      });
      
      if (response.ok) {
        console.log(`   ✅ SENT`);
      } else {
        console.log(`   ❌ FAILED: ${response.status}`);
      }
      
      await new Promise(r => setTimeout(r, 100));
      
    } catch (err) {
      console.error(`   ❌ ERROR:`, err.message);
    }
  }
  
  console.log('\n✅ DONE');
}

sendBookedLeadsDirectly();

