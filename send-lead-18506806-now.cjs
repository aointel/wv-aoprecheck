#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const SUPABASE_URL = 'https://bvlltvuaslesouzlyzbf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bGx0dnVhc2xlc291emx5emJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxOTU5OTMxMywiZXhwIjoyMDM1MTc1MzEzfQ.5j5opMn_9FZhMqVPzGwnhX5Q1Kud6sDkLtmGhcVRjAo';
const ZAPIER_WEBHOOK = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendLead() {
  console.log('🚀 SENDING LEAD 18506806 NOW...\n');

  try {
    // 1. Get lead
    const { data: lead, error: leadError } = await supabase
      .from('masterlead')
      .select('*')
      .eq('taalk_lead_id', '18506806')
      .maybeSingle();

    if (leadError || !lead) {
      console.error('❌ Lead not found:', leadError);
      return;
    }

    console.log(`📋 Lead: ${lead.first_name} ${lead.last_name}`);
    console.log(`   Agent: ${lead.cn_email}`);
    console.log(`   Resolution: ${lead.cnresolution}`);

    if (lead.cnresolution !== 'booked') {
      console.error(`❌ Lead is NOT booked (${lead.cnresolution})`);
      return;
    }

    if (!lead.cn_email) {
      console.error('❌ Missing agent email');
      return;
    }

    // 2. Get associate_id
    const { data: agent, error: agentError } = await supabase
      .from('customers')
      .select('associate_id, first_name, last_name')
      .eq('company_email', lead.cn_email.toLowerCase().trim())
      .maybeSingle();

    if (agentError || !agent || !agent.associate_id) {
      console.error('❌ Agent not found or missing associate_id:', agentError);
      return;
    }

    console.log(`👤 Agent: ${agent.first_name} ${agent.last_name} (${agent.associate_id})\n`);

    // 3. Send to Zapier
    const payload = {
      lead_id: lead.taalk_lead_id.toString(),
      associate_id: agent.associate_id
    };

    console.log('📤 Sending to webhook...');
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

    console.log('✅ Webhook sent successfully!\n');

    // 4. Mark as sent in database
    const { error: updateError } = await supabase
      .from('masterlead')
      .update({ webhook_sent_at: new Date().toISOString() })
      .eq('id', lead.id);

    if (updateError) {
      console.error('⚠️ Failed to update webhook_sent_at:', updateError);
    } else {
      console.log('✅ Database updated - webhook_sent_at marked');
    }

    console.log('\n🎉 LEAD 18506806 SENT TO ZAPIER WEBHOOK');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

sendLead();

