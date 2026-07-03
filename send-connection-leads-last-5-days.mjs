#!/usr/bin/env node

/**
 * Send all leads with qualifying connections from the last 5 days to Producer Resolutions webhook
 * Qualifying connections = any disposition that maps to a Producer Resolution code (1-6)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/15730596/um82e8j/';

// Map dispositions to Producer Resolutions format
// 1 = Pres, No Sale | 2 = Pres Refused | 3 = Bad Phone | 4 = Duplicate | 5 = Over Age | 6 = DNC
const dispositionMap = {
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

// Get qualifying dispositions (ones that map to Producer Resolution codes)
const qualifyingDispositions = Object.keys(dispositionMap);

async function sendConnectionLeads() {
  console.log('\n🚀 SENDING CONNECTION LEADS FROM LAST 5 DAYS TO PRODUCER RESOLUTIONS\n');
  console.log('='.repeat(80));
  
  try {
    // Calculate date 5 days ago
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const fiveDaysAgoISO = fiveDaysAgo.toISOString();
    
    console.log(`📅 Looking for leads with qualifying connections since: ${fiveDaysAgo.toISOString().split('T')[0]}\n`);
    
    // Fetch all leads from masterlead with qualifying dispositions in the last 5 days
    // Use pagination to fetch all records (Supabase default limit is 1000)
    console.log('📊 Fetching all qualifying leads (using pagination)...\n');
    
    let allLeads = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: batch, error: leadsError } = await supabase
        .from('masterlead')
        .select('*')
        .in('cnresolution', qualifyingDispositions)
        .or(`last_contacted.gte.${fiveDaysAgoISO},updated_at.gte.${fiveDaysAgoISO}`)
        .order('last_contacted', { ascending: false })
        .range(from, from + batchSize - 1);
      
      if (leadsError) {
        console.error('❌ Error fetching leads:', leadsError);
        return;
      }
      
      if (!batch || batch.length === 0) {
        hasMore = false;
      } else {
        allLeads = allLeads.concat(batch);
        console.log(`   Fetched ${batch.length} leads (total so far: ${allLeads.length})`);
        from += batchSize;
        
        if (batch.length < batchSize) {
          hasMore = false;
        }
      }
    }
    
    const leads = allLeads;
    
    if (!leads || leads.length === 0) {
      console.log('✅ No leads with qualifying connections found in the last 5 days');
      return;
    }
    
    console.log(`\n📋 Found ${leads.length} leads with qualifying connections\n`);
    
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    // Process each lead
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      const disposition = lead.cnresolution;
      const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown';
      
      console.log(`\n[${i + 1}/${leads.length}] Processing lead ${lead.id}: ${leadName}`);
      console.log(`   Disposition: ${disposition}`);
      console.log(`   Phone: ${lead.phone || 'N/A'}`);
      console.log(`   Agent: ${lead.cn_email || 'N/A'}`);
      console.log(`   Last Contacted: ${lead.last_contacted || 'N/A'}`);
      
      const producerResolution = dispositionMap[disposition?.toLowerCase()];
      
      if (producerResolution === undefined || producerResolution === null) {
        console.log(`   ⏭️ Skipping - disposition "${disposition}" does not map to a Producer Resolution`);
        skipCount++;
        continue;
      }
      
      // Build webhook payload
      const trackingPhone = lead.phone || lead.phone_number || '';
      const leadState = lead.state || lead.taalk_state || 'Unknown';
      
      const webhookPayload = {
        taalk_lead_id: lead.taalk_lead_id || lead.taalkLeadId || null,
        code: producerResolution,
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
        producerResolution: producerResolution,
        agentEmail: lead.cn_email || '',
        associateId: lead.associate_id ?? '',
        callDuration: lead.duration || 0,
        notes: lead.disposition_notes || lead.resolution_notes || '',
        market: lead?.market || lead?.taalk_market || lead?.taalk_groupname || 'Unknown',
        timestamp: new Date().toISOString(),
      };
      
      try {
        console.log(`   📤 Sending webhook...`);
        
        const response = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload)
        });
        
        if (response.ok) {
          console.log(`   ✅ Success (${response.status})`);
          successCount++;
        } else {
          const errorText = await response.text();
          console.log(`   ❌ Failed (${response.status}): ${errorText}`);
          failCount++;
        }
      } catch (webhookError) {
        console.error(`   ❌ Error sending webhook:`, webhookError.message);
        failCount++;
      }
      
      // Small delay between webhooks to avoid rate limiting
      if (i < leads.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 SUMMARY:');
    console.log(`   Total Leads Found: ${leads.length}`);
    console.log(`   ✅ Successfully Sent: ${successCount}`);
    console.log(`   ⏭️ Skipped (no mapping): ${skipCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log('\n✨ Done!\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

sendConnectionLeads()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

