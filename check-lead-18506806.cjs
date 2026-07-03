#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bvlltvuaslesouzlyzbf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bGx0dnVhc2xlc291emx5emJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxOTU5OTMxMywiZXhwIjoyMDM1MTc1MzEzfQ.5j5opMn_9FZhMqVPzGwnhX5Q1Kud6sDkLtmGhcVRjAo';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkLead() {
  try {
    console.log('🔍 Checking lead 18506806...\n');
    
    const { data: lead, error } = await supabase
      .from('masterlead')
      .select('*')
      .eq('taalk_lead_id', '18506806')
      .maybeSingle();
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    if (!lead) {
      console.log('❌ Lead not found with taalk_lead_id = 18506806');
      return;
    }
    
    console.log('📋 Lead Details:');
    console.log(`   Name: ${lead.first_name} ${lead.last_name}`);
    console.log(`   Phone: ${lead.phone}`);
    console.log(`   Agent: ${lead.cn_email}`);
    console.log(`   Resolution: ${lead.cnresolution}`);
    console.log(`   Resolved At: ${lead.resolved_at}`);
    console.log(`   Webhook Sent At: ${lead.webhook_sent_at || 'NOT SENT YET'}`);
    console.log(`   Taalk Lead ID: ${lead.taalk_lead_id}\n`);
    
    if (lead.cnresolution !== 'booked') {
      console.log(`⚠️ Lead is NOT marked as 'booked' (current: ${lead.cnresolution})`);
      console.log('   Only leads with cnresolution=booked are sent to webhook');
      return;
    }
    
    if (!lead.cn_email) {
      console.log('❌ Lead is missing cn_email (agent email) - cannot get associate_id');
      return;
    }
    
    // Get associate_id
    const { data: agent, error: agentError } = await supabase
      .from('customers')
      .select('associate_id, first_name, last_name')
      .eq('company_email', lead.cn_email.toLowerCase().trim())
      .maybeSingle();
    
    if (agentError || !agent) {
      console.log(`❌ No agent found in customers table for ${lead.cn_email}`);
      return;
    }
    
    console.log('👤 Agent Details:');
    console.log(`   Name: ${agent.first_name} ${agent.last_name}`);
    console.log(`   Email: ${lead.cn_email}`);
    console.log(`   Associate ID: ${agent.associate_id}\n`);
    
    if (lead.webhook_sent_at) {
      console.log(`✅ Webhook was already sent at: ${lead.webhook_sent_at}`);
    } else {
      console.log('⏳ Webhook pending - will be sent within 60 seconds by automatic sender');
    }
    
    console.log('\n📤 Webhook Payload:');
    console.log(`   lead_id: ${lead.taalk_lead_id}`);
    console.log(`   associate_id: ${agent.associate_id}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkLead();

