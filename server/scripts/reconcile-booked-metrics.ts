/**
 * Reconcile booked metrics
 * 
 * This script:
 * 1. Finds all leads in masterlead with cnresolution = 'booked'
 * 2. For each booked lead, finds the corresponding Twilio call
 * 3. Validates the call meets requirements (duration >= 120s, status IN ('answered', 'completed'))
 * 4. Creates booked metric in agent_dial_metrics if valid and missing
 * 5. Provides summary of reconciliation
 */

import { supabaseAdmin } from '../supabase';
import { logCallOutcome } from '../agent-dial-metrics-tracker';

const BOOKED_MIN_DURATION = 120; // 2 minutes (120 seconds)

async function reconcileBookedMetrics() {
  console.log('🚀 Starting booked metrics reconciliation...\n');
  console.log(`📋 Requirements for "booked":`);
  console.log(`  - call_status IN ('answered', 'completed')`);
  console.log(`  - call_duration >= ${BOOKED_MIN_DURATION} seconds (2 minutes)\n`);

  try {
    // Step 1: Find all leads with cnresolution = 'booked'
    console.log('📋 Step 1: Finding all leads with cnresolution = "booked"...');
    const { data: bookedLeads, error: leadsError } = await supabaseAdmin
      .from('masterlead')
      .select('id, phone, cn_email, cnresolution, last_contacted, updated_at')
      .eq('cnresolution', 'booked')
      .not('cn_email', 'is', null)
      .not('phone', 'is', null);
    
    if (leadsError) {
      console.error('❌ Error fetching booked leads:', leadsError);
      return;
    }
    
    console.log(`📊 Found ${bookedLeads?.length || 0} leads with cnresolution = "booked"`);
    
    if (!bookedLeads || bookedLeads.length === 0) {
      console.log('✅ No booked leads to reconcile');
      return;
    }
    
    // Step 2: For each booked lead, find the corresponding Twilio call and validate
    console.log('\n📋 Step 2: Validating booked leads against Twilio call logs...');
    
    let validBooked = 0;
    let invalidBooked = 0;
    let missingCalls = 0;
    let metricsCreated = 0;
    let metricsAlreadyExist = 0;
    
    for (const lead of bookedLeads) {
      const agentEmail = lead.cn_email?.toLowerCase().trim();
      const leadPhone = lead.phone?.replace(/\D/g, ''); // Normalize phone
      
      if (!agentEmail || !leadPhone || leadPhone.length < 10) {
        console.log(`  ⚠️ Skipping lead ${lead.id}: missing agent email or invalid phone`);
        continue;
      }
      
      // Find Twilio call for this lead (look in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const phoneVariations = [
        leadPhone,
        `+1${leadPhone}`,
        `+${leadPhone}`,
        `1${leadPhone}`
      ];
      
      // Try to find the call
      const { data: twilioCalls, error: callError } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('twilio_call_sid, call_duration, call_status, call_started_at, owner_email, to_number')
        .in('to_number', phoneVariations)
        .eq('owner_email', agentEmail)
        .in('call_status', ['answered', 'completed'])
        .gte('call_started_at', thirtyDaysAgo.toISOString())
        .order('call_started_at', { ascending: false })
        .limit(5); // Get up to 5 recent calls to find the right one
      
      if (callError) {
        console.warn(`  ⚠️ Error finding Twilio call for lead ${lead.id}:`, callError.message);
        missingCalls++;
        continue;
      }
      
      if (!twilioCalls || twilioCalls.length === 0) {
        console.log(`  ⚠️ Lead ${lead.id}: No matching Twilio call found (phone: ${leadPhone}, agent: ${agentEmail})`);
        missingCalls++;
        continue;
      }
      
      // Find the call that matches best (prefer calls with duration >= 120s)
      const validCall = twilioCalls.find(call => 
        call.call_duration && call.call_duration >= BOOKED_MIN_DURATION
      ) || twilioCalls[0]; // Fall back to most recent if none meet duration
      
      const callDuration = validCall.call_duration || 0;
      const callStatus = (validCall.call_status || '').toLowerCase();
      const callSid = validCall.twilio_call_sid;
      
      // Validate the call
      const isValidStatus = callStatus === 'answered' || callStatus === 'completed';
      const isValidDuration = callDuration >= BOOKED_MIN_DURATION;
      const isValid = isValidStatus && isValidDuration;
      
      if (!isValid) {
        console.log(`  ❌ Invalid booked: Lead ${lead.id} (phone: ${leadPhone}, agent: ${agentEmail}) - duration: ${callDuration}s, status: ${callStatus}`);
        invalidBooked++;
        continue;
      }
      
      validBooked++;
      
      // Check if booked metric already exists (last 30 days)
      const { data: existingMetrics, error: metricsError } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('id')
        .eq('agent_email', agentEmail)
        .eq('lead_phone', leadPhone)
        .or('event_type.eq.booked,disposition.eq.booked')
        .gte('event_timestamp', thirtyDaysAgo.toISOString())
        .limit(1);
      
      if (metricsError) {
        console.warn(`  ⚠️ Error checking existing metrics for lead ${lead.id}:`, metricsError.message);
        continue;
      }
      
      if (existingMetrics && existingMetrics.length > 0) {
        metricsAlreadyExist++;
        continue; // Metric already exists
      }
      
      // Create booked metric
      try {
        await logCallOutcome(supabaseAdmin, {
          agentEmail: agentEmail,
          leadId: lead.id,
          leadPhone: leadPhone,
          eventType: 'booked',
          callDuration: callDuration,
          callStatus: callStatus,
          callSid: callSid,
          disposition: 'booked',
          source: 'reconciliation',
          notes: 'Reconciled from masterlead.cnresolution = booked'
        });
        
        metricsCreated++;
        console.log(`  ✅ Created booked metric: Lead ${lead.id} (phone: ${leadPhone}, agent: ${agentEmail}, duration: ${callDuration}s)`);
      } catch (error) {
        console.error(`  ❌ Error creating booked metric for lead ${lead.id}:`, error);
      }
    }
    
    // Summary
    console.log('\n📊 Reconciliation Summary:');
    console.log(`  Total booked leads: ${bookedLeads.length}`);
    console.log(`  ✅ Valid booked (meets requirements): ${validBooked}`);
    console.log(`  ❌ Invalid booked (doesn't meet requirements): ${invalidBooked}`);
    console.log(`  ⚠️ Missing Twilio calls: ${missingCalls}`);
    console.log(`  📝 Metrics created: ${metricsCreated}`);
    console.log(`  ✓ Metrics already exist: ${metricsAlreadyExist}`);
    
  } catch (error) {
    console.error('❌ Error during reconciliation:', error);
    throw error;
  }
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('reconcile-booked-metrics.ts');
if (isMainModule) {
  reconcileBookedMetrics()
    .then(() => {
      console.log('\n✅ Reconciliation completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Reconciliation failed:', error);
      process.exit(1);
    });
}

export { reconcileBookedMetrics };
