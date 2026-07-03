#!/usr/bin/env node

/**
 * Trigger the backend to resend ALL booked leads to Zapier webhook
 */

const fetch = require('node-fetch');

const API_URL = 'https://aoirail-production.up.railway.app/api/webhook/resend-all-booked-leads';

async function triggerResend() {
  try {
    console.log('🚀 Triggering backend to resend ALL booked leads...\n');
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ SUCCESS:', data.message);
      console.log(`📊 Booked leads reset: ${data.resetCount}`);
      console.log('\nThe backend is now sending all booked leads to the Zapier webhook.');
      console.log('Check Railway logs to see progress.');
    } else {
      console.error('❌ FAILED:', data.error || data);
    }
    
  } catch (error) {
    console.error('❌ Error triggering resend:', error.message);
  }
}

triggerResend();

