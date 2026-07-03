import pg from 'pg';
import https from 'https';
const { Pool } = pg;

const neon = new Pool({ connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });
const SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPA_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supaFetch = (path) => new Promise((resolve, reject) => {
  https.get(`${SUPA_URL}${path}`, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }, r => {
    let d = ''; r.on('data', c => d += c);
    r.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
  }).on('error', reject);
});

const supaPost = (path, body) => new Promise((resolve, reject) => {
  const data = JSON.stringify(body);
  const opts = {
    hostname: 'ycztjetxwpfgtrzeyytt.supabase.co',
    path, method: 'PATCH',
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal', 'Content-Length': Buffer.byteLength(data) }
  };
  const req = https.request(opts, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>resolve(r.statusCode)); });
  req.on('error', reject);
  req.write(data); req.end();
});

// Step 1: Get agents with dials in last 2 weeks from local Neon
const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
const { rows: activeAgents } = await neon.query(`
  SELECT DISTINCT agent_email FROM agent_daily_stats 
  WHERE stat_date >= $1 AND dials > 0
`, [twoWeeksAgo.toISOString().split('T')[0]]);

console.log(`Found ${activeAgents.length} active agents with dials in last 2 weeks`);

// Step 2: For each active agent, look up associate_id from Supabase customers
let updated = 0;
let notFound = 0;

for (const { agent_email } of activeAgents) {
  if (!agent_email) continue;
  
  // Get associate_id and agent_name from customers
  const custRows = await supaFetch(`/rest/v1/customers?select=associate_id,agent_name,company_email&company_email=eq.${encodeURIComponent(agent_email)}&limit=1`);
  
  if (!custRows?.length || !custRows[0]?.associate_id) {
    notFound++;
    continue;
  }
  
  const { associate_id, agent_name, company_email } = custRows[0];
  
  // Step 3: Update platform_sales rows for this associate_id where identity is missing
  const status = await supaPost(
    `/rest/v1/platform_sales?associate_id=eq.${associate_id}&company_email=is.null`,
    { company_email: agent_email, agent_name: agent_name || company_email?.split('@')[0] || agent_email }
  );
  
  if (status >= 200 && status < 300) {
    updated++;
    if (updated % 10 === 0) console.log(`  Updated ${updated} agents so far...`);
  }
}

console.log(`\n✅ Done: ${updated} agents updated in platform_sales, ${notFound} agents not found in customers`);
await neon.end();
