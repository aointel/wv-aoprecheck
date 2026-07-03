/**
 * REAL-TIME DIAL/REACH/BOOKED CALCULATOR
 * 
 * This script calculates dial/reach/booked metrics in real-time from agent_dial_metrics
 * WITHOUT using SQL functions. It queries the raw data and calculates locally.
 * 
 * Run with: npm run calculate-dial-reach-booked
 * 
 * This is the CORRECT way to calculate:
 * - DIALS: COUNT(DISTINCT lead_phone) WHERE event_type = 'dial'
 * - REACHES: COUNT(DISTINCT lead_phone) WHERE event_type = 'reach'  
 * - BOOKED: COUNT(DISTINCT lead_phone) WHERE event_type = 'booked'
 * 
 * All calculations use EST timezone for "today" boundaries.
 */

import { supabaseAdmin } from '../supabase';

interface AgentStats {
  agentEmail: string;
  agentName?: string;
  dialed: number;
  reached: number;
  booked: number;
  instantPresentation: number;
  reachRate: number;
  bookedRate: number;
}

export interface AgentStatsByMarket extends AgentStats {
  market: 'Globe' | 'Veteran' | 'Other';
}

/**
 * Fetch agent_name for a list of emails from agent_hierarchy (chunked).
 */
async function getAgentNamesByEmail(emails: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(emails)].filter(Boolean);
  if (unique.length === 0) return out;
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    const { data: rows } = await supabaseAdmin
      .from('agent_hierarchy')
      .select('agent_email, agent_name')
      .in('agent_email', chunk);
    for (const r of rows || []) {
      const e = (r.agent_email || '').toLowerCase().trim();
      if (e && r.agent_name) out.set(e, String(r.agent_name).trim());
    }
  }
  return out;
}

/**
 * Categorize taalk_market string into Globe, Veteran, or Other
 */
function categorizeMarket(taalkMarket: string | null | undefined): 'Globe' | 'Veteran' | 'Other' {
  const m = (taalkMarket || '').toLowerCase();
  if (m.includes('globe')) return 'Globe';
  if (m.includes('veteran') || m.includes('pavet')) return 'Veteran';
  return 'Other';
}

/**
 * Get today's start and end in EST/EDT timezone (America/New_York)
 * Simple approach: Use current EST date and create UTC boundaries
 */
function getTodayEST(): { start: Date; end: Date } {
  const now = new Date();
  
  // Get current date in EST/EDT
  const estFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const estDateParts = estFormatter.formatToParts(now);
  const year = estDateParts.find(p => p.type === 'year')!.value;
  const month = estDateParts.find(p => p.type === 'month')!.value;
  const day = estDateParts.find(p => p.type === 'day')!.value;
  
  // Determine if we're in DST (rough: March-November, but check actual date)
  const monthNum = parseInt(month);
  const dayNum = parseInt(day);
  
  // DST typically: 2nd Sunday in March to 1st Sunday in November
  // Simplified: March 10 - November 3 (covers most cases)
  let isDST = false;
  if (monthNum > 3 && monthNum < 11) {
    isDST = true;
  } else if (monthNum === 3 && dayNum >= 10) {
    isDST = true;
  } else if (monthNum === 11 && dayNum < 3) {
    isDST = true;
  }
  
  const offsetHours = isDST ? -4 : -5; // EDT = UTC-4, EST = UTC-5
  
  // Create date strings for EST/EDT midnight and start of next day
  // Use start of next day as end boundary for better inclusion with .lt() or .lte()
  const estStartStr = `${year}-${month}-${day}T00:00:00`;
  
  // Calculate tomorrow's date in EST
  const tomorrow = new Date(`${year}-${month}-${day}T12:00:00`); // Use noon to avoid DST edge cases
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowYear = tomorrow.getFullYear();
  const tomorrowMonth = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const tomorrowDay = String(tomorrow.getDate()).padStart(2, '0');
  const estEndStr = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}T00:00:00`;
  
  // Create Date objects in EST/EDT, then convert to UTC
  // Use ISO string with timezone offset
  const offsetStr = offsetHours < 0 
    ? `-${Math.abs(offsetHours).toString().padStart(2, '0')}:00`
    : `+${offsetHours.toString().padStart(2, '0')}:00`;
  
  const start = new Date(`${estStartStr}${offsetStr}`);
  const end = new Date(`${estEndStr}${offsetStr}`);
  
  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error(`Invalid date calculation: start=${estStartStr}${offsetStr}, end=${estEndStr}${offsetStr}`);
  }
  
  return { start, end };
}

/**
 * Calculate dial/reach/booked stats for all agents
 */
async function calculateDialReachBookedRealtime(
  agentEmail?: string,
  timePeriod: 'day' | 'week' | 'month' | 'realtime' = 'realtime',
  customStartDate?: string,
  customEndDate?: string
): Promise<AgentStats[]> {
  console.log('🚀 Starting REAL-TIME dial/reach/booked calculation...\n');
  
  const { start, end } = getDateRangeForTimePeriod(
    timePeriod as 'day' | 'week' | 'month' | 'realtime' | 'custom',
    customStartDate,
    customEndDate
  );
  const periodLabel = customStartDate && customEndDate
    ? `Custom (${customStartDate} to ${customEndDate})`
    : timePeriod === 'realtime' || timePeriod === 'day' ? 'Today' : timePeriod === 'week' ? 'Last 7 days' : 'Last 30 days';
  console.log(`📅 Date range (EST) - ${periodLabel}:`);
  console.log(`   Start: ${start.toISOString()}`);
  console.log(`   End: ${end.toISOString()}\n`);
  
  try {
    // CRITICAL: Use SAME method as Sales Activity totals and SQL functions:
    // - DIALS: twilio_call_logs (distinct to_number, duration >= 1 OR answered/completed, excludes failed/busy/no-answer/canceled)
    // - REACHED: twilio_call_logs (distinct to_number, duration >= 55, status = answered/completed)
    // - BOOKED: agent_dial_metrics (event_type = 'booked', COUNT DISTINCT lead_phone)
    
    console.log('📊 Fetching dials from twilio_call_logs (CORRECT SOURCE)...');
    
    const agentStatsMap = new Map<string, {
      agentName?: string;
      dialedPhones: Set<string>;  // Count distinct phone numbers, not all call SIDs
      dialedPhoneTimestamps: Map<string, Date>;  // Track last dial time per phone (for 5-min dedupe)
      reachedPhones: Set<string>;
      bookedPhones: Set<string>;
      instantPresentationPhones: Set<string>;  // Count distinct instant presentation phone numbers
    }>();
    
    const badEmails = new Set(['unknown@aoglobelife.com', 'cnsysop@aoglobelife.com', 'system@aoglobelife.com', 'unknown', '']);
    
    // Step 1: Fetch DIALS from twilio_call_logs (CORRECT SOURCE - same as SQL functions)
    let dialsOffset = 0;
    const dialsBatchSize = 1000; // Supabase limit is 1000 per query
    const dialsMaxBatches = 500; // Allow up to 500k records
    let totalDialsFetched = 0;
    
    while (dialsOffset < dialsMaxBatches * dialsBatchSize) {
      let dialsQuery = supabaseAdmin
        .from('twilio_call_logs')
        .select('to_number, owner_email, call_duration, call_status, call_started_at, parent_call_sid')
        .eq('call_direction', 'outbound')
        .gte('call_started_at', start.toISOString())
        .lt('call_started_at', end.toISOString())
        .not('to_number', 'is', null)
        .neq('to_number', '')
        .not('owner_email', 'is', null)
        .neq('owner_email', '')
        .not('parent_call_sid', 'is', null)  // CRITICAL: Only count child calls (dial legs), exclude parent WebRTC calls
        .order('call_started_at', { ascending: true })
        .range(dialsOffset, dialsOffset + dialsBatchSize - 1);
      
      if (agentEmail) {
        dialsQuery = dialsQuery.eq('owner_email', agentEmail.toLowerCase().trim());
      }
      
      const { data: dialsBatch, error: dialsError } = await dialsQuery;
      if (dialsError) {
        console.error('❌ Error fetching dials batch:', dialsError);
        break;
      }
      if (!dialsBatch?.length) break;
      
      // Apply same filters as Sales Activity totals
      // CRITICAL: Only count child calls (parent_call_sid IS NOT NULL) - exclude parent WebRTC calls
      // CRITICAL: Count as dial if: (duration >= 1) OR (status = 'answered' or 'completed')
      // CRITICAL: Exclude failed/busy/no-answer/canceled (unless answered/completed)
      const filteredBatch = dialsBatch.filter((row: any) => {
        // CRITICAL: Only count child calls (dial legs), not parent WebRTC calls
        // Parent calls have parent_call_sid = NULL, child calls have parent_call_sid IS NOT NULL
        if (!row.parent_call_sid) return false;
        
        const duration = row.call_duration;
        const status = (row.call_status || '').toLowerCase();
        // Count if: (duration >= 1) OR (status = 'answered' or 'completed')
        const hasValidDuration = duration && duration >= 1;
        const isAnsweredOrCompleted = status === 'answered' || status === 'completed';
        const shouldCount = hasValidDuration || isAnsweredOrCompleted;
        // Exclude failed/busy/no-answer/canceled (unless answered/completed)
        const isExcluded = ['failed', 'busy', 'no-answer', 'canceled'].includes(status) && !isAnsweredOrCompleted;
        return shouldCount && !isExcluded;
      });
      
      for (const row of filteredBatch) {
        const email = (row.owner_email || '').toLowerCase().trim();
        if (!email || !email.includes('@') || badEmails.has(email)) continue;
        
        const phone = String(row.to_number || '').trim().replace(/\D/g, '').slice(-10);
        if (phone && phone.length >= 10) {
          if (!agentStatsMap.has(email)) {
            agentStatsMap.set(email, {
              agentName: undefined,
              dialedPhones: new Set(),
              dialedPhoneTimestamps: new Map(),
              reachedPhones: new Set(),
              bookedPhones: new Set(),
              instantPresentationPhones: new Set(),
            });
          }
          
          const stats = agentStatsMap.get(email)!;
          const callTime = new Date(row.call_started_at);
          const lastDialTime = stats.dialedPhoneTimestamps.get(phone);
          
          // Only count if it's been more than 5 minutes since last dial to this number
          const fiveMinMs = 5 * 60 * 1000;
          if (!lastDialTime || (callTime.getTime() - lastDialTime.getTime()) >= fiveMinMs) {
            stats.dialedPhones.add(phone);
            stats.dialedPhoneTimestamps.set(phone, callTime);
          }
        }
      }
      
      totalDialsFetched += dialsBatch.length;
      dialsOffset += dialsBatch.length;
      if (dialsBatch.length < dialsBatchSize) break; // No more records
    }
    console.log(`   ✅ Dials: ${totalDialsFetched} records processed`);
    
    // Step 2: Fetch REACHED from twilio_call_logs (same method as Sales Activity totals)
    console.log('📊 Fetching reached from twilio_call_logs...');
    let reachedOffset = 0;
    const reachedBatchSize = 1000; // Supabase limit is 1000 per query
    const reachedMaxBatches = 500;
    let totalReachedFetched = 0;
    
    while (reachedOffset < reachedMaxBatches * reachedBatchSize) {
      let reachedQuery = supabaseAdmin
        .from('twilio_call_logs')
        .select('to_number, owner_email, call_duration, call_status')
        .eq('call_direction', 'outbound')
        .gte('call_started_at', start.toISOString())
        .lt('call_started_at', end.toISOString())
        .not('to_number', 'is', null)
        .neq('to_number', '')
        .not('owner_email', 'is', null)
        .neq('owner_email', '')
        .gte('call_duration', 55)
        .in('call_status', ['answered', 'completed'])
        .order('call_started_at', { ascending: true })
        .range(reachedOffset, reachedOffset + reachedBatchSize - 1);
      
      if (agentEmail) {
        reachedQuery = reachedQuery.eq('owner_email', agentEmail.toLowerCase().trim());
      }
      
      const { data: reachedBatch, error: reachedError } = await reachedQuery;
      if (reachedError) {
        console.error('❌ Error fetching reached batch:', reachedError);
        break;
      }
      if (!reachedBatch?.length) break;
      
      for (const row of reachedBatch) {
        const email = (row.owner_email || '').toLowerCase().trim();
        if (!email || !email.includes('@') || badEmails.has(email)) continue;
        
        const phone = String(row.to_number || '').trim().replace(/\D/g, '').slice(-10);
        if (phone && phone.length >= 10) {
          if (!agentStatsMap.has(email)) {
            agentStatsMap.set(email, {
              agentName: undefined,
              dialedPhones: new Set(),
              dialedPhoneTimestamps: new Map(),
              reachedPhones: new Set(),
              bookedPhones: new Set(),
              instantPresentationPhones: new Set(),
            });
          }
          agentStatsMap.get(email)!.reachedPhones.add(phone);
        }
      }
      
      totalReachedFetched += reachedBatch.length;
      reachedOffset += reachedBatch.length;
      if (reachedBatch.length < reachedBatchSize) break;
    }
    console.log(`   ✅ Reached: ${totalReachedFetched} records processed`);
    
    // Step 3: Fetch BOOKED from agent_dial_metrics (CORRECT SOURCE - event_type = 'booked')
    console.log('📊 Fetching booked from agent_dial_metrics...');
    let bookedOffset = 0;
    const bookedBatchSize = 1000; // Supabase limit is 1000 per query
    const bookedMaxBatches = 500;
    let totalBookedFetched = 0;
    
    while (bookedOffset < bookedMaxBatches * bookedBatchSize) {
      let bookedQuery = supabaseAdmin
        .from('agent_dial_metrics')
        .select('lead_phone, agent_email, agent_name')
        .eq('event_type', 'booked')
        .gte('event_timestamp', start.toISOString())
        .lt('event_timestamp', end.toISOString())
        .not('lead_phone', 'is', null)
        .neq('lead_phone', '')
        .not('agent_email', 'is', null)
        .neq('agent_email', '')
        .order('event_timestamp', { ascending: true })
        .range(bookedOffset, bookedOffset + bookedBatchSize - 1);
      
      if (agentEmail) {
        bookedQuery = bookedQuery.eq('agent_email', agentEmail.toLowerCase().trim());
      }
      
      const { data: bookedBatch, error: bookedError } = await bookedQuery;
      if (bookedError) {
        console.error('❌ Error fetching booked batch:', bookedError);
        break;
      }
      if (!bookedBatch?.length) break;
      
      for (const row of bookedBatch) {
        const email = (row.agent_email || '').toLowerCase().trim();
        if (!email || !email.includes('@') || badEmails.has(email)) continue;
        
        const phone = String(row.lead_phone || '').trim().replace(/\D/g, '').slice(-10);
        if (phone && phone.length >= 10) {
          if (!agentStatsMap.has(email)) {
            agentStatsMap.set(email, {
              agentName: row.agent_name || undefined,
              dialedPhones: new Set(),
              reachedPhones: new Set(),
              bookedPhones: new Set(),
              instantPresentationPhones: new Set(),
            });
          }
          
          // Count all booked events from agent_dial_metrics (event_type='booked')
          agentStatsMap.get(email)!.bookedPhones.add(phone);
        }
      }
      
      totalBookedFetched += bookedBatch.length;
      bookedOffset += bookedBatch.length;
      if (bookedBatch.length < bookedBatchSize) break;
    }
    console.log(`   ✅ Booked: ${totalBookedFetched} records processed`);
    
    // Step 4: Fetch INSTANT_PRESENTATION from twilio_call_logs (calls >= 10 minutes / 600 seconds)
    console.log('📊 Fetching instant_presentation from twilio_call_logs (duration >= 600s)...');
    let instantPresOffset = 0;
    const instantPresBatchSize = 1000;
    const instantPresMaxBatches = 500;
    let totalInstantPresFetched = 0;
    
    while (instantPresOffset < instantPresMaxBatches * instantPresBatchSize) {
      let instantPresQuery = supabaseAdmin
        .from('twilio_call_logs')
        .select('to_number, owner_email')
        .eq('call_direction', 'outbound')
        .gte('call_started_at', start.toISOString())
        .lt('call_started_at', end.toISOString())
        .not('owner_email', 'is', null)
        .neq('owner_email', '')
        .not('to_number', 'is', null)
        .neq('to_number', '')
        .not('call_duration', 'is', null)
        .gte('call_duration', 600)  // 10 minutes = 600 seconds
        .in('call_status', ['answered', 'completed'])
        .order('call_started_at', { ascending: true })
        .range(instantPresOffset, instantPresOffset + instantPresBatchSize - 1);
      
      if (agentEmail) {
        instantPresQuery = instantPresQuery.eq('owner_email', agentEmail.toLowerCase().trim());
      }
      
      const { data: instantPresBatch, error: instantPresError } = await instantPresQuery;
      if (instantPresError) {
        console.error('❌ Error fetching instant_presentation batch:', instantPresError);
        break;
      }
      if (!instantPresBatch?.length) break;
      
      for (const row of instantPresBatch) {
        const email = (row.owner_email || '').toLowerCase().trim();
        if (!email || !email.includes('@') || badEmails.has(email)) continue;
        
        const phone = String(row.to_number || '').trim().replace(/\D/g, '').slice(-10);
        if (phone && phone.length >= 10) {
          if (!agentStatsMap.has(email)) {
            agentStatsMap.set(email, {
              agentName: undefined,
              dialedPhones: new Set(),
              dialedPhoneTimestamps: new Map(),
              reachedPhones: new Set(),
              bookedPhones: new Set(),
              instantPresentationPhones: new Set(),
            });
          }
          // Count distinct phone numbers
          agentStatsMap.get(email)!.instantPresentationPhones.add(phone);
        }
      }
      
      totalInstantPresFetched += instantPresBatch.length;
      instantPresOffset += instantPresBatch.length;
      if (instantPresBatch.length < instantPresBatchSize) break;
    }
    console.log(`   ✅ Instant Presentation: ${totalInstantPresFetched} records processed from twilio_call_logs`);
    
    if (agentStatsMap.size === 0) {
      console.log('⚠️ No stats found for date range');
      return [];
    }
    
    console.log(`✅ Found stats for ${agentStatsMap.size} agents\n`);
    
    const nameLookup = await getAgentNamesByEmail([...agentStatsMap.keys()]);
    for (const [email, stats] of agentStatsMap) {
      if (!stats.agentName && nameLookup.has(email)) stats.agentName = nameLookup.get(email);
    }
    
    // Step 3: Convert to final stats array
    const results: AgentStats[] = [];
    
    for (const [email, stats] of agentStatsMap.entries()) {
      const dialed = stats.dialedPhones.size;  // Count distinct phone numbers, not all call SIDs
      const reached = stats.reachedPhones.size;
      const booked = stats.bookedPhones.size;
      const instantPresentation = stats.instantPresentationPhones.size;
      
      // Calculate rates
      const reachRate = dialed > 0 ? Math.round((reached / dialed) * 100) : 0;
      const bookedRate = reached > 0 ? Math.round((booked / reached) * 100) : 0;
      
      results.push({
        agentEmail: email,
        agentName: stats.agentName,
        dialed,
        reached,
        booked,
        instantPresentation,
        reachRate,
        bookedRate,
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
 * Calculate dial/reach/booked stats broken down by market (Globe, Veteran, Other)
 * Joins with masterlead to get taalk_market per lead (by lead_id or phone)
 */
async function calculateDialReachBookedByMarket(
  agentEmail?: string,
  timePeriod: 'day' | 'week' | 'month' | 'realtime' | 'custom' = 'realtime',
  customStartDate?: string,
  customEndDate?: string
): Promise<{ byMarket: Record<string, AgentStats[]>; all: AgentStats[] }> {
  const { start, end } = getDateRangeForTimePeriod(
    timePeriod as 'day' | 'week' | 'month' | 'realtime' | 'custom',
    customStartDate,
    customEndDate
  );
  const periodLabel = customStartDate && customEndDate
    ? `Custom (${customStartDate} to ${customEndDate})`
    : timePeriod === 'realtime' || timePeriod === 'day' ? 'Today' : timePeriod === 'week' ? 'Last 7 days' : 'Last 30 days';
  console.log(`📅 Date range (EST) - ${periodLabel}: ${start.toISOString()} → ${end.toISOString()}`);

  const eventTypes = ['dial', 'reach', 'booked'];
  const allEvents: any[] = [];
  for (const eventType of eventTypes) {
    let baseQuery = supabaseAdmin
      .from('agent_dial_metrics')
      .select('agent_email, agent_name, event_type, lead_phone, lead_id, event_timestamp')
      .eq('event_type', eventType)
      .gte('event_timestamp', start.toISOString())
      .lt('event_timestamp', end.toISOString())
      .not('lead_phone', 'is', null)
      .neq('lead_phone', '')
      .order('event_timestamp', { ascending: true });
    if (agentEmail) baseQuery = baseQuery.eq('agent_email', agentEmail.toLowerCase().trim());
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data: events, error } = await baseQuery.range(offset, offset + batchSize - 1);
      if (error) throw error;
      if (events?.length) {
        allEvents.push(...events);
        hasMore = events.length >= batchSize;
        offset += batchSize;
      } else hasMore = false;
    }
  }
  if (allEvents.length === 0) return { byMarket: { Globe: [], Veteran: [], Other: [] }, all: [] };

  const leadIds = [...new Set(allEvents.map((e: any) => e.lead_id).filter(Boolean))] as number[];
  const phoneToMarket = new Map<string, 'Globe' | 'Veteran' | 'Other'>();
  const normalizePhone = (p: string) => String(p || '').replace(/\D/g, '').slice(-10);

  if (leadIds.length > 0) {
    for (let i = 0; i < leadIds.length; i += 500) {
      const chunk = leadIds.slice(i, i + 500);
      const { data: leads } = await supabaseAdmin
        .from('masterlead')
        .select('id, phone, taalk_market')
        .in('id', chunk);
      for (const l of leads || []) {
        const m = categorizeMarket(l.taalk_market);
        if (l.phone) phoneToMarket.set(normalizePhone(l.phone), m);
      }
    }
  }
  const phonesNoId = [...new Set(allEvents.filter((e: any) => !e.lead_id).map((e: any) => normalizePhone(e.lead_phone)))].filter((x) => x.length >= 10 && !phoneToMarket.has(x));
  for (let i = 0; i < phonesNoId.length; i += 100) {
    const batch = phonesNoId.slice(i, i + 100);
    const phSet = new Set(batch);
    const variants = batch.flatMap((p) => [p, '1' + p]);
    const { data: rows } = await supabaseAdmin
      .from('masterlead')
      .select('phone, taalk_market')
      .in('phone', variants);
    for (const row of rows || []) {
      const np = normalizePhone(row.phone);
      if (phSet.has(np)) phoneToMarket.set(np, categorizeMarket(row.taalk_market));
    }
  }

  const getMarket = (e: any): 'Globe' | 'Veteran' | 'Other' => {
    const np = normalizePhone(e.lead_phone);
    return phoneToMarket.get(np) ?? 'Other';
  };

  const byMarket = { Globe: new Map<string, { agentName?: string; d: Set<string>; r: Set<string>; b: Set<string> }>(), Veteran: new Map(), Other: new Map() } as Record<string, Map<string, { agentName?: string; d: Set<string>; r: Set<string>; b: Set<string> }>>;
  const allMap = new Map<string, { agentName?: string; d: Set<string>; r: Set<string>; b: Set<string> }>();

  for (const event of allEvents) {
    const email = (event.agent_email || '').toLowerCase().trim();
    if (!email) continue;
    const cleanPhone = normalizePhone(event.lead_phone);
    if (cleanPhone.length < 10) continue;
    const market = getMarket(event);

    const init = (m: Map<string, any>) => {
      if (!m.has(email)) m.set(email, { agentName: event.agent_name, d: new Set(), r: new Set(), b: new Set() });
      return m.get(email)!;
    };
    const sAll = init(allMap);
    const sMkt = init(byMarket[market]);
    if (event.agent_name && !sAll.agentName) sAll.agentName = event.agent_name;
    if (event.agent_name && !sMkt.agentName) sMkt.agentName = event.agent_name;
    if (event.event_type === 'dial') {
      sAll.d.add(cleanPhone);
      sMkt.d.add(cleanPhone);
    } else if (event.event_type === 'reach') {
      sAll.r.add(cleanPhone);
      sMkt.r.add(cleanPhone);
    } else if (event.event_type === 'booked') {
      sAll.b.add(cleanPhone);
      sMkt.b.add(cleanPhone);
    }
  }

  const nameLookup = await getAgentNamesByEmail([...allMap.keys()]);
  for (const [email, s] of allMap) {
    if (!s.agentName && nameLookup.has(email)) s.agentName = nameLookup.get(email);
  }
  for (const m of ['Globe', 'Veteran', 'Other']) {
    for (const [email, s] of byMarket[m]) {
      if (!s.agentName && nameLookup.has(email)) s.agentName = nameLookup.get(email);
    }
  }

  const toStats = (entries: [string, { agentName?: string; d: Set<string>; r: Set<string>; b: Set<string> }][]): AgentStats[] => {
    return entries.map(([email, s]) => {
      const d = s.d.size, r = s.r.size, b = s.b.size;
      return {
        agentEmail: email,
        agentName: s.agentName,
        dialed: d,
        reached: r,
        booked: b,
        reachRate: d > 0 ? Math.round((r / d) * 100) : 0,
        bookedRate: r > 0 ? Math.round((b / r) * 100) : 0,
      };
    }).sort((a, b) => (b.booked - a.booked) || (b.reached - a.reached) || (b.dialed - a.dialed));
  };

  const byMarketResult: Record<string, AgentStats[]> = {};
  for (const m of ['Globe', 'Veteran', 'Other']) {
    byMarketResult[m] = toStats([...byMarket[m].entries()]);
  }
  const allStats = toStats([...allMap.entries()]);
  return { byMarket: byMarketResult, all: allStats };
}

/**
 * Display stats in a nice table format
 */
function displayStats(stats: AgentStats[]): void {
  if (stats.length === 0) {
    console.log('⚠️ No stats to display');
    return;
  }
  
  console.log('\n' + '='.repeat(100));
  console.log('📊 REAL-TIME DIAL/REACH/BOOKED STATS (TODAY - EST)');
  console.log('='.repeat(100));
  console.log('');
  
  // Header
  console.log(
    'AGENT EMAIL'.padEnd(40) +
    'DIALED'.padStart(8) +
    'REACHED'.padStart(10) +
    'BOOKED'.padStart(8) +
    'REACH %'.padStart(10) +
    'BOOK %'.padStart(10)
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
    const reachRate = `${stat.reachRate}%`.padStart(10);
    const bookedRate = `${stat.bookedRate}%`.padStart(10);
    
    console.log(name + dialed + reached + booked + reachRate + bookedRate);
    
    totalDialed += stat.dialed;
    totalReached += stat.reached;
    totalBooked += stat.booked;
  }
  
  // Totals row
  console.log('-'.repeat(100));
  const totalReachRate = totalDialed > 0 ? Math.round((totalReached / totalDialed) * 100) : 0;
  const totalBookedRate = totalReached > 0 ? Math.round((totalBooked / totalReached) * 100) : 0;
  
  console.log(
    'TOTALS'.padEnd(40) +
    String(totalDialed).padStart(8) +
    String(totalReached).padStart(10) +
    String(totalBooked).padStart(8) +
    `${totalReachRate}%`.padStart(10) +
    `${totalBookedRate}%`.padStart(10)
  );
  
  console.log('='.repeat(100));
  console.log('');
  
  // Summary
  console.log('📈 SUMMARY:');
  console.log(`   Total Agents: ${stats.length}`);
  console.log(`   Total Dials: ${totalDialed}`);
  console.log(`   Total Reaches: ${totalReached}`);
  console.log(`   Total Booked: ${totalBooked}`);
  console.log(`   Overall Reach Rate: ${totalReachRate}%`);
  console.log(`   Overall Book Rate: ${totalBookedRate}%`);
  console.log('');
}

/**
 * Main function
 */
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const agentEmail = args.find(arg => arg.startsWith('--agent='))?.split('=')[1];
    
    // Calculate stats
    const stats = await calculateDialReachBookedRealtime(agentEmail);
    
    // Display results
    displayStats(stats);
    
    console.log('✅ Calculation complete!');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run if executed directly (not when imported as a module)
// CRITICAL: Only execute main() when run via npm script or tsx/node directly
// When imported by routes.ts or other modules, this code should NOT run
// Check: if process.argv[1] contains this script name AND we're not in a bundled/server context
const shouldRunMain = (() => {
  // Don't run if we're in a server context (imported by routes.ts, index.ts, etc.)
  if (process.argv[1]?.includes('dist/index.js') || 
      process.argv[1]?.includes('index.ts') ||
      process.argv[1]?.includes('routes.ts') ||
      process.argv[1]?.includes('server/index')) {
    return false;
  }
  
  // Only run if explicitly executed via tsx/node with this script
  const scriptName = 'calculate-dial-reach-booked-realtime';
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

/**
 * Parse YYYY-MM-DD as a full day in America/New_York (EST/EDT).
 * Returns start = midnight EST that day, end = midnight EST next day (so .lt(end) includes full day).
 */
function parseDateAsESTDay(dateStr: string): { start: Date; end: Date } | null {
  const m = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, month, day] = m;
  const year = parseInt(y!, 10);
  const monthNum = parseInt(month!, 10);
  const dayNum = parseInt(day!, 10);
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;
  const monthStr = month!.padStart(2, '0');
  const dayStr = day!.padStart(2, '0');
  const isDST = (monthNum > 3 && monthNum < 11) || (monthNum === 3 && dayNum >= 10) || (monthNum === 11 && dayNum < 3);
  const offsetHours = isDST ? -4 : -5;
  const offsetStr = offsetHours < 0 ? `-${Math.abs(offsetHours).toString().padStart(2, '0')}:00` : `+${offsetHours.toString().padStart(2, '0')}:00`;
  const start = new Date(`${year}-${monthStr}-${dayStr}T00:00:00${offsetStr}`);
  const nextDay = new Date(start);
  nextDay.setDate(nextDay.getDate() + 1);
  const end = nextDay;
  if (isNaN(start.getTime())) return null;
  return { start, end };
}

/**
 * Get date range based on time period (day, week, month, realtime, custom)
 * realtime = today, day = today, week = last 7 days, month = last 30 days
 * custom = uses provided startDate and endDate as EST days (same timezone as "today")
 */
export function getDateRangeForTimePeriod(
  timePeriod: 'day' | 'week' | 'month' | 'realtime' | 'custom',
  customStartDate?: string,
  customEndDate?: string
): { start: Date; end: Date } {
  // CRITICAL: Always handle custom dates first, even if timePeriod is not 'custom'
  // The frontend may pass custom dates with any timePeriod value
  if (customStartDate && customEndDate) {
    const startDay = parseDateAsESTDay(customStartDate);
    const endDay = parseDateAsESTDay(customEndDate);
    if (startDay && endDay) {
      // When start and end are the same day, use start of start day to start of next day after end day
      // This ensures we include the full end day (all 24 hours)
      const end = customStartDate === customEndDate 
        ? endDay.end  // Same day: use end of that day (start of next day in EST)
        : new Date(endDay.end); // Different days: use end of end day (start of day after end day)
      
      if (startDay.start.getTime() <= end.getTime()) {
        console.log(`📅 Custom date range: ${customStartDate} to ${customEndDate} = ${startDay.start.toISOString()} to ${end.toISOString()}`);
        console.log(`   EST: ${startDay.start.toLocaleString('en-US', { timeZone: 'America/New_York' })} to ${end.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
        return { start: startDay.start, end };
      } else {
        console.error(`❌ Invalid custom date range: start (${startDay.start.toISOString()}) > end (${end.toISOString()})`);
      }
    } else {
      console.error(`❌ Failed to parse custom dates: startDate=${customStartDate}, endDate=${customEndDate}`);
      console.error(`   startDay=${startDay ? 'parsed' : 'null'}, endDay=${endDay ? 'parsed' : 'null'}`);
    }
  }

  const now = new Date();
  
  switch (timePeriod) {
    case 'realtime':
    case 'day':
      // Today (same as getTodayEST)
      return getTodayEST();
      
    case 'week':
      // Last 7 days from today (using EST for consistency)
      // Get today in EST first
      const todayEST = getTodayEST();
      const weekStart = new Date(todayEST.start);
      weekStart.setDate(weekStart.getDate() - 6); // 7 days including today (go back 6 days from today)
      const weekEnd = new Date(todayEST.end); // End of today in EST
      return { start: weekStart, end: weekEnd };
      
    case 'month':
      // Last 30 days from today (using EST for consistency)
      // Get today in EST first
      const todayESTMonth = getTodayEST();
      const monthStart = new Date(todayESTMonth.start);
      monthStart.setDate(monthStart.getDate() - 29); // 30 days including today (go back 29 days from today)
      const monthEnd = new Date(todayESTMonth.end); // End of today in EST
      return { start: monthStart, end: monthEnd };
      
    case 'custom':
      // Custom dates already handled at top (EST); fallback to today if missing/invalid
      return getTodayEST();
      
    default:
      // Default to today
      return getTodayEST();
  }
}

export { calculateDialReachBookedRealtime, calculateDialReachBookedByMarket, getTodayEST };
