/**
 * BACKFILL SCRIPT: Reset and Recalculate Dial/Reach/Booked Stats
 * 
 * This script resets all dial/reach/booked stats in live_call_boardt and recalculates them
 * using the adjusted formula:
 * 
 * - DIALS: From twilio_call_logs - COUNT(DISTINCT to_number) for outbound calls
 *          NO duration requirement (removed 15s/1s minimum)
 *          Excludes: failed, busy, no-answer, canceled (unless answered/completed)
 * 
 * - REACHES: From agent_dial_metrics - COUNT(DISTINCT lead_phone) WHERE event_type = 'reach'
 * - BOOKED: From agent_dial_metrics - COUNT(DISTINCT lead_phone) WHERE event_type = 'booked'
 * 
 * CRITICAL: Dials now count ALL outbound calls (no duration requirement)!
 * - No 15-second minimum
 * - No 1-second minimum
 * - Just counts all valid outbound calls from twilio_call_logs
 * - All calculations use EST timezone for "today" boundaries.
 * 
 * Run with: npm run backfill-dial-stats
 * Or: tsx server/scripts/backfill-dial-stats-adjusted-formula.ts
 */

import { supabaseAdmin } from '../supabase';
import { getTodayEST } from './calculate-dial-reach-booked-realtime';

interface AgentStats {
  agentEmail: string;
  agentName?: string;
  dialed: number;
  reached: number;
  booked: number;
}

/**
 * Reset all today's stats to 0 in live_call_boardt
 */
async function resetStats(): Promise<number> {
  console.log('🔄 Resetting all today stats to 0...\n');
  
  const { data, error, count } = await supabaseAdmin
    .from('live_call_boardt')
    .update({
      today_dialed: 0,
      today_reached: 0,
      today_booked: 0,
      today_instant_presentation: 0,
      updated_at: new Date().toISOString(),
    })
    .not('agent_email', 'is', null)
    .select('agent_email', { count: 'exact', head: false });
  
  if (error) {
    console.error('❌ Error resetting stats:', error);
    throw error;
  }
  
  console.log(`✅ Reset ${count || 0} agents: All today stats set to 0\n`);
  return count || 0;
}

/**
 * Calculate dial/reach/booked stats using the adjusted formula
 * DIALS: From twilio_call_logs (NO duration requirement - removed 15s/1s minimum)
 * REACHES/BOOKED: From agent_dial_metrics by event_type
 */
async function calculateStatsForToday(): Promise<AgentStats[]> {
  console.log('📊 Calculating stats using adjusted formula...\n');
  
  const { start, end } = getTodayEST();
  console.log(`📅 Date range (EST) - Today:`);
  console.log(`   Start: ${start.toISOString()}`);
  console.log(`   End: ${end.toISOString()}\n`);
  
  try {
    // Step 1: Fetch DIALS from twilio_call_logs (NO duration requirement)
    console.log('   Fetching dials from twilio_call_logs...');
    
    const dialedPhonesMap = new Map<string, Set<string>>(); // agent_email -> Set of phone numbers
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;
    let totalDialCalls = 0;
    
    while (hasMore) {
      const { data: calls, error } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('owner_email, to_number, call_status, call_direction')
        .gte('call_started_at', start.toISOString())
        .lt('call_started_at', end.toISOString())
        .eq('call_direction', 'outbound')
        .not('owner_email', 'is', null)
        .neq('owner_email', '')
        .not('to_number', 'is', null)
        .neq('to_number', '')
        .order('call_started_at', { ascending: true })
        .range(offset, offset + batchSize - 1);
      
      if (error) {
        console.error('❌ Error fetching dial calls:', error);
        throw error;
      }
      
      if (calls && calls.length > 0) {
        totalDialCalls += calls.length;
        
        // Process each call - NO duration requirement, just exclude failed/busy/no-answer/canceled
        for (const call of calls) {
          const email = (call.owner_email || '').toLowerCase().trim();
          const phone = String(call.to_number || '').trim();
          const status = String(call.call_status || '').toLowerCase();
          
          if (!email || !phone) continue;
          
          // Normalize phone number
          const cleanPhone = phone.replace(/\D/g, '');
          if (cleanPhone.length < 10) continue;
          
          // Check if call was answered
          const isAnswered = status === 'answered' || status === 'completed';
          
          // Exclude failed/busy/no-answer/canceled (unless answered)
          const isExcluded = ['failed', 'busy', 'no-answer', 'canceled'].includes(status) && !isAnswered;
          
          // NEW FORMULA: Count ALL outbound calls that are NOT excluded (NO duration requirement)
          if (!isExcluded) {
            if (!dialedPhonesMap.has(email)) {
              dialedPhonesMap.set(email, new Set());
            }
            dialedPhonesMap.get(email)!.add(cleanPhone);
          }
        }
        
        if (calls.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
      } else {
        hasMore = false;
      }
    }
    
    console.log(`   ✅ Found ${totalDialCalls} outbound calls, ${Array.from(dialedPhonesMap.values()).reduce((sum, phones) => sum + phones.size, 0)} distinct dials`);
    
    // Step 2: Fetch REACHES and BOOKED from agent_dial_metrics
    console.log('   Fetching reaches and booked from agent_dial_metrics...');
    
    const reachedPhonesMap = new Map<string, Set<string>>();
    const bookedPhonesMap = new Map<string, Set<string>>();
    const agentNamesMap = new Map<string, string>();
    
    const eventTypes = ['reach', 'booked'];
    
    for (const eventType of eventTypes) {
      offset = 0;
      hasMore = true;
      let totalFetched = 0;
      
      while (hasMore) {
        const { data: events, error } = await supabaseAdmin
          .from('agent_dial_metrics')
          .select('agent_email, agent_name, event_type, lead_phone')
          .eq('event_type', eventType)
          .gte('event_timestamp', start.toISOString())
          .lt('event_timestamp', end.toISOString())
          .not('lead_phone', 'is', null)
          .neq('lead_phone', '')
          .order('event_timestamp', { ascending: true })
          .range(offset, offset + batchSize - 1);
        
        if (error) {
          console.error(`❌ Error fetching ${eventType} events:`, error);
          throw error;
        }
        
        if (events && events.length > 0) {
          totalFetched += events.length;
          
          for (const event of events) {
            const email = (event.agent_email || '').toLowerCase().trim();
            if (!email || !event.lead_phone) continue;
            
            // Normalize phone number
            const cleanPhone = String(event.lead_phone).replace(/\D/g, '');
            if (cleanPhone.length < 10) continue;
            
            // Store agent name
            if (event.agent_name && !agentNamesMap.has(email)) {
              agentNamesMap.set(email, event.agent_name);
            }
            
            if (eventType === 'reach') {
              if (!reachedPhonesMap.has(email)) {
                reachedPhonesMap.set(email, new Set());
              }
              reachedPhonesMap.get(email)!.add(cleanPhone);
            } else if (eventType === 'booked') {
              if (!bookedPhonesMap.has(email)) {
                bookedPhonesMap.set(email, new Set());
              }
              bookedPhonesMap.get(email)!.add(cleanPhone);
            }
          }
          
          if (events.length < batchSize) {
            hasMore = false;
          } else {
            offset += batchSize;
          }
        } else {
          hasMore = false;
        }
      }
      
      if (totalFetched > 0) {
        console.log(`   ✅ ${eventType}: ${totalFetched} events`);
      }
    }
    
    // Step 3: Combine all stats
    console.log('🔢 Calculating stats per agent...\n');
    
    const allAgentEmails = new Set([
      ...dialedPhonesMap.keys(),
      ...reachedPhonesMap.keys(),
      ...bookedPhonesMap.keys(),
    ]);
    
    const results: AgentStats[] = [];
    
    for (const email of allAgentEmails) {
      results.push({
        agentEmail: email,
        agentName: agentNamesMap.get(email),
        dialed: dialedPhonesMap.get(email)?.size || 0,
        reached: reachedPhonesMap.get(email)?.size || 0,
        booked: bookedPhonesMap.get(email)?.size || 0,
      });
    }
    
    // Sort by booked (desc), then reached (desc), then dialed (desc)
    results.sort((a, b) => {
      if (b.booked !== a.booked) return b.booked - a.booked;
      if (b.reached !== a.reached) return b.reached - a.reached;
      return b.dialed - a.dialed;
    });
    
    return results;
    
  } catch (error) {
    console.error('❌ Error calculating stats:', error);
    throw error;
  }
}

/**
 * Update live_call_boardt with recalculated stats
 */
async function updateLiveCallBoard(stats: AgentStats[]): Promise<void> {
  console.log('💾 Updating live_call_boardt with recalculated stats...\n');
  
  if (stats.length === 0) {
    console.log('⚠️ No stats to update');
    return;
  }
  
  let updated = 0;
  let created = 0;
  let errors = 0;
  
  for (const stat of stats) {
    try {
      // Try to update existing row
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('live_call_boardt')
        .select('agent_email')
        .eq('agent_email', stat.agentEmail)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
        console.error(`❌ Error checking for agent ${stat.agentEmail}:`, fetchError);
        errors++;
        continue;
      }
      
      if (existing) {
        // Update existing row
        const { error: updateError } = await supabaseAdmin
          .from('live_call_boardt')
          .update({
            today_dialed: stat.dialed,
            today_reached: stat.reached,
            today_booked: stat.booked,
            updated_at: new Date().toISOString(),
          })
          .eq('agent_email', stat.agentEmail);
        
        if (updateError) {
          console.error(`❌ Error updating ${stat.agentEmail}:`, updateError);
          errors++;
        } else {
          updated++;
        }
      } else {
        // Insert new row
        const { error: insertError } = await supabaseAdmin
          .from('live_call_boardt')
          .insert({
            agent_email: stat.agentEmail,
            status: 'offline',
            today_dialed: stat.dialed,
            today_reached: stat.reached,
            today_booked: stat.booked,
            today_instant_presentation: 0,
            updated_at: new Date().toISOString(),
          });
        
        if (insertError) {
          console.error(`❌ Error inserting ${stat.agentEmail}:`, insertError);
          errors++;
        } else {
          created++;
        }
      }
    } catch (error) {
      console.error(`❌ Unexpected error for ${stat.agentEmail}:`, error);
      errors++;
    }
  }
  
  console.log(`\n✅ Update complete:`);
  console.log(`   Updated: ${updated} agents`);
  console.log(`   Created: ${created} agents`);
  if (errors > 0) {
    console.log(`   Errors: ${errors} agents`);
  }
}

/**
 * Display summary of results
 */
function displaySummary(stats: AgentStats[]): void {
  if (stats.length === 0) {
    console.log('⚠️ No stats to display');
    return;
  }
  
  console.log('\n' + '='.repeat(100));
  console.log('📊 BACKFILL SUMMARY - DIAL/REACH/BOOKED STATS (TODAY - EST)');
  console.log('='.repeat(100));
  console.log('');
  
  // Header
  console.log(
    'AGENT EMAIL'.padEnd(40) +
    'DIALED'.padStart(8) +
    'REACHED'.padStart(10) +
    'BOOKED'.padStart(8)
  );
  console.log('-'.repeat(100));
  
  // Stats rows
  let totalDialed = 0;
  let totalReached = 0;
  let totalBooked = 0;
  
  for (const stat of stats) {
    const name = (stat.agentName || stat.agentEmail).substring(0, 38).padEnd(40);
    const dialed = String(stat.dialed).padStart(8);
    const reached = String(stat.reached).padStart(10);
    const booked = String(stat.booked).padStart(8);
    
    console.log(name + dialed + reached + booked);
    
    totalDialed += stat.dialed;
    totalReached += stat.reached;
    totalBooked += stat.booked;
  }
  
  // Totals row
  console.log('-'.repeat(100));
  console.log(
    'TOTALS'.padEnd(40) +
    String(totalDialed).padStart(8) +
    String(totalReached).padStart(10) +
    String(totalBooked).padStart(8)
  );
  
  console.log('='.repeat(100));
  console.log('');
  
  // Summary
  console.log('📈 SUMMARY:');
  console.log(`   Total Agents: ${stats.length}`);
  console.log(`   Total Dials: ${totalDialed}`);
  console.log(`   Total Reaches: ${totalReached}`);
  console.log(`   Total Booked: ${totalBooked}`);
  console.log('');
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🚀 Starting backfill of dial/reach/booked stats with adjusted formula...\n');
    console.log('='.repeat(100));
    console.log('');
    
    // Step 1: Reset all stats to 0
    await resetStats();
    
    // Step 2: Calculate stats using adjusted formula
    const stats = await calculateStatsForToday();
    
    // Step 3: Update live_call_boardt
    await updateLiveCallBoard(stats);
    
    // Step 4: Display summary
    displaySummary(stats);
    
    console.log('✅ Backfill complete!');
    console.log('');
    console.log('📝 Formula used:');
    console.log('   - DIALS: COUNT(DISTINCT to_number) FROM twilio_call_logs (outbound, NO duration requirement)');
    console.log('   - REACHES: COUNT(DISTINCT lead_phone) WHERE event_type = \'reach\' FROM agent_dial_metrics');
    console.log('   - BOOKED: COUNT(DISTINCT lead_phone) WHERE event_type = \'booked\' FROM agent_dial_metrics');
    console.log('');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run if executed directly (ES module check)
const shouldRunMain = (() => {
  // Don't run if we're in a server context (imported by routes.ts, index.ts, etc.)
  if (process.argv[1]?.includes('dist/index.js') || 
      process.argv[1]?.includes('index.ts') ||
      process.argv[1]?.includes('routes.ts') ||
      process.argv[1]?.includes('server/index')) {
    return false;
  }
  
  // Only run if explicitly executed via tsx/node with this script
  const scriptName = 'backfill-dial-stats-adjusted-formula';
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

export { resetStats, calculateStatsForToday, updateLiveCallBoard };
