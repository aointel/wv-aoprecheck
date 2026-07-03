const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

const states = ['AZ','CA','MN','OH','OR','SD','TN','TX','VA','WA'];
const markets = ['globe market'];

async function main() {
  // Exact leadsync query
  const sql1 = `
    SELECT COUNT(*)::int AS cnt
    FROM masterlead
    WHERE (cn_email IS NULL OR cn_email = '')
      AND LOWER(COALESCE(cnresolution,'pending')) = 'pending'
      AND LOWER(COALESCE(taalk_market,'')) NOT IN ('plus lead','plus leads')
      AND COALESCE(dnc::text,'false') NOT IN ('true','1')
      AND COALESCE("TaalkResolve"::text,'') NOT IN ('true','1')
      AND (UPPER(COALESCE(state,'')) = ANY($1::text[]) OR UPPER(COALESCE(taalk_state,'')) = ANY($1::text[]))
      AND (LOWER(COALESCE(taalk_market,'')) = ANY($2::text[]) OR LOWER(COALESCE(market,'')) = ANY($2::text[]))
  `;
  const r1 = await pool.query(sql1, [states, markets]);
  console.log('Leads matching exact leadsync query:', r1.rows[0].cnt);

  // What markets do exist for their states unassigned?
  const sql2 = `
    SELECT LOWER(COALESCE(taalk_market,'NULL')) AS mkt, COUNT(*)::int AS cnt
    FROM masterlead
    WHERE (cn_email IS NULL OR cn_email = '')
      AND LOWER(COALESCE(cnresolution,'pending')) = 'pending'
      AND COALESCE(dnc::text,'false') NOT IN ('true','1')
      AND (UPPER(COALESCE(state,'')) = ANY($1::text[]))
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT 20
  `;
  const r2 = await pool.query(sql2, [states]);
  console.log('Market breakdown (unassigned, their states):');
  r2.rows.forEach(r => console.log(' ', r.mkt, ':', r.cnt));

  // TaalkResolve check - how many are blocked by TaalkResolve=true
  const sql3 = `
    SELECT COUNT(*)::int AS cnt
    FROM masterlead
    WHERE (cn_email IS NULL OR cn_email = '')
      AND LOWER(COALESCE(cnresolution,'pending')) = 'pending'
      AND COALESCE("TaalkResolve"::text,'') IN ('true','1')
      AND (UPPER(COALESCE(state,'')) = ANY($1::text[]))
      AND (LOWER(COALESCE(taalk_market,'')) = ANY($2::text[]) OR LOWER(COALESCE(market,'')) = ANY($2::text[]))
  `;
  const r3 = await pool.query(sql3, [states, markets]);
  console.log('Blocked by TaalkResolve=true:', r3.rows[0].cnt);

  // DNC check
  const sql4 = `
    SELECT COUNT(*)::int AS cnt
    FROM masterlead
    WHERE (cn_email IS NULL OR cn_email = '')
      AND LOWER(COALESCE(cnresolution,'pending')) = 'pending'
      AND COALESCE(dnc::text,'false') IN ('true','1')
      AND (UPPER(COALESCE(state,'')) = ANY($1::text[]))
      AND (LOWER(COALESCE(taalk_market,'')) = ANY($2::text[]) OR LOWER(COALESCE(market,'')) = ANY($2::text[]))
  `;
  const r4 = await pool.query(sql4, [states, markets]);
  console.log('Blocked by DNC=true:', r4.rows[0].cnt);

  // Without TaalkResolve filter
  const sql5 = `
    SELECT COUNT(*)::int AS cnt
    FROM masterlead
    WHERE (cn_email IS NULL OR cn_email = '')
      AND LOWER(COALESCE(cnresolution,'pending')) = 'pending'
      AND COALESCE(dnc::text,'false') NOT IN ('true','1')
      AND (UPPER(COALESCE(state,'')) = ANY($1::text[]))
      AND (LOWER(COALESCE(taalk_market,'')) = ANY($2::text[]) OR LOWER(COALESCE(market,'')) = ANY($2::text[]))
  `;
  const r5 = await pool.query(sql5, [states, markets]);
  console.log('Available ignoring TaalkResolve filter:', r5.rows[0].cnt);

  await pool.end();
}
main().catch(e => { console.error(e.message); pool.end(); });
