/**
 * BACKFILL: HOTLEAD WEBHOOKS (LAST 3 DAYS)
 * 
 * This script finds:
 * 1. ALL reach events (any duration) for hotleads from the LAST 3 DAYS
 * 2. ALL booked leads (cnresolution = 'booked') from masterlead in the LAST 3 DAYS
 * 
 * Then sends webhooks to assign these leads to the agents.
 * 
 * Run with: npm run backfill-45-second-hotlead-webhooks
 */

import { supabaseAdmin } from '../supabase';

interface HotleadWebhookCandidate {
  id: number;
  agentEmail: string;
  agentName?: string;
  leadId: number | null;
  leadPhone: string;
  leadName?: string;
  callDuration: number;
  eventTimestamp: string;
  isBooked?: boolean; // true if this is from a booked lead
  leadData?: {
    id: number;
    first_name?: string;
    last_name?: string;
    phone?: string;
    is_hot_lead: boolean;
    cn_email?: string;
    taalk_lead_id?: string;
    taalk_market?: string;
  };
}

const WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';

/**
 * Get date range for last 3 days in EST/EDT timezone
 * Returns start of 3 days ago and end of today
 */
function getLast3DaysEST(): { start: Date; end: Date } {
  const now = new Date();
  
  // Get current date in EST/EDT
  const estFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // End: Today at 23:59:59.999 EST
  const estEndParts = estFormatter.formatToParts(now);
  const endYear = estEndParts.find(p => p.type === 'year')!.value;
  const endMonth = estEndParts.find(p => p.type === 'month')!.value;
  const endDay = estEndParts.find(p => p.type === 'day')!.value;
  
  // Determine DST for today
  const endMonthNum = parseInt(endMonth);
  const endDayNum = parseInt(endDay);
  let endIsDST = false;
  if (endMonthNum > 3 && endMonthNum < 11) {
    endIsDST = true;
  } else if (endMonthNum === 3 && endDayNum >= 10) {
    endIsDST = true;
  } else if (endMonthNum === 11 && endDayNum < 3) {
    endIsDST = true;
  }
  
  const endOffsetHours = endIsDST ? -4 : -5;
  const endOffsetStr = endOffsetHours < 0 
    ? `-${Math.abs(endOffsetHours).toString().padStart(2, '0')}:00`
    : `+${endOffsetHours.toString().padStart(2, '0')}:00`;
  
  const estEndStr = `${endYear}-${endMonth}-${endDay}T23:59:59.999`;
  const end = new Date(`${estEndStr}${endOffsetStr}`);
  
  // Start: 3 days ago at 00:00:00 EST
  // Calculate 3 days ago by creating a date 3 days before today in EST
  const threeDaysAgoUTC = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
  const estStartParts = estFormatter.formatToParts(threeDaysAgoUTC);
  const startYear = estStartParts.find(p => p.type === 'year')!.value;
  const startMonth = estStartParts.find(p => p.type === 'month')!.value;
  const startDay = estStartParts.find(p => p.type === 'day')!.value;
  
  // Determine DST for 3 days ago
  const startMonthNum = parseInt(startMonth);
  const startDayNum = parseInt(startDay);
  let startIsDST = false;
  if (startMonthNum > 3 && startMonthNum < 11) {
    startIsDST = true;
  } else if (startMonthNum === 3 && startDayNum >= 10) {
    startIsDST = true;
  } else if (startMonthNum === 11 && startDayNum < 3) {
    startIsDST = true;
  }
  
  const startOffsetHours = startIsDST ? -4 : -5;
  const startOffsetStr = startOffsetHours < 0 
    ? `-${Math.abs(startOffsetHours).toString().padStart(2, '0')}:00`
    : `+${startOffsetHours.toString().padStart(2, '0')}:00`;
  
  const estStartStr = `${startYear}-${startMonth}-${startDay}T00:00:00`;
  const start = new Date(`${estStartStr}${startOffsetStr}`);
  
  return { start, end };
}

/**
 * Find all reach events (any duration) for hotleads from last 3 days
 */
async function findReachEventCandidates(): Promise<HotleadWebhookCandidate[]> {
  console.log('🔍 Finding ALL reach events for hotleads from last 3 days...\n');
  
  const { start, end } = getLast3DaysEST();
  console.log(`📅 Date range (EST - Last 3 Days): ${start.toISOString()} to ${end.toISOString()}\n`);
  
  // Step 1: Get ALL reach events (any duration) from last 3 days
  const { data: reachEvents, error: eventsError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('id, agent_email, agent_name, lead_id, lead_phone, lead_name, call_duration, event_timestamp')
    .gte('event_timestamp', start.toISOString())
    .lt('event_timestamp', end.toISOString())
    .eq('event_type', 'reach')
    .not('call_duration', 'is', null)
    .gt('call_duration', 0)
    .not('lead_phone', 'is', null)
    .neq('lead_phone', '');
  
  if (eventsError) {
    console.error('❌ Error fetching reach events:', eventsError);
    throw eventsError;
  }
  
  if (!reachEvents || reachEvents.length === 0) {
    console.log('⚠️ No reach events found in last 3 days');
    return [];
  }
  
  console.log(`✅ Found ${reachEvents.length} reach events (last 3 days)\n`);
  
  // Step 2: Check which leads are hotleads
  const leadPhones = [...new Set(reachEvents.map(e => e.lead_phone?.replace(/\D/g, '')).filter(Boolean))];
  console.log(`🔍 Checking ${leadPhones.length} unique phone numbers for hotlead status...\n`);
  
  const { data: leads, error: leadsError } = await supabaseAdmin
    .from('masterlead')
    .select('id, first_name, last_name, phone, phone_number, is_hot_lead, cn_email, taalk_lead_id, taalk_market')
    .or(leadPhones.map(phone => `phone.eq.${phone},phone_number.eq.${phone}`).join(','));
  
  if (leadsError) {
    console.error('❌ Error fetching leads:', leadsError);
    throw leadsError;
  }
  
  // Create map of phone -> lead data
  const leadsByPhone = new Map<string, typeof leads[0]>();
  (leads || []).forEach(lead => {
    const phone1 = lead.phone?.replace(/\D/g, '');
    const phone2 = lead.phone_number?.replace(/\D/g, '');
    if (phone1) leadsByPhone.set(phone1, lead);
    if (phone2) leadsByPhone.set(phone2, lead);
  });
  
  console.log(`✅ Found ${leadsByPhone.size} leads in masterlead\n`);
  
  // Step 3: Filter to only hotleads
  const candidates: HotleadWebhookCandidate[] = [];
  
  for (const event of reachEvents) {
    const cleanPhone = String(event.lead_phone).replace(/\D/g, '');
    const lead = leadsByPhone.get(cleanPhone);
    
    // Only include if lead is a hotlead
    if (lead && lead.is_hot_lead === true) {
      candidates.push({
        id: event.id,
        agentEmail: event.agent_email || '',
        agentName: event.agent_name || undefined,
        leadId: lead.id,
        leadPhone: event.lead_phone,
        leadName: lead.first_name && lead.last_name 
          ? `${lead.first_name} ${lead.last_name}`.trim()
          : event.lead_name || undefined,
        callDuration: event.call_duration || 0,
        eventTimestamp: event.event_timestamp,
        leadData: lead
      });
    }
  }
  
  console.log(`✅ Found ${candidates.length} hotlead reach events\n`);
  
  return candidates;
}

/**
 * Find all booked leads from masterlead in last 3 days
 */
async function findBookedLeadCandidates(): Promise<HotleadWebhookCandidate[]> {
  console.log('🔍 Finding ALL booked leads from masterlead (last 3 days)...\n');
  
  const { start, end } = getLast3DaysEST();
  
  // Get all booked leads from masterlead updated in last 3 days
  const { data: bookedLeads, error: bookedError } = await supabaseAdmin
    .from('masterlead')
    .select('id, first_name, last_name, phone, phone_number, is_hot_lead, cn_email, taalk_lead_id, taalk_market, cnresolution, updated_at')
    .eq('cnresolution', 'booked')
    .gte('updated_at', start.toISOString())
    .lte('updated_at', end.toISOString());
  
  if (bookedError) {
    console.error('❌ Error fetching booked leads:', bookedError);
    throw bookedError;
  }
  
  if (!bookedLeads || bookedLeads.length === 0) {
    console.log('⚠️ No booked leads found in last 3 days');
    return [];
  }
  
  console.log(`✅ Found ${bookedLeads.length} booked leads (last 3 days)\n`);
  
  // For each booked lead, find the agent who called it
  const candidates: HotleadWebhookCandidate[] = [];
  
  for (const lead of bookedLeads) {
    let agentEmail = lead.cn_email || '';
    let agentName: string | undefined;
    let callDuration = 0;
    let eventTimestamp = lead.updated_at || new Date().toISOString();
    
    // If no cn_email, try to find the most recent agent_dial_metrics event for this lead
    if (!agentEmail && lead.id) {
      const { data: recentEvent } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('agent_email, agent_name, call_duration, event_timestamp')
        .eq('lead_id', lead.id)
        .in('event_type', ['reach', 'booked'])
        .order('event_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (recentEvent) {
        agentEmail = recentEvent.agent_email || '';
        agentName = recentEvent.agent_name || undefined;
        callDuration = recentEvent.call_duration || 0;
        eventTimestamp = recentEvent.event_timestamp || eventTimestamp;
      }
    }
    
    // Only include if we have an agent email
    if (agentEmail) {
      candidates.push({
        id: lead.id,
        agentEmail,
        agentName,
        leadId: lead.id,
        leadPhone: lead.phone || lead.phone_number || '',
        leadName: lead.first_name && lead.last_name 
          ? `${lead.first_name} ${lead.last_name}`.trim()
          : undefined,
        callDuration,
        eventTimestamp,
        isBooked: true, // Mark as booked lead
        leadData: {
          id: lead.id,
          first_name: lead.first_name || undefined,
          last_name: lead.last_name || undefined,
          phone: lead.phone || undefined,
          is_hot_lead: lead.is_hot_lead || false,
          cn_email: lead.cn_email || undefined,
          taalk_lead_id: lead.taalk_lead_id || undefined,
          taalk_market: lead.taalk_market || undefined
        }
      });
    } else {
      console.warn(`⚠️ Skipping booked lead ${lead.id} - no agent email found`);
    }
  }
  
  console.log(`✅ Found ${candidates.length} booked leads with agent emails\n`);
  
  return candidates;
}

/**
 * Find all hotlead webhook candidates (reach events + booked leads)
 */
async function findHotleadWebhookCandidates(): Promise<HotleadWebhookCandidate[]> {
  console.log('🚀 Finding all hotlead webhook candidates...\n');
  
  // Get both reach events and booked leads
  const [reachCandidates, bookedCandidates] = await Promise.all([
    findReachEventCandidates(),
    findBookedLeadCandidates()
  ]);
  
  // Combine and deduplicate by lead_id + agent_email
  const candidateMap = new Map<string, HotleadWebhookCandidate>();
  
  // Add reach candidates
  for (const candidate of reachCandidates) {
    const key = `${candidate.leadId}-${candidate.agentEmail}`;
    if (!candidateMap.has(key)) {
      candidateMap.set(key, candidate);
    }
  }
  
  // Add booked candidates (booked takes precedence if duplicate)
  for (const candidate of bookedCandidates) {
    const key = `${candidate.leadId}-${candidate.agentEmail}`;
    candidateMap.set(key, candidate);
  }
  
  const allCandidates = Array.from(candidateMap.values());
  
  console.log(`\n📊 Total unique candidates: ${allCandidates.length}`);
  console.log(`   - From reach events: ${reachCandidates.length}`);
  console.log(`   - From booked leads: ${bookedCandidates.length}\n`);
  
  return allCandidates;
}

/**
 * Get agent's associate_id
 */
async function getAgentAssociateId(agentEmail: string): Promise<number | null> {
  try {
    const { data } = await supabaseAdmin
      .from('customers')
      .select('associate_id')
      .eq('company_email', agentEmail.toLowerCase().trim())
      .maybeSingle();
    
    return data?.associate_id || null;
  } catch (error) {
    console.error(`❌ Error getting associate_id for ${agentEmail}:`, error);
    return null;
  }
}

/**
 * Send webhook to assign hotlead to agent
 */
async function sendHotleadWebhook(candidate: HotleadWebhookCandidate): Promise<boolean> {
  try {
    const associateId = await getAgentAssociateId(candidate.agentEmail);
    if (!associateId) {
      console.error(`❌ CRITICAL: No associate_id for ${candidate.agentEmail}. Cannot send webhook (never send 999).`);
      return false;
    }
    const finalAssociateId = associateId;
    const taalkLeadId = candidate.leadData?.taalk_lead_id || candidate.leadId?.toString() || '0';
    
    // Use 'booked' disposition for booked leads, 'assigned' for reach events
    const disposition = candidate.isBooked ? 'booked' : 'assigned';
    const dispositionKey = candidate.isBooked ? 'booked' : 'assigned';
    const reason = candidate.isBooked 
      ? 'booked_lead_backfill'
      : candidate.callDuration >= 45 
        ? '45_second_rule_backfill' 
        : 'reach_event_backfill';
    
    const webhookPayload = {
      lead_id: taalkLeadId.toString(),
      associate_id: finalAssociateId,
      disposition,
      dispositionkey: dispositionKey,
      agent_email: candidate.agentEmail,
      duration: candidate.callDuration,
      autoAssigned: true,
      reason,
      backfilled: true,
      original_event_timestamp: candidate.eventTimestamp
    };
    
    const typeLabel = candidate.isBooked ? 'BOOKED' : 'REACH';
    console.log(`📤 Sending webhook for ${typeLabel} ${candidate.agentEmail} -> ${candidate.leadPhone} (duration: ${candidate.callDuration}s)`);
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    });
    
    if (response.ok) {
      console.log(`✅ Webhook sent successfully`);
      return true;
    } else {
      const errorText = await response.text().catch(() => '');
      console.error(`❌ Webhook failed: ${response.status} - ${errorText.substring(0, 100)}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error sending webhook:`, error);
    return false;
  }
}

/**
 * Check if lead is already assigned to the agent (webhook may have already been sent)
 * Returns true if webhook was already sent (lead is assigned to this agent)
 */
function isAlreadyAssigned(candidate: HotleadWebhookCandidate): boolean {
  // If lead's cn_email matches the agent, webhook was already sent and lead is assigned
  const leadEmail = candidate.leadData?.cn_email?.toLowerCase().trim();
  const agentEmail = candidate.agentEmail.toLowerCase().trim();
  
  // If cn_email matches, webhook was sent
  if (leadEmail === agentEmail) {
    return true;
  }
  
  // If cn_email is null or different agent, webhook was NOT sent
  return false;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🚀 Starting hotlead webhook backfill (reach events + booked leads)...\n');
    
    // Find candidates
    const candidates = await findHotleadWebhookCandidates();
    
    if (candidates.length === 0) {
      console.log('✅ No candidates found - all webhooks already sent or no matching leads');
      return;
    }
    
    console.log(`\n📊 Processing ${candidates.length} candidates...\n`);
    
    // Filter: only send webhook if lead is NOT already assigned to this agent
    // (If assigned to different agent or null, send the webhook)
    const needsWebhook = candidates.filter(c => !isAlreadyAssigned(c));
    const alreadyAssigned = candidates.filter(c => isAlreadyAssigned(c));
    
    console.log(`✅ Already assigned to agent (webhook sent): ${alreadyAssigned.length}`);
    console.log(`📤 Needs webhook (not assigned to agent): ${needsWebhook.length}\n`);
    
    if (needsWebhook.length === 0) {
      console.log('✅ All leads already assigned to agents - no webhooks needed');
      return;
    }
    
    // Send webhooks in batches sequentially to avoid overloading Zapier
    const batchSize = 5;
    const delayBetweenWebhooks = 500; // 500ms delay between each webhook
    const delayBetweenBatches = 2000; // 2 second delay between batches
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < needsWebhook.length; i += batchSize) {
      const batch = needsWebhook.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(needsWebhook.length / batchSize);
      
      console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} candidates)...`);
      
      // Send webhooks sequentially within each batch to avoid overloading Zapier
      for (let j = 0; j < batch.length; j++) {
        const candidate = batch[j];
        try {
          const success = await sendHotleadWebhook(candidate);
          if (success) {
            successCount++;
          } else {
            failCount++;
          }
          
          // Wait between webhooks (except after the last one in the batch)
          if (j < batch.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenWebhooks));
          }
        } catch (error) {
          failCount++;
          console.error(`❌ Failed for ${candidate.agentEmail} -> ${candidate.leadPhone}:`, error);
        }
      }
      
      // Wait between batches (except after the last batch)
      if (i + batchSize < needsWebhook.length) {
        console.log(`⏳ Waiting ${delayBetweenBatches / 1000} seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }
    
    // Calculate breakdown by type
    const reachCandidates = candidates.filter(c => !c.isBooked);
    const bookedCandidates = candidates.filter(c => c.isBooked);
    const reachNeedsWebhook = needsWebhook.filter(c => !c.isBooked);
    const bookedNeedsWebhook = needsWebhook.filter(c => c.isBooked);
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 BACKFILL SUMMARY');
    console.log('='.repeat(80));
    console.log(`   Total candidates: ${candidates.length}`);
    console.log(`     - Reach events: ${reachCandidates.length}`);
    console.log(`     - Booked leads: ${bookedCandidates.length}`);
    console.log(`   Already assigned: ${alreadyAssigned.length}`);
    console.log(`   Needs webhook: ${needsWebhook.length}`);
    console.log(`     - Reach events: ${reachNeedsWebhook.length}`);
    console.log(`     - Booked leads: ${bookedNeedsWebhook.length}`);
    console.log(`   Webhooks sent: ${successCount}`);
    console.log(`   Webhooks failed: ${failCount}`);
    console.log('='.repeat(80));
    console.log('\n✅ Backfill complete!');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run if executed directly (not when imported as a module)
const shouldRunMain = (() => {
  // Don't run if we're in a server context (imported by routes.ts, index.ts, etc.)
  if (process.argv[1]?.includes('dist/index.js') || 
      process.argv[1]?.includes('index.ts') ||
      process.argv[1]?.includes('routes.ts') ||
      process.argv[1]?.includes('server/index')) {
    return false;
  }
  
  // Only run if explicitly executed via tsx/node with this script
  const scriptName = 'backfill-45-second-hotlead-webhooks';
  return process.argv[1]?.includes(scriptName) === true;
})();

if (shouldRunMain) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}

export { findHotleadWebhookCandidates, findReachEventCandidates, findBookedLeadCandidates, sendHotleadWebhook };
