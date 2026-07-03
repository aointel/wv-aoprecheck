/**
 * RESET LIVE CALL BOARD STATS
 * 
 * This script completely resets and recalculates all live_call_board stats
 * from agent_dial_metrics using the correct logic.
 * 
 * Usage: node reset-live-call-board-stats.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Get today's PST date range
 */
function getTodayPSTRange() {
  const now = new Date();
  
  // Get current PST date components
  const pstYear = parseInt(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric' }));
  const pstMonth = parseInt(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: '2-digit' }));
  const pstDay = parseInt(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', day: '2-digit' }));
  
  // Create a date string for midnight PST today
  const pstMidnightString = `${pstYear}-${String(pstMonth).padStart(2, '0')}-${String(pstDay).padStart(2, '0')}T00:00:00`;
  
  // Try PST first (UTC-8)
  let utcTodayStart = new Date(`${pstMidnightString}-08:00`);
  
  // Verify: check what PST date this UTC time represents
  const verifyPST = utcTodayStart.toLocaleString('en-US', { 
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const verifyDate = verifyPST.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2');
  const expectedDate = `${pstYear}-${String(pstMonth).padStart(2, '0')}-${String(pstDay).padStart(2, '0')}`;
  
  // If dates don't match, it's probably DST (PDT is UTC-7)
  if (verifyDate !== expectedDate) {
    utcTodayStart = new Date(`${pstMidnightString}-07:00`);
  }
  
  const utcTodayEnd = new Date(utcTodayStart.getTime() + (24 * 60 * 60 * 1000));
  
  return {
    todayStart: utcTodayStart.toISOString(),
    todayEnd: utcTodayEnd.toISOString()
  };
}

/**
 * Count distinct phone numbers for an event type
 */
function countDistinctPhones(metrics, eventType) {
  const phones = new Set();
  for (const metric of metrics) {
    if (metric.event_type === eventType && metric.lead_phone) {
      phones.add(metric.lead_phone);
    }
  }
  return phones.size;
}

/**
 * Main reset function
 */
async function resetLiveCallBoardStats() {
  console.log('🔄 Starting live call board stats reset...\n');
  
  try {
    const { todayStart, todayEnd } = getTodayPSTRange();
    console.log(`📅 Today's range (PST): ${todayStart} to ${todayEnd}\n`);
    
    // Step 1: Reset ALL agents' stats to 0
    console.log('📊 Step 1: Resetting all agents stats to 0...');
    const { error: resetError } = await supabase
      .from('live_call_board')
      .update({
        today_dialed: 0,
        today_reached: 0,
        today_booked: 0,
        updated_at: new Date().toISOString()
      })
      .neq('agent_email', ''); // Update all rows
    
    if (resetError) {
      throw new Error(`Failed to reset stats: ${resetError.message}`);
    }
    console.log('✅ All stats reset to 0\n');
    
    // Step 2: Fetch all metrics for today
    console.log('📊 Step 2: Fetching all agent dial metrics for today...');
    const { data: allMetrics, error: metricsError } = await supabase
      .from('agent_dial_metrics')
      .select('agent_email, event_type, lead_phone')
      .gte('event_timestamp', todayStart)
      .lt('event_timestamp', todayEnd)
      .not('agent_email', 'is', null)
      .neq('agent_email', '')
      .not('lead_phone', 'is', null);
    
    if (metricsError) {
      throw new Error(`Failed to fetch metrics: ${metricsError.message}`);
    }
    
    if (!allMetrics || allMetrics.length === 0) {
      console.log('⚠️ No metrics found for today');
      return;
    }
    
    console.log(`✅ Found ${allMetrics.length} total metric events today\n`);
    
    // Step 3: Group metrics by agent email
    const metricsByAgent = {};
    const dialedPhonesByAgent = {}; // Track which phones were dialed per agent
    
    for (const metric of allMetrics) {
      const email = metric.agent_email.toLowerCase().trim();
      if (!metricsByAgent[email]) {
        metricsByAgent[email] = [];
        dialedPhonesByAgent[email] = new Set();
      }
      metricsByAgent[email].push(metric);
      
      // Track dialed phones
      if (metric.event_type === 'dial' && metric.lead_phone) {
        dialedPhonesByAgent[email].add(metric.lead_phone);
      }
    }
    
    console.log(`📈 Step 3: Processing ${Object.keys(metricsByAgent).length} agents...\n`);
    
    // Step 4: Calculate stats for each agent
    // CRITICAL: Only count reached/booked if phone was also dialed
    const updates = [];
    for (const [agentEmail, metrics] of Object.entries(metricsByAgent)) {
      const dialed = countDistinctPhones(metrics, 'dial');
      const dialedPhones = dialedPhonesByAgent[agentEmail] || new Set();
      
      // Count reached: only phones that were also dialed
      const reachedPhones = new Set();
      for (const metric of metrics) {
        if (metric.event_type === 'reach' && metric.lead_phone && dialedPhones.has(metric.lead_phone)) {
          reachedPhones.add(metric.lead_phone);
        }
      }
      const reached = reachedPhones.size;
      
      // Count booked: only phones that were also dialed
      const bookedPhones = new Set();
      for (const metric of metrics) {
        if (metric.event_type === 'booked' && metric.lead_phone && dialedPhones.has(metric.lead_phone)) {
          bookedPhones.add(metric.lead_phone);
        }
      }
      const booked = bookedPhones.size;
      
      // Safety check: reached/booked should never exceed dialed
      const finalReached = Math.min(reached, dialed);
      const finalBooked = Math.min(booked, dialed);
      
      updates.push({
        agent_email: agentEmail,
        today_dialed: dialed,
        today_reached: finalReached,
        today_booked: finalBooked,
        updated_at: new Date().toISOString()
      });
      
      if (dialed > 0 || finalReached > 0 || finalBooked > 0) {
        console.log(`  ${agentEmail.substring(0, 40).padEnd(40)}: ${dialed} dials, ${finalReached} reaches, ${finalBooked} booked`);
      }
    }
    
    if (updates.length === 0) {
      console.log('⚠️ No updates to apply');
      return;
    }
    
    // Step 5: Fetch existing live_call_board rows to preserve required fields
    console.log(`\n📋 Step 4: Fetching existing live_call_board rows...`);
    const agentEmails = updates.map(u => u.agent_email);
    const { data: existingRows, error: fetchError } = await supabase
      .from('live_call_board')
      .select('agent_email, status, ccpro_enabled, available_for_inbound')
      .in('agent_email', agentEmails);
    
    if (fetchError) {
      throw new Error(`Failed to fetch existing rows: ${fetchError.message}`);
    }
    
    // Create a map of existing rows
    const existingMap = {};
    if (existingRows) {
      for (const row of existingRows) {
        existingMap[row.agent_email.toLowerCase()] = row;
      }
    }
    
    // Merge updates with existing data, preserving required fields
    const mergedUpdates = updates.map(update => {
      const existing = existingMap[update.agent_email.toLowerCase()];
      return {
        ...update,
        status: existing?.status || 'offline',
        ccpro_enabled: existing?.ccpro_enabled ?? false,
        available_for_inbound: existing?.available_for_inbound ?? false,
      };
    });
    
    // Step 6: Upsert stats into live_call_board in batches
    console.log(`\n💾 Step 5: Updating live_call_board...`);
    const batchSize = 50;
    let updated = 0;
    let errors = 0;
    
    for (let i = 0; i < mergedUpdates.length; i += batchSize) {
      const batch = mergedUpdates.slice(i, i + batchSize);
      
      const { error: upsertError } = await supabase
        .from('live_call_board')
        .upsert(batch, {
          onConflict: 'agent_email',
          ignoreDuplicates: false
        });
      
      if (upsertError) {
        console.error(`❌ Error upserting batch ${Math.floor(i / batchSize) + 1}:`, upsertError);
        errors++;
      } else {
        updated += batch.length;
      }
    }
    
    // Step 7: Verify no invalid stats
    console.log(`\n🔍 Step 6: Verifying stats...`);
    const { data: invalidStats, error: verifyError } = await supabase
      .from('live_call_board')
      .select('agent_email, today_dialed, today_reached, today_booked')
      .gt('today_reached', supabase.raw('today_dialed'));
    
    if (verifyError) {
      console.warn('⚠️ Could not verify stats:', verifyError);
    } else if (invalidStats && invalidStats.length > 0) {
      console.warn(`⚠️ Found ${invalidStats.length} agents with reached > dialed. Fixing...`);
      // Fix invalid stats
      for (const invalid of invalidStats) {
        await supabase
          .from('live_call_board')
          .update({ today_reached: invalid.today_dialed })
          .eq('agent_email', invalid.agent_email);
      }
      console.log('✅ Fixed invalid stats');
    } else {
      console.log('✅ Verification passed: No agents with reached > dialed');
    }
    
    console.log(`\n✅ Live call board stats reset complete!`);
    console.log(`   Updated: ${updated} agents`);
    if (errors > 0) {
      console.log(`   Errors: ${errors} batches`);
    }
    
    // Display summary
    console.log(`\n📊 Summary (top 20 agents):`);
    const { data: summary } = await supabase
      .from('live_call_board')
      .select('agent_email, today_dialed, today_reached, today_booked')
      .or('today_dialed.gt.0,today_reached.gt.0,today_booked.gt.0')
      .order('today_dialed', { ascending: false })
      .limit(20);
    
    if (summary) {
      for (const agent of summary) {
        const status = agent.today_reached > agent.today_dialed ? '⚠️' : '✅';
        console.log(`   ${status} ${agent.agent_email.substring(0, 40).padEnd(40)}: ${agent.today_dialed} dialed, ${agent.today_reached} reached, ${agent.today_booked} booked`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error resetting live call board stats:', error);
    process.exit(1);
  }
}

// Run the reset
resetLiveCallBoardStats()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

