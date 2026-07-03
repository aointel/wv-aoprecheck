const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require',
  max: 3,
});

const EMAIL = 'leynatran@aoglobelife.com';

async function main() {
  console.log(`\nChecking masterlead (Neon Postgres) for ${EMAIL}...\n`);

  // Count by cnresolution
  const { rows: byRes } = await pool.query(`
    SELECT COALESCE(cnresolution, 'NULL') as resolution, COUNT(*) as cnt
    FROM masterlead
    WHERE cn_email = $1
    GROUP BY cnresolution
    ORDER BY cnt DESC
  `, [EMAIL]);

  console.log('By cnresolution:');
  byRes.forEach(r => console.log(`  "${r.resolution}": ${r.cnt}`));

  // Total
  const { rows: [{ total }] } = await pool.query(`SELECT COUNT(*) as total FROM masterlead WHERE cn_email = $1`, [EMAIL]);
  console.log(`\nTOTAL in Neon: ${total}`);

  // By taalk_market
  const { rows: byMkt } = await pool.query(`
    SELECT COALESCE(taalk_market, 'NULL') as market, COUNT(*) as cnt
    FROM masterlead WHERE cn_email = $1
    GROUP BY taalk_market ORDER BY cnt DESC
  `, [EMAIL]);
  console.log('\nBy taalk_market:');
  byMkt.forEach(r => console.log(`  ${r.market}: ${r.cnt}`));

  // Age breakdown
  const { rows: ages } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '1 hour') as under_1h,
      COUNT(*) FILTER (WHERE updated_at BETWEEN NOW() - INTERVAL '4 hours' AND NOW() - INTERVAL '1 hour') as "1_to_4h",
      COUNT(*) FILTER (WHERE updated_at BETWEEN NOW() - INTERVAL '24 hours' AND NOW() - INTERVAL '4 hours') as "4_to_24h",
      COUNT(*) FILTER (WHERE updated_at < NOW() - INTERVAL '24 hours') as over_24h
    FROM masterlead
    WHERE cn_email = $1
      AND COALESCE(cnresolution,'pending') IN ('pending','called','no_answer','no_answer_vm','')
      AND COALESCE(taalk_market,'') NOT ILIKE '%plus%'
  `, [EMAIL]);
  console.log('\nAge of callable leads:');
  console.log(`  under 1h: ${ages[0].under_1h}`);
  console.log(`  1-4h:     ${ages[0]['1_to_4h']}`);
  console.log(`  4-24h:    ${ages[0]['4_to_24h']}`);
  console.log(`  over 24h: ${ages[0].over_24h}`);

  // Source of the 197 - what's feeding these leads?
  const { rows: recent } = await pool.query(`
    SELECT updated_at, cnresolution, taalk_market, assigned_at, last_assigned_date
    FROM masterlead
    WHERE cn_email = $1
    ORDER BY updated_at DESC
    LIMIT 5
  `, [EMAIL]);
  console.log('\nMost recently updated leads:');
  recent.forEach(r => console.log(`  updated=${r.updated_at?.toISOString().slice(0,19)} res=${r.cnresolution} mkt=${r.taalk_market}`));
}

main().catch(console.error).finally(() => pool.end());
