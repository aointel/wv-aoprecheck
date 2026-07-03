/**
 * Script: Send First 10 Dispositions to Producer Resolutions Webhook
 * 
 * This script queries the masterlead table for leads with dispositions
 * and sends the first 10 to the Producer Resolutions Zapier webhook.
 * 
 * Run with: tsx server/send-first-10-dispositions.ts
 */

import { supabaseAdmin } from './supabase';
import { masterleadClient } from "./local-masterlead-client";

const WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/15730596/um82e8j/';

// Map dispositions to Producer Resolutions format
// 1 = Pres, No Sale | 2 = Pres Refused | 3 = Bad Phone | 4 = Duplicate | 5 = Over Age | 6 = DNC
const dispositionMap: Record<string, number | null> = {
  'booked': 1, // Pres, No Sale - presentation resulted in booking
  'instant_presentation': 1, // Pres, No Sale - presentation happened
  'sale': 1, // Pres, No Sale - presentation happened, resulted in sale
  'call_back': 1, // Pres, No Sale - likely had a presentation, requesting callback
  'callback': 1, // Pres, No Sale - callback requested (alternative spelling)
  'already_been_sold': 1, // Pres, No Sale - presentation happened but already sold
  'not_interested': 2, // Pres Refused - refused presentation
  'wrong_number': 3, // Bad Phone - wrong/bad phone number
  'duplicate': 4, // Duplicate - duplicate lead
  'over_age': 5, // Over Age - over age limit
  'do_not_call': 6, // DNC - do not call
  'dnc': 6, // DNC - do not call (alternative spelling)
};

async function sendDispositionWebhook(lead: any, disposition: string) {
  const producerResolution = dispositionMap[disposition.toLowerCase()];
  
  if (producerResolution === undefined || producerResolution === null) {
    console.log(`⏭️ Skipping lead ${lead.id} - disposition "${disposition}" does not map to a Producer Resolution`);
    return false;
  }

  const trackingPhone = lead.phone || lead.phone_number || '';
  const leadState = lead.state || lead.taalk_state || 'Unknown';
  const trackingName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown Lead';

  const webhookPayload = {
    taalk_lead_id: lead.taalk_lead_id || lead.taalkLeadId || null,
    code: producerResolution, // Producer Resolution code (1, 2, 3, 4, 5, 6)
    phone: trackingPhone,
    leadId: lead.id,
    lead_id: lead.lead_id || lead.id,
    firstName: lead.first_name || '',
    lastName: lead.last_name || '',
    email: lead.email || lead.taalk_email || '',
    city: lead.city || lead.taalk_city || '',
    state: leadState,
    zip: lead.zip || lead.taalk_zip || '',
    disposition: disposition,
    producerResolution: producerResolution, // Keep for backward compatibility
    agentEmail: lead.cn_email || '',
    associateId: lead.associate_id ?? '',
    callDuration: lead.duration || 0,
    notes: lead.disposition_notes || lead.resolution_notes || '',
    market: lead?.market || lead?.taalk_market || lead?.taalk_groupname || 'Unknown',
    timestamp: new Date().toISOString(),
  };

  try {
    console.log(`📤 Sending webhook for lead ${lead.id} (${trackingName}): disposition="${disposition}", code=${producerResolution}`);
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    if (response.ok) {
      console.log(`✅ Webhook sent successfully for lead ${lead.id} (code ${producerResolution})`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`❌ Webhook failed for lead ${lead.id}: ${response.status} ${response.statusText}`, errorText);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error sending webhook for lead ${lead.id}:`, error);
    return false;
  }
}

async function sendFirst10Dispositions() {
  console.log('\n📤 SENDING FIRST 10 DISPOSITIONS TO PRODUCER RESOLUTIONS WEBHOOK\n');
  console.log('='.repeat(80));

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  try {
    // Query masterlead for leads with dispositions (cnresolution is not null and not empty)
    console.log('\n🔍 Querying masterlead for leads with dispositions...');
    
    const { data: leads, error } = await masterleadClient.from('masterlead')
      .select('*')
      .not('cnresolution', 'is', null)
      .neq('cnresolution', '')
      .neq('cnresolution', 'pending')
      .order('updated_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error querying masterlead:', error);
      process.exit(1);
    }

    if (!leads || leads.length === 0) {
      console.log('⚠️ No leads with dispositions found in masterlead table');
      process.exit(0);
    }

    console.log(`✅ Found ${leads.length} leads with dispositions\n`);

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    // Send webhook for each lead
    for (const lead of leads) {
      const disposition = lead.cnresolution;
      const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown';
      
      console.log(`\n📋 Processing lead ${lead.id}: ${leadName}`);
      console.log(`   Disposition: ${disposition}`);
      console.log(`   Taalk Lead ID: ${lead.taalk_lead_id || 'N/A'}`);
      console.log(`   Phone: ${lead.phone || lead.phone_number || 'N/A'}`);

      const producerResolution = dispositionMap[disposition?.toLowerCase()];
      
      if (producerResolution === undefined || producerResolution === null) {
        console.log(`   ⏭️ Skipping - disposition "${disposition}" does not map to a Producer Resolution`);
        skipCount++;
        continue;
      }

      const success = await sendDispositionWebhook(lead, disposition);
      
      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // Small delay between webhooks to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 SUMMARY:');
    console.log(`   ✅ Successfully sent: ${successCount}`);
    console.log(`   ⏭️ Skipped (no mapping): ${skipCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📦 Total processed: ${leads.length}`);
    console.log('\n');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
sendFirst10Dispositions()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

