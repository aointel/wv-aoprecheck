#!/usr/bin/env node

const fetch = require('node-fetch');

const API_URL = 'https://aoirail-production.up.railway.app/api/email/send-vdp-refunds';

// Agents who received refunds
const refunds = [
  { email: 'gageharrington@aoglobelife.com', name: 'Gage Harrington', credits: 152, duplicates: 19 },
  { email: 'josiahmonett@aoglobelife.com', name: 'Josiah Monett', credits: 112, duplicates: 14 },
  { email: 'mohamedalgohaim@aoglobelife.com', name: 'Mohamed Algohaim', credits: 96, duplicates: 12 },
  { email: 'anthonylulgjuraj@aoglobelife.com', name: 'Anthony Lulgjuraj', credits: 80, duplicates: 10 },
  { email: 'devingould@aoglobelife.com', name: 'Devin Gould', credits: 80, duplicates: 10 },
  { email: 'millergerald@aoglobelife.com', name: 'Gerald Miller', credits: 72, duplicates: 9 },
  { email: 'chrislafond@aoglobelife.com', name: 'Christopher Lafond', credits: 64, duplicates: 8 },
  { email: 'lisablanco@aoglobelife.com', name: 'Lisa Blanco', credits: 64, duplicates: 8 },
  { email: 'dominiquecarter@aoglobelife.com', name: 'Dominique Carter', credits: 32, duplicates: 4 },
  { email: 'jacobvaldellon@aoglobelife.com', name: 'Jacob Valdellon', credits: 32, duplicates: 4 },
  { email: 'ankitadas@aoglobelife.com', name: 'Ankita Das', credits: 32, duplicates: 4 },
  { email: 'arthurscott@aoglobelife.com', name: 'Arthur Scott', credits: 24, duplicates: 3 },
  { email: 'bridgetcallahan@aoglobelife.com', name: 'Bridget Callahan', credits: 16, duplicates: 2 },
  { email: 'richardlafond@aoglobelife.com', name: 'Richard Lafond', credits: 16, duplicates: 2 },
  { email: 'jameshannah@aoglobelife.com', name: 'Hannah James', credits: 16, duplicates: 2 },
  { email: 'joecasiasjr@aoglobelife.com', name: 'Joe Casias', credits: 16, duplicates: 2 },
  { email: 'francesbrewer@aoglobelife.com', name: 'Frances Brewer', credits: 16, duplicates: 2 },
  { email: 'smithterrell@aoglobelife.com', name: 'Terrell Smith', credits: 16, duplicates: 2 }
];

async function sendViaBackend() {
  console.log('📧 Sending VDP refund notifications via backend...\n');
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refunds })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Backend response:', result);
      console.log(`\n📊 Emails sent: ${result.sent} of ${result.total}`);
    } else {
      const error = await response.text();
      console.error(`❌ Backend error: ${response.status} - ${error}`);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

sendViaBackend();

