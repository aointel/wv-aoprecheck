/**
 * Analyze Priority 99 Leads - Reached and Booked Counts
 * 
 * This script queries masterlead for priority_score = 99 leads and determines:
 * 1. How many are "reached" (human contact with >= 30s duration on answered call)
 * 2. How many are "booked" (appointment set)
 */

import { supabaseAdmin } from '../supabase.js';

interface Priority99Stats {
  totalPriority99: number;
  reached: number;
  booked: number;
  reachedDetails: Array<{
    leadId: number;
    phone: string;
    name: string;
    reachedVia: 'agent_dial_metrics' | 'twilio_call_logs';
    callDuration?: number;
    callStatus?: string;
  }>;
  bookedDetails: Array<{
    leadId: number;
    phone: string;
    name: string;
    disposition?: string;
    callDuration?: number;
  }>;
}

async function analyzePriority99ReachedAndBooked(): Promise<Priority99Stats> {
  console.log('🔍 Analyzing Priority 99 leads (reached and booked)...\n');

  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not available');
  }

  // Step 1: Get all priority 99 leads from masterlead (NO LIMIT - fetch all)
  console.log('📋 Step 1: Fetching ALL priority 99 leads from masterlead (no limit)...');
  
  // Fetch all priority 99 leads in batches to avoid any limits
  let allPriority99Leads: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('masterlead')
      .select('id, first_name, last_name, phone, cn_email, cnresolution, priority_score')
      .eq('priority_score', 99)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (batchError) {
      throw new Error(`Failed to fetch priority 99 leads batch ${page + 1}: ${batchError.message}`);
    }

    if (batch && batch.length > 0) {
      allPriority99Leads = [...allPriority99Leads, ...batch];
      console.log(`  Fetched batch ${page + 1}: ${batch.length} leads (total so far: ${allPriority99Leads.length})`);
      hasMore = batch.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  const priority99Leads = allPriority99Leads;
  const totalPriority99 = priority99Leads?.length || 0;
  console.log(`✅ Found ${totalPriority99} priority 99 leads\n`);

  if (totalPriority99 === 0) {
    return {
      totalPriority99: 0,
      reached: 0,
      booked: 0,
      reachedDetails: [],
      bookedDetails: []
    };
  }

  // Step 2: Check for "reached" status
  // A lead is "reached" if:
  // - There's a 'reach' event in agent_dial_metrics for this lead's phone
  // - OR there's a twilio_call_logs entry with call_status IN ('answered', 'completed') and call_duration >= 30
  console.log('📞 Step 2: Checking for "reached" status...');
  
  const leadPhones = priority99Leads.map(lead => lead.phone?.replace(/\D/g, '')).filter(Boolean);
  const reachedDetails: Priority99Stats['reachedDetails'] = [];
  const reachedLeadIds = new Set<number>();

  // Check agent_dial_metrics for 'reach' events
  // Process in batches since .in() has limits
  if (leadPhones.length > 0) {
    console.log(`  Processing ${leadPhones.length} phone numbers in batches...`);
    const batchSize = 500; // Supabase .in() limit is typically 1000, using 500 to be safe
    let allReachMetrics: any[] = [];
    
    for (let i = 0; i < leadPhones.length; i += batchSize) {
      const phoneBatch = leadPhones.slice(i, i + batchSize);
      const { data: reachMetrics, error: reachError } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('lead_id, lead_phone, call_duration, call_status')
        .eq('event_type', 'reach')
        .in('lead_phone', phoneBatch);
      
      if (reachError) {
        console.warn(`  ⚠️ Error fetching reach metrics for batch ${Math.floor(i / batchSize) + 1}:`, reachError);
      } else if (reachMetrics) {
        allReachMetrics = [...allReachMetrics, ...reachMetrics];
      }
    }
    
    const reachMetrics = allReachMetrics;

    if (reachMetrics && reachMetrics.length > 0) {
      for (const metric of reachMetrics) {
        const leadId = metric.lead_id;
        if (leadId && !reachedLeadIds.has(leadId)) {
          const lead = priority99Leads.find(l => l.id === leadId);
          if (lead) {
            reachedLeadIds.add(leadId);
            reachedDetails.push({
              leadId,
              phone: lead.phone || '',
              name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown',
              reachedVia: 'agent_dial_metrics',
              callDuration: metric.call_duration || undefined,
              callStatus: metric.call_status || undefined
            });
          }
        }
      }
    }

    // Also check by phone number match (in case lead_id is null)
    for (const lead of priority99Leads) {
      if (reachedLeadIds.has(lead.id)) continue;
      
      const cleanPhone = lead.phone?.replace(/\D/g, '');
      if (!cleanPhone) continue;

      const { data: reachByPhone, error: phoneError } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('call_duration, call_status')
        .eq('event_type', 'reach')
        .eq('lead_phone', cleanPhone)
        .limit(1);

      if (!phoneError && reachByPhone && reachByPhone.length > 0) {
        reachedLeadIds.add(lead.id);
        reachedDetails.push({
          leadId: lead.id,
          phone: lead.phone || '',
          name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown',
          reachedVia: 'agent_dial_metrics',
          callDuration: reachByPhone[0].call_duration || undefined,
          callStatus: reachByPhone[0].call_status || undefined
        });
      }
    }

    // Check twilio_call_logs for answered calls with duration >= 30
    for (const lead of priority99Leads) {
      if (reachedLeadIds.has(lead.id)) continue;
      
      const cleanPhone = lead.phone?.replace(/\D/g, '');
      if (!cleanPhone) continue;

      // Try to match by phone number (to_number in twilio_call_logs)
      const { data: twilioCalls, error: twilioError } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('call_duration, call_status, to_number')
        .eq('to_number', cleanPhone)
        .in('call_status', ['answered', 'completed'])
        .gte('call_duration', 30)
        .limit(1);

      if (!twilioError && twilioCalls && twilioCalls.length > 0) {
        reachedLeadIds.add(lead.id);
        reachedDetails.push({
          leadId: lead.id,
          phone: lead.phone || '',
          name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown',
          reachedVia: 'twilio_call_logs',
          callDuration: twilioCalls[0].call_duration || undefined,
          callStatus: twilioCalls[0].call_status || undefined
        });
      }
    }
  }

  const reached = reachedLeadIds.size;
  console.log(`✅ Found ${reached} reached priority 99 leads\n`);

  // Step 3: Check for "booked" status
  // A lead is "booked" if:
  // - There's a 'booked' event in agent_dial_metrics for this lead's phone
  // - OR there's a disposition in agent_dial_metrics that indicates booking
  console.log('📅 Step 3: Checking for "booked" status...');
  
  const bookedDetails: Priority99Stats['bookedDetails'] = [];
  const bookedLeadIds = new Set<number>();
  const bookedDispositions = ['appointment', 'booked', 'qualified', 'callback_scheduled', 'instant_presentation', 'sale', 'meet'];

  if (leadPhones.length > 0) {
    // Check agent_dial_metrics for 'booked' events
    // Process in batches since .in() has limits
    console.log(`  Processing ${leadPhones.length} phone numbers in batches...`);
    const batchSize = 500;
    let allBookedMetrics: any[] = [];
    
    for (let i = 0; i < leadPhones.length; i += batchSize) {
      const phoneBatch = leadPhones.slice(i, i + batchSize);
      const { data: bookedMetrics, error: bookedError } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('lead_id, lead_phone, disposition, call_duration')
        .eq('event_type', 'booked')
        .in('lead_phone', phoneBatch);
      
      if (bookedError) {
        console.warn(`  ⚠️ Error fetching booked metrics for batch ${Math.floor(i / batchSize) + 1}:`, bookedError);
      } else if (bookedMetrics) {
        allBookedMetrics = [...allBookedMetrics, ...bookedMetrics];
      }
    }
    
    const bookedMetrics = allBookedMetrics;

    if (!bookedError && bookedMetrics) {
      for (const metric of bookedMetrics) {
        const leadId = metric.lead_id;
        if (leadId && !bookedLeadIds.has(leadId)) {
          const lead = priority99Leads.find(l => l.id === leadId);
          if (lead) {
            bookedLeadIds.add(leadId);
            bookedDetails.push({
              leadId,
              phone: lead.phone || '',
              name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown',
              disposition: metric.disposition || undefined,
              callDuration: metric.call_duration || undefined
            });
          }
        }
      }
    }

    // Also check by phone number and booked dispositions
    for (const lead of priority99Leads) {
      if (bookedLeadIds.has(lead.id)) continue;
      
      const cleanPhone = lead.phone?.replace(/\D/g, '');
      if (!cleanPhone) continue;

      const { data: bookedByPhone, error: phoneError } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('disposition, call_duration')
        .eq('lead_phone', cleanPhone)
        .in('disposition', bookedDispositions)
        .limit(1);

      if (!phoneError && bookedByPhone && bookedByPhone.length > 0) {
        bookedLeadIds.add(lead.id);
        bookedDetails.push({
          leadId: lead.id,
          phone: lead.phone || '',
          name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown',
          disposition: bookedByPhone[0].disposition || undefined,
          callDuration: bookedByPhone[0].call_duration || undefined
        });
      }
    }
  }

  const booked = bookedLeadIds.size;
  console.log(`✅ Found ${booked} booked priority 99 leads\n`);

  return {
    totalPriority99,
    reached,
    booked,
    reachedDetails,
    bookedDetails
  };
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('analyze-priority-99-reached-booked.ts');
if (isMainModule) {
  analyzePriority99ReachedAndBooked()
    .then((stats) => {
      console.log('\n📊 PRIORITY 99 LEADS ANALYSIS RESULTS');
      console.log('=' .repeat(50));
      console.log(`Total Priority 99 Leads: ${stats.totalPriority99}`);
      console.log(`Reached (Human Contact): ${stats.reached} (${stats.totalPriority99 > 0 ? ((stats.reached / stats.totalPriority99) * 100).toFixed(1) : 0}%)`);
      console.log(`Booked (Appointment Set): ${stats.booked} (${stats.totalPriority99 > 0 ? ((stats.booked / stats.totalPriority99) * 100).toFixed(1) : 0}%)`);
      
      if (stats.reachedDetails.length > 0) {
        console.log('\n📞 REACHED LEADS DETAILS:');
        stats.reachedDetails.forEach((detail, index) => {
          console.log(`  ${index + 1}. Lead ID ${detail.leadId}: ${detail.name} (${detail.phone})`);
          console.log(`     - Reached via: ${detail.reachedVia}`);
          if (detail.callDuration) console.log(`     - Call Duration: ${detail.callDuration}s`);
          if (detail.callStatus) console.log(`     - Call Status: ${detail.callStatus}`);
        });
      }
      
      if (stats.bookedDetails.length > 0) {
        console.log('\n📅 BOOKED LEADS DETAILS:');
        stats.bookedDetails.forEach((detail, index) => {
          console.log(`  ${index + 1}. Lead ID ${detail.leadId}: ${detail.name} (${detail.phone})`);
          if (detail.disposition) console.log(`     - Disposition: ${detail.disposition}`);
          if (detail.callDuration) console.log(`     - Call Duration: ${detail.callDuration}s`);
        });
      }
      
      console.log('\n✅ Analysis complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Analysis failed:', error);
      process.exit(1);
    });
}

export { analyzePriority99ReachedAndBooked };
