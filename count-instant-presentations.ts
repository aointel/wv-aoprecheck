import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './server/hardcoded-config';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function getTodayEST(): { start: Date; end: Date } {
  const now = new Date();
  
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
  
  let isDST = false;
  const monthNum = parseInt(month);
  const dayNum = parseInt(day);
  if (monthNum > 3 && monthNum < 11) {
    isDST = true;
  } else if (monthNum === 3 && dayNum >= 10) {
    isDST = true;
  } else if (monthNum === 11 && dayNum < 3) {
    isDST = true;
  }
  
  const offsetHours = isDST ? -4 : -5; // EDT = UTC-4, EST = UTC-5
  
  const estStartStr = `${year}-${month}-${day}T00:00:00`;
  const tomorrow = new Date(`${year}-${month}-${day}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowYear = tomorrow.getFullYear();
  const tomorrowMonth = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const tomorrowDay = String(tomorrow.getDate()).padStart(2, '0');
  const estEndStr = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}T00:00:00`;
  
  const offsetStr = offsetHours < 0 
    ? `-${Math.abs(offsetHours).toString().padStart(2, '0')}:00`
    : `+${offsetHours.toString().padStart(2, '0')}:00`;
  
  const start = new Date(`${estStartStr}${offsetStr}`);
  const end = new Date(`${estEndStr}${offsetStr}`);
  
  return { start, end };
}

async function countInstantPresentations() {
  const { start, end } = getTodayEST();
  
  console.log(`\n🔍 COUNTING INSTANT PRESENTATIONS FROM TWILIO_CALL_LOGS`);
  console.log(`   Date Range (EST): ${start.toLocaleString('en-US', { timeZone: 'America/New_York' })} to ${end.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
  console.log(`   Date Range (UTC): ${start.toISOString()} to ${end.toISOString()}`);
  console.log(`   Criteria: duration >= 480 seconds (8 minutes), status = answered/completed, outbound only\n`);

  // Get total count first
  const { count: totalCallsCount, error: countError } = await supabase
    .from('twilio_call_logs')
    .select('*', { count: 'exact', head: true })
    .eq('call_direction', 'outbound')
    .gte('call_started_at', start.toISOString())
    .lt('call_started_at', end.toISOString())
    .not('to_number', 'is', null)
    .neq('to_number', '')
    .not('owner_email', 'is', null)
    .neq('owner_email', '')
    .not('call_duration', 'is', null)
    .gte('call_duration', 480)
    .in('call_status', ['answered', 'completed']);

  if (countError) {
    console.error('❌ Error getting total call count:', countError);
    return;
  }
  console.log(`📊 Total outbound calls in date range with duration >= 480s: ${totalCallsCount}`);

  // Get ALL calls matching criteria (paginated)
  const instantPhones = new Set<string>();
  let offset = 0;
  const batchSize = 1000; // Supabase caps at 1000 rows per request
  let totalFetched = 0;
  let callsByAgent = new Map<string, number>();
  let callsByDuration = new Map<string, number>();
  
  console.log(`\n📥 Fetching all instant presentation calls (paginating)...`);
  while (true) {
    const { data, error } = await supabase
      .from('twilio_call_logs')
      .select('owner_email, to_number, call_duration, call_status, call_direction, call_started_at')
      .eq('call_direction', 'outbound')
      .gte('call_started_at', start.toISOString())
      .lt('call_started_at', end.toISOString())
      .not('to_number', 'is', null)
      .neq('to_number', '')
      .not('owner_email', 'is', null)
      .neq('owner_email', '')
      .not('call_duration', 'is', null)
      .gte('call_duration', 480)
      .in('call_status', ['answered', 'completed'])
      .order('call_started_at', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('❌ Error fetching twilio_call_logs:', error);
      break;
    }

    if (!data || data.length === 0) {
      console.log(`   ✅ Reached end: ${data?.length || 0} records in final batch`);
      break;
    }

    totalFetched += data.length;
    
    // Count distinct phone numbers
    for (const row of data) {
      const phone = String(row.to_number || '').trim().replace(/\D/g, '').slice(-10);
      if (phone && phone.length >= 10) {
        instantPhones.add(phone);
      }
      
      // Track by agent
      const agentEmail = (row.owner_email || '').toLowerCase().trim();
      if (agentEmail && agentEmail.includes('@')) {
        callsByAgent.set(agentEmail, (callsByAgent.get(agentEmail) || 0) + 1);
      }
      
      // Track by duration range
      const duration = row.call_duration || 0;
      let durationRange = '';
      if (duration >= 480 && duration < 600) durationRange = '8-10 min';
      else if (duration >= 600 && duration < 900) durationRange = '10-15 min';
      else if (duration >= 900 && duration < 1200) durationRange = '15-20 min';
      else if (duration >= 1200) durationRange = '20+ min';
      else durationRange = '8+ min';
      
      callsByDuration.set(durationRange, (callsByDuration.get(durationRange) || 0) + 1);
    }

    offset += batchSize;

    if (data.length < batchSize) {
      console.log(`   ✅ Reached end: ${data.length} records in final batch`);
      break;
    }
    
    if (Math.floor(offset / batchSize) % 10 === 0) {
      console.log(`   📊 Progress: ${offset} records fetched, ${instantPhones.size} distinct phones`);
    }
  }
  
  console.log(`\n📊 Total calls fetched: ${totalFetched}`);
  console.log(`📞 DISTINCT PHONE NUMBERS (Instant Presentations): ${instantPhones.size}\n`);

  // Sort agents by call count
  const sortedAgents = [...callsByAgent.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`📊 Top 20 agents by instant presentation calls:`);
  sortedAgents.slice(0, 20).forEach(([email, count], index) => {
    console.log(`   ${index + 1}. ${email}: ${count} calls`);
  });

  // Breakdown by duration
  console.log(`\n📊 Breakdown by duration range:`);
  const sortedDurations = [...callsByDuration.entries()].sort((a, b) => {
    const order = ['8-10 min', '10-15 min', '15-20 min', '20+ min'];
    const aIdx = order.indexOf(a[0]);
    const bIdx = order.indexOf(b[0]);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a[0].localeCompare(b[0]);
  });
  for (const [range, count] of sortedDurations) {
    console.log(`   ${range}: ${count} calls`);
  }

  console.log(`\n✅ VERIFICATION COMPLETE`);
  console.log(`   Total instant presentations (distinct phones): ${instantPhones.size}`);
  console.log(`   (Live call board should show: ${instantPhones.size})`);
}

countInstantPresentations().catch(console.error);
