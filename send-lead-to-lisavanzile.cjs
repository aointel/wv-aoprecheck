/**
 * One-off: Send lead Julie Mazak (taalk_lead_id 19100398) to Lisa Vanzile via Zapier
 * Agent: lisavanzile@aoglobelife.com, associate_id: 185556
 */
require('dotenv').config();
const fetch = require('node-fetch');

const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';

const payload = {
  lead_id: "19100398",   // taalk_lead_id from the lead
  associate_id: "185556" // Lisa Vanzile's associate_id
};

async function send() {
  console.log('🚀 Sending lead Julie Mazak to Lisa Vanzile (lisavanzile@aoglobelife.com) via Zapier...\n');
  console.log('📤 Payload:', JSON.stringify(payload, null, 2));

  const response = await fetch(ZAPIER_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  console.log(`\n📥 Response: ${response.status}`);
  console.log(text);
  if (response.ok) {
    console.log('\n✅ Lead sent to Zapier successfully!');
  } else {
    console.log('\n❌ Failed');
  }
}

send().catch(console.error);
