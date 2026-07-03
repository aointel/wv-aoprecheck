#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const SUPABASE_URL = 'https://bvlltvuaslesouzlyzbf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bGx0dnVhc2xlc291emx5emJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxOTU5OTMxMywiZXhwIjoyMDM1MTc1MzEzfQ.5j5opMn_9FZhMqVPzGwnhX5Q1Kud6sDkLtmGhcVRjAo';
const ZAPIER_WEBHOOK = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendLead() {
  const leadId = 18922723;
  const associateId = '174801';
  
  console.log('🚀 SENDING LEAD TO PLANET VIA ZAPIER...\n');
  console.log(`Lead ID: ${leadId}`);
  console.log(`Associate ID: ${associateId}\n`);

  try {
    // 1. Get lead by database ID
    const { data: lead, error: leadError } = await supabase
      .from('masterlead')
      .select('*')
      .eq('id', leadId)
      .maybeSingle();

    if (leadError || !lead) {
      console.error('❌ Lead not found:', leadError);
      return;
    }

    console.log(`📋 Lead: ${lead.first_name} ${lead.last_name}`);
    console.log(`   Phone: ${lead.phone}`);
    console.log(`   Taalk Lead ID: ${lead.taalk_lead_id}`);
    console.log(`   Current Agent: ${lead.cn_email || 'None'}`);
    console.log(`   Resolution: ${lead.cnresolution || 'None'}\n`);

    if (!lead.taalk_lead_id) {
      console.error('❌ Missing taalk_lead_id - cannot send to Planet');
      return;
    }

    // 2. Send to Zapier webhook (forwards to Planet)
    const payload = {
      lead_id: lead.taalk_lead_id.toString(),
      associate_id: associateId
    };

    console.log('📤 Sending to Zapier webhook...');
    console.log(`   lead_id: ${payload.lead_id}`);
    console.log(`   associate_id: ${payload.associate_id}\n`);

    const response = await fetch(ZAPIER_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Webhook failed: ${response.status} - ${errorText}`);
      return;
    }

    const responseData = await response.json();
    console.log('✅ Webhook sent successfully!');
    console.log('Response:', JSON.stringify(responseData, null, 2));
    console.log('\n🎉 LEAD SENT TO PLANET VIA ZAPIER');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

sendLead();

