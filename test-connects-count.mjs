import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try multiple env file locations
dotenv.config({ path: join(__dirname, '.env.local') });
dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get today's EST date range (same logic as getTodayEST)
function getTodayEST() {
  const now = new Date();
  
  // Get current date in EST/EDT
  const estFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const estDateParts = estFormatter.formatToParts(now);
  const year = estDateParts.find(p => p.type === 'year').value;
  const month = estDateParts.find(p => p.type === 'month').value;
  const day = estDateParts.find(p => p.type === 'day').value;
  
  // Determine if we're in DST (rough: March-November, but check actual date)
  const monthNum = parseInt(month);
  const dayNum = parseInt(day);
  
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
  const estStartStr = `${year}-${month}-${day}T00:00:00`;
  
  // Calculate tomorrow's date in EST
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

async function testConnectsCount() {
  console.log('🔍 Testing connects count from billing_transactions...\n');
  
  const { start, end } = getTodayEST();
  console.log(`📅 Date range (EST):`);
  console.log(`   Start: ${start.toISOString()}`);
  console.log(`   End: ${end.toISOString()}\n`);
  
  // Test 1: Count all connects (no filters)
  console.log('📊 Test 1: Count ALL connects (no filters)');
  const { count: totalCount, error: totalError } = await supabase
    .from('billing_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('transaction_type', 'connect')
    .gte('transaction_date', start.toISOString())
    .lt('transaction_date', end.toISOString());
  
  if (totalError) {
    console.error('❌ Error:', totalError);
  } else {
    console.log(`   ✅ Total connects: ${totalCount || 0}\n`);
  }
  
  // Test 2: Get sample of actual transactions
  console.log('📊 Test 2: Sample of actual transactions');
  const { data: sampleData, error: sampleError } = await supabase
    .from('billing_transactions')
    .select('id, transaction_date, agent_email, transaction_type')
    .eq('transaction_type', 'connect')
    .gte('transaction_date', start.toISOString())
    .lt('transaction_date', end.toISOString())
    .order('transaction_date', { ascending: false })
    .limit(10);
  
  if (sampleError) {
    console.error('❌ Error:', sampleError);
  } else {
    console.log(`   ✅ Found ${sampleData?.length || 0} sample transactions:`);
    sampleData?.forEach((tx, i) => {
      console.log(`   ${i + 1}. ${tx.transaction_date} | ${tx.agent_email || 'NO EMAIL'}`);
    });
    console.log('');
  }
  
  // Test 3: Count with different date ranges to see what's happening
  console.log('📊 Test 3: Count with different date boundaries');
  
  // Test with .lte() instead of .lt()
  const { count: countLte, error: errorLte } = await supabase
    .from('billing_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('transaction_type', 'connect')
    .gte('transaction_date', start.toISOString())
    .lte('transaction_date', end.toISOString());
  
  if (errorLte) {
    console.error('❌ Error with .lte():', errorLte);
  } else {
    console.log(`   ✅ Count with .lte(): ${countLte || 0}`);
  }
  
  // Test with end as 23:59:59.999 today
  const endOfDay = new Date(end);
  endOfDay.setSeconds(endOfDay.getSeconds() - 1);
  const { count: countEndOfDay, error: errorEndOfDay } = await supabase
    .from('billing_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('transaction_type', 'connect')
    .gte('transaction_date', start.toISOString())
    .lt('transaction_date', endOfDay.toISOString());
  
  if (errorEndOfDay) {
    console.error('❌ Error with end of day:', errorEndOfDay);
  } else {
    console.log(`   ✅ Count with end of day: ${countEndOfDay || 0}`);
  console.log(`   End of day: ${endOfDay.toISOString()}\n`);
  }
  
  // Test 4: Check if there are connects with null agent_email
  console.log('📊 Test 4: Check for connects with null/empty agent_email');
  const { count: countWithNullEmail, error: errorNullEmail } = await supabase
    .from('billing_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('transaction_type', 'connect')
    .gte('transaction_date', start.toISOString())
    .lt('transaction_date', end.toISOString())
    .or('agent_email.is.null,agent_email.eq.');
  
  if (errorNullEmail) {
    console.error('❌ Error:', errorNullEmail);
  } else {
    console.log(`   ✅ Connects with null/empty agent_email: ${countWithNullEmail || 0}\n`);
  }
  
  // Test 5: Get count of ALL connects (no date filter) to see total
  console.log('📊 Test 5: Total connects in database (all time)');
  const { count: allTimeCount, error: allTimeError } = await supabase
    .from('billing_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('transaction_type', 'connect');
  
  if (allTimeError) {
    console.error('❌ Error:', allTimeError);
  } else {
    console.log(`   ✅ Total connects (all time): ${allTimeCount || 0}\n`);
  }
}

testConnectsCount().catch(console.error);
