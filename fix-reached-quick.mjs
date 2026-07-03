/**
 * Quick fix: Update/create reach events for leads with reached dispositions
 * This is a faster version that processes in batches
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

let supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
let supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  const hardcodedConfigPath = join(__dirname, 'server', 'hardcoded-config.ts');
  try {
    const configContent = readFileSync(hardcodedConfigPath, 'utf-8');
    const urlMatch = configContent.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/);
    if (urlMatch && !supabaseUrl) supabaseUrl = urlMatch[1];
    const keyMatch = configContent.match(/SUPABASE_SERVICE_KEY:\s*['"]([^'"]+)['"]/);
    if (keyMatch && !supabaseServiceKey) supabaseServiceKey = keyMatch[1];
  } catch (error) {}
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const reachedDispositions = [
  'contacted', 'connected', 'talked', 'qualified', 'interested', 
  'not_interested', 'transfer', 'appointment', 'booked', 
  'callback_scheduled', 'call_back', 'callback', 'sale',
  'instant_presentation', 'already_been_sold', 'medically_uninsurable',
  'over_age', 'duplicate', 'dnc', 'do_not_call'
];

const notReachedDispositions = [
  'no_answer', 'busy', 'failed', 'voicemail', 'bad_number',
  'no_answer_vm', 'no_answer_voicemail', 'wrong_number', 'wrong number'
];

async function quickFix() {
  console.log('🔍 Quick fix: Creating/updating reach events for leads with reached dispositions...\n');

  const requiredDuration = 30; // Must be >= 30 seconds
  
  // Get leads with reached dispositions in batches (Supabase has a 1000 limit)
  let allReachedLeads = [];
  let from = 0;
  const fetchBatchSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data: reachedLeads, error: fetchError } = await supabase
      .from('masterlead')
      .select('id, phone, cn_email, cnresolution, first_name, last_name, state, taalk_state')
      .not('cnresolution', 'is', null)
      .in('cnresolution', reachedDispositions)
      .range(from, from + fetchBatchSize - 1);
    
    if (fetchError) {
      console.error('❌ Error fetching leads:', fetchError);
      break;
    }
    
    if (!reachedLeads || reachedLeads.length === 0) {
      hasMore = false;
      break;
    }
    
    allReachedLeads = allReachedLeads.concat(reachedLeads);
    from += fetchBatchSize;
    
    if (reachedLeads.length < fetchBatchSize) {
      hasMore = false;
    }
  }
  
  if (allReachedLeads.length === 0) {
    console.log('No reached leads found');
    return;
  }
  
  console.log(`Found ${allReachedLeads.length} leads with reached dispositions\n`);
  
  const leadIds = allReachedLeads.map(l => l.id);
  let totalUpdated = 0;
  let totalCreated = 0;
  
  // Process in batches
  for (let i = 0; i < leadIds.length; i += 100) {
    const batch = leadIds.slice(i, i + 100);
    
    // Find dial events with valid duration for these leads
    const { data: dialEvents } = await supabase
      .from('agent_dial_metrics')
      .select('id, lead_id, call_duration, disposition, event_type, call_sid, agent_email, lead_phone, call_status, event_timestamp')
      .in('lead_id', batch)
      .gte('call_duration', requiredDuration);
    
    if (dialEvents && dialEvents.length > 0) {
      // Group by lead_id
      const eventsByLead = {};
      dialEvents.forEach(e => {
        if (!eventsByLead[e.lead_id]) {
          eventsByLead[e.lead_id] = [];
        }
        eventsByLead[e.lead_id].push(e);
      });
      
      // Process each lead
      for (const leadId of Object.keys(eventsByLead)) {
        const events = eventsByLead[leadId];
        const lead = allReachedLeads.find(l => l.id === parseInt(leadId));
        if (!lead) continue;
        
        // Filter out events with "not reached" dispositions
        const validEvents = events.filter(e => {
          const eventDisposition = (e.disposition || '').toLowerCase().trim();
          return !notReachedDispositions.includes(eventDisposition);
        });
        
        if (validEvents.length === 0) continue;
        
        // Check if there's already a reach event
        const { data: existingReach } = await supabase
          .from('agent_dial_metrics')
          .select('id')
          .eq('lead_id', leadId)
          .eq('event_type', 'reach')
          .gte('call_duration', requiredDuration)
          .limit(1);
        
        if (existingReach && existingReach.length > 0) {
          // Already has reach event, skip
          continue;
        }
        
        // Use the most recent valid event
        const bestEvent = validEvents.sort((a, b) => 
          new Date(b.event_timestamp || 0) - new Date(a.event_timestamp || 0)
        )[0];
        
        // Create reach event
        const { error: insertError } = await supabase
          .from('agent_dial_metrics')
          .insert({
            agent_email: bestEvent.agent_email || lead.cn_email,
            agent_name: null,
            lead_id: parseInt(leadId),
            lead_phone: bestEvent.lead_phone || lead.phone,
            lead_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || null,
            lead_state: lead.state || lead.taalk_state || null,
            event_type: 'reach',
            disposition: lead.cnresolution || bestEvent.disposition,
            call_duration: bestEvent.call_duration,
            call_status: bestEvent.call_status || 'completed',
            call_sid: bestEvent.call_sid || null,
            source: 'outbound_dialer',
            notes: 'Synced from masterlead.cnresolution',
            event_timestamp: bestEvent.event_timestamp || new Date().toISOString()
          });
        
        if (!insertError) {
          totalCreated++;
        }
      }
    }
    
    if ((i + 100) % 1000 === 0) {
      console.log(`   Processed ${i + 100} leads, created ${totalCreated} reach events`);
    }
  }
  
  console.log(`\n✅ Total created: ${totalCreated} reach events`);
  
  // Recalculate stats
  if (totalCreated > 0) {
    console.log('\n🔄 Recalculating live call board stats...');
    const { error: rpcError } = await supabase.rpc('backfill_live_call_boardt_stats_corrected');
    if (rpcError) {
      console.error('❌ Error recalculating stats:', rpcError);
    } else {
      console.log('✅ Stats recalculated');
    }
  }
}

quickFix()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
