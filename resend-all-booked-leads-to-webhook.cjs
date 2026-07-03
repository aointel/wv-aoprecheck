#!/usr/bin/env node

/**
 * Manually resend ALL booked leads to Planet ALTIG Zapier webhook
 * This resets webhook_sent_at to NULL and then triggers the sender
 */

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const SUPABASE_URL = 'https://bvlltvuaslesouzlyzbf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bGx0dnVhc2xlc291emx5emJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxOTU5OTMxMywiZXhwIjoyMDM1MTc1MzEzfQ.5j5opMn_9FZhMqVPzGwnhX5Q1Kud6sDkLtmGhcVRjAo';
const ZAPIER_WEBHOOK = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function resendAllBookedLeads() {
  try {
    console.log('🚀 RESENDING ALL BOOKED LEADS TO WEBHOOK\n');
    
    // Step 1: Reset webhook_sent_at for all booked leads
    console.log('Step 1: Resetting webhook_sent_at for all booked leads...');
    const { data: resetData, error: resetError } = await supabase
      .from('masterlead')
      .update({ webhook_sent_at: null })
      .eq('cnresolution', 'booked')
      .select('id');
    
    if (resetError) {
      console.error('❌ Error resetting webhook_sent_at:', resetError);
      return;
    }
    
    console.log(`✅ Reset ${resetData?.length || 0} booked leads for resending\n`);
    
    // Step 2: Get all booked leads
    console.log('Step 2: Fetching all booked leads with required data...');
    const { data: bookedLeads, error: fetchError } = await supabase
      .from('masterlead')
      .select('id, taalk_lead_id, cn_email, first_name, last_name, phone, state, resolved_at')
      .eq('cnresolution', 'booked')
      .not('taalk_lead_id', 'is', null)
      .not('cn_email', 'is', null)
      .order('resolved_at', { ascending: false });
    
    if (fetchError) {
      console.error('❌ Error fetching booked leads:', fetchError);
      return;
    }
    
    if (!bookedLeads || bookedLeads.length === 0) {
      console.log('⚠️ No booked leads found with required data (taalk_lead_id + cn_email)');
      return;
    }
    
    console.log(`📊 Found ${bookedLeads.length} booked leads to send\n`);
    
    // Step 3: Send each lead to webhook
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    
    for (const lead of bookedLeads) {
      try {
        // Get associate_id for the agent
        const { data: agent, error: agentError } = await supabase
          .from('customers')
          .select('associate_id')
          .eq('company_email', lead.cn_email.toLowerCase().trim())
          .limit(1)
          .maybeSingle();
        
        if (agentError || !agent?.associate_id) {
          console.error(`❌ No associate_id for ${lead.cn_email} - skipping lead ${lead.taalk_lead_id}`);
          skipped++;
          continue;
        }
        
        const payload = {
          lead_id: lead.taalk_lead_id.toString(),
          associate_id: agent.associate_id
        };
        
        console.log(`📤 Sending: ${lead.first_name} ${lead.last_name} | lead_id=${lead.taalk_lead_id} | associate_id=${agent.associate_id}`);
        
        const response = await fetch(ZAPIER_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (response.ok) {
          // Mark as sent
          await supabase
            .from('masterlead')
            .update({ webhook_sent_at: new Date().toISOString() })
            .eq('id', lead.id);
          
          console.log(`   ✅ Sent successfully`);
          sent++;
        } else {
          const errorText = await response.text();
          console.error(`   ❌ Webhook failed (${response.status}): ${errorText}`);
          failed++;
        }
        
        // Rate limit - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (err) {
        console.error(`   ❌ Error:`, err.message);
        failed++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESEND COMPLETE:');
    console.log(`   ✅ Sent: ${sent}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⏭️ Skipped: ${skipped} (missing associate_id)`);
    console.log(`   📊 Total Processed: ${bookedLeads.length}`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

resendAllBookedLeads();

