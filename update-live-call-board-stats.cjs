/**
 * UPDATE LIVE CALL BOARD STATS
 * 
 * This script calculates and updates today's dial/reach/booked counts
 * for all agents in the live_call_board table.
 * 
 * Run this script periodically (e.g., every 5 minutes via cron) to keep
 * the live call board data accurate.
 * 
 * Usage: node update-live-call-board-stats.cjs
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase credentials
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Get today's PST date range
 * CRITICAL: Calculate PST "today" correctly - it's currently 11/22 5:43 PM PST, not 11/23!
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
  
  // Log for debugging
  const pstNow = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  console.log(`   Current PST time: ${pstNow}`);
  console.log(`   PST date range: ${pstYear}-${String(pstMonth).padStart(2, '0')}-${String(pstDay).padStart(2, '0')}`);
  
  return {
    todayStart: utcTodayStart.toISOString(),
    todayEnd: utcTodayEnd.toISOString()
  };
}

/**
 * Count distinct phone numbers for an agent by event type
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
 * Update live call board stats for all agents
 */
async function updateLiveCallBoardStats() {
  console.log('🔄 Starting live call board stats update...');
  
  try {
    // Get today's PST range
    const { todayStart, todayEnd } = await getTodayPSTRange();
    console.log(`📅 Today's range (PST): ${todayStart} to ${todayEnd}`);
    
    // Fetch all metrics for today
    console.log('📊 Fetching all agent dial metrics for today...');
    const { data: allMetrics, error: metricsError } = await supabase
      .from('agent_dial_metrics')
      .select('agent_email, event_type, lead_phone, disposition')
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
    
    console.log(`✅ Found ${allMetrics.length} total metric events today`);
    
    // Group metrics by agent email
    const metricsByAgent = {};
    for (const metric of allMetrics) {
      const email = metric.agent_email.toLowerCase().trim();
      if (!metricsByAgent[email]) {
        metricsByAgent[email] = [];
      }
      metricsByAgent[email].push(metric);
    }
    
    console.log(`📈 Processing ${Object.keys(metricsByAgent).length} agents...`);
    
    // Calculate stats for each agent
    const updates = [];
    for (const [agentEmail, metrics] of Object.entries(metricsByAgent)) {
      const dialed = countDistinctPhones(metrics, 'dial');
      const reached = countDistinctPhones(metrics, 'reach');
      
      // Count booked: check BOTH event_type='booked' AND disposition='booked'
      const bookedPhones = new Set();
      for (const metric of metrics) {
        if (metric.lead_phone && 
            (metric.event_type === 'booked' || 
             (metric.disposition && metric.disposition.toLowerCase() === 'booked'))) {
          bookedPhones.add(metric.lead_phone);
        }
      }
      const booked = bookedPhones.size;
      
      updates.push({
        agent_email: agentEmail,
        today_dialed: dialed,
        today_reached: reached,
        today_booked: booked,
        updated_at: new Date().toISOString()
      });
      
      if (dialed > 0 || reached > 0 || booked > 0) {
        console.log(`  ${agentEmail.substring(0, 30)}: ${dialed} dials, ${reached} reaches, ${booked} booked`);
      }
    }
    
    if (updates.length === 0) {
      console.log('⚠️ No updates to apply');
      return;
    }
    
    // Fetch existing live_call_board rows to preserve required fields
    console.log(`\n📋 Fetching existing live_call_board rows...`);
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
        // Preserve existing required fields, or use defaults
        status: existing?.status || 'offline',
        ccpro_enabled: existing?.ccpro_enabled ?? false,
        available_for_inbound: existing?.available_for_inbound ?? false,
      };
    });
    
    // Upsert stats into live_call_board
    console.log(`\n💾 Updating live_call_board for ${mergedUpdates.length} agents...`);
    
    // Process in batches to avoid timeouts
    const batchSize = 50;
    let updated = 0;
    let errors = 0;
    
    for (let i = 0; i < mergedUpdates.length; i += batchSize) {
      const batch = mergedUpdates.slice(i, i + batchSize);
      
      // Use upsert with ON CONFLICT
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
        console.log(`✅ Updated batch ${Math.floor(i / batchSize) + 1}: ${batch.length} agents`);
      }
    }
    
    console.log(`\n✅ Update complete!`);
    console.log(`   - Updated: ${updated} agents`);
    console.log(`   - Errors: ${errors} batches`);
    
    // Show summary
    const totalDials = updates.reduce((sum, u) => sum + u.today_dialed, 0);
    const totalReaches = updates.reduce((sum, u) => sum + u.today_reached, 0);
    const totalBooked = updates.reduce((sum, u) => sum + u.today_booked, 0);
    
    console.log(`\n📊 Today's Totals:`);
    console.log(`   - Total Dials: ${totalDials}`);
    console.log(`   - Total Reaches: ${totalReaches}`);
    console.log(`   - Total Booked: ${totalBooked}`);
    
  } catch (error) {
    console.error('❌ Fatal error updating live call board stats:', error);
    process.exit(1);
  }
}

// Run the update
updateLiveCallBoardStats()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

