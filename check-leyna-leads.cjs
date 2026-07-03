require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const EMAIL = 'leynatran@aoglobelife.com';

async function main() {
  console.log(`\nChecking leads for ${EMAIL}...\n`);

  // Total count by cnresolution
  // Direct query breakdown
  const resolutions = ['pending', 'no_answer', 'no_answer_vm', 'called', 'booked', 'spoke', 'sale', null];
  
  for (const res of resolutions) {
    let q = supabase.from('masterlead').select('*', { count: 'exact', head: true }).eq('cn_email', EMAIL);
    if (res === null) q = q.is('cnresolution', null);
    else q = q.eq('cnresolution', res);
    const { count } = await q;
    if (count > 0) console.log(`  cnresolution="${res ?? 'NULL'}": ${count}`);
  }

  // Total
  const { count: total } = await supabase.from('masterlead').select('*', { count: 'exact', head: true }).eq('cn_email', EMAIL);
  console.log(`\n  TOTAL assigned to Leyna: ${total}`);

  // Breakdown by taalk_market
  console.log('\nBy taalk_market:');
  const { data: mktData } = await supabase.from('masterlead')
    .select('taalk_market')
    .eq('cn_email', EMAIL)
    .limit(1000);
  
  if (mktData) {
    const mktCount = {};
    mktData.forEach(r => {
      const m = r.taalk_market || 'NULL';
      mktCount[m] = (mktCount[m] || 0) + 1;
    });
    Object.entries(mktCount).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
  }

  // How old are the leads?
  console.log('\nAge of assigned leads (updated_at):');
  const now = Date.now();
  const { data: ages } = await supabase.from('masterlead')
    .select('updated_at, cnresolution, taalk_market')
    .eq('cn_email', EMAIL)
    .not('cnresolution', 'in', '(booked,sale,spoke,not_interested)')
    .order('updated_at', { ascending: false })
    .limit(200);
  
  if (ages) {
    const buckets = { 'under 1h': 0, '1-4h': 0, '4-24h': 0, 'over 24h': 0 };
    ages.forEach(r => {
      const ageMs = now - new Date(r.updated_at).getTime();
      const ageH = ageMs / 3600000;
      if (ageH < 1) buckets['under 1h']++;
      else if (ageH < 4) buckets['1-4h']++;
      else if (ageH < 24) buckets['4-24h']++;
      else buckets['over 24h']++;
    });
    Object.entries(buckets).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
  }
}

main().catch(console.error).finally(() => process.exit(0));
