import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

// Create table
await pool.query(`
  CREATE TABLE IF NOT EXISTS market_alp_weekly (
    id bigserial PRIMARY KEY,
    week_ending date NOT NULL,
    market text NOT NULL DEFAULT 'Globe',
    exec_producer text,
    producer text NOT NULL,
    producer_email text,
    market_alp numeric(12,2) NOT NULL DEFAULT 0,
    non_market_alp numeric(12,2) NOT NULL DEFAULT 0,
    plus_lead_alp numeric(12,2) NOT NULL DEFAULT 0,
    total_alp numeric(12,2) NOT NULL DEFAULT 0,
    alp_per_100_leads numeric(10,2) NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE(week_ending, market, producer)
  );
  CREATE INDEX IF NOT EXISTS idx_market_alp_weekly_week ON market_alp_weekly(week_ending DESC);
  CREATE INDEX IF NOT EXISTS idx_market_alp_weekly_producer ON market_alp_weekly(producer);
  CREATE INDEX IF NOT EXISTS idx_market_alp_weekly_exec ON market_alp_weekly(exec_producer);
`);
console.log('✅ Table created');

// Week ending April 15, 2026 — Globe market data
const weekEnding = '2026-04-15';
const market = 'Globe';

const rows = [
  ['SHAHRIAR MOHAMMADI', 'AMIN ANSARI', 6914, 0, 0, 6914, 69.14],
  ['MICHAEL ROMERO', 'JAMES ROMERO', 2978, 0, 402, 3380, 33.80],
  ['JORGE DELRIO', 'RYAN PAWLOWSKI', 2914, 0, 614, 3528, 35.28],
  ['SHAHRIAR MOHAMMADI', 'ROBERT MORLEY', 2881, 0, 0, 2881, 28.81],
  ['MATHEW KAHWAJI', 'TY STAPLES', 2820, 0, 0, 2820, 28.20],
  ['CARRINGTON HANNA', 'ALONZO ALEXANDER', 2392, 0, 0, 2392, 23.92],
  ['JAMES KENNETH', 'ANGELO SPINGOS', 2319, 0, 0, 2319, 23.19],
  ['DANIEL PERKINS', 'OLIVE MARTINEZ', 2278, 0, 0, 2278, 22.78],
  ['JUSTIN LOWE', 'BOBBY RAMJIST', 2235, 0, 0, 2235, 22.35],
  ['ANDI IFTIU', 'BEAU PULLENS', 2036, 0, 0, 2036, 20.36],
  ['ANDI IFTIU', 'CUTTER CAMEAU', 2033, 0, 5720, 7752, 77.52],
  ['PAIGE CHABALA', 'KIMANI CHAMBLISS', 2029, 0, 1594, 3623, 36.23],
  ['CARRINGTON HANNA', 'STEVEN COX', 1919, 0, 0, 1919, 19.19],
  ['MATHEW KAHWAJI', 'WILLIAM TOMAZIN', 1693, 0, 0, 1693, 16.93],
  ['DANIEL PERKINS', 'LAURA CHAVEZ', 1678, 0, 0, 1678, 16.78],
  ['SHAWN TOMA', 'SHAWN TOMA', 1648, 0, 0, 1648, 16.48],
  ['ANDI IFTIU', 'AILEEN MAINE', 1585, 0, 178, 1763, 17.63],
  ['AHMED ELAGRAB', 'JASON SMITH', 1562, 0, 0, 1562, 15.62],
  ['MATHEW KAHWAJI', 'DANIEL BEASLEY', 1536, 4987, 1009, 7532, 75.32],
  ['MICHELE STEWART', 'JAMEE LAMERS', 1517, 22663, 0, 24179, 241.79],
  [null, 'SEAN MELAVEN', 1478, 220, 0, 1698, 16.98],
  ['NICOLETTE VANRENSBURG', 'MISTIE COCKMAN', 1450, 0, 549, 1999, 19.99],
  ['MARY AYARZAGOITIA', 'MATTHEW GOSSETT', 1406, 0, 0, 1406, 14.06],
  ['JOSEPH TOMANOVICH', 'STEPHEN BOWEN', 1352, 6016, 0, 7368, 73.68],
  ['GIBSON WEIN', 'DOMINIC RIBEIRO', 1312, 1862, 0, 3174, 31.74],
  ['CARRINGTON HANNA', 'CAMREN MOORE', 1224, 0, 0, 1224, 12.24],
  ['DANIEL PERKINS', 'ABEL KLUG', 1220, 0, 0, 1220, 12.20],
  ['MARK DUSHAJ', 'LAUREN PASQUAL', 1216, 2497, 1025, 4739, 47.39],
  ['ANDI IFTIU', 'JOLEEN CERTEZA', 1169, 0, 0, 1169, 11.69],
  ['GIBSON WEIN', 'WILMER FERNANDEZ', 1161, 0, 1478, 2639, 26.39],
  ['ARIANNA PATTERSON', 'DENINE HENDERSON', 1115, 1982, 0, 3097, 30.97],
  ['JOSEPH DIECEDUE', 'CAROLYN MATTHEWS', 1057, 0, 596, 1653, 16.53],
  ['GIBSON WEIN', 'BILLY LOPEZ', 999, 0, 0, 999, 9.99],
  ['CHRISTIAN GOJCAJ', 'BRANDON HEGWOOD', 969, 0, 3931, 4900, 49.00],
  [null, 'ZAKI BLANDING', 946, 0, 0, 946, 9.46],
  ['JESSICA CHANG', 'ANTHONY MICHAEL', 928, 7544, 0, 8472, 84.72],
  ['ASHLEY BRASS', 'TYSON RIELAND', 907, 0, 0, 907, 9.07],
  ['ANDI IFTIU', 'ZACHARIAH SEMLANI', 883, 0, 0, 883, 8.83],
  ['RYAN STENGLEIN', 'ANDREW BISHOP', 756, 11220, 0, 11976, 119.76],
  ['MATHEW KAHWAJI', 'TYJERE MORROW', 746, 5986, 0, 6732, 67.32],
  ['BLUETTE DESROSIERS', 'JOSEPH DIECEDUE', 663, 0, 0, 663, 6.63],
  ['DANIEL PERKINS', 'IVY OLCOTT', 629, 0, 0, 629, 6.29],
  ['GIBSON WEIN', 'ROBENS MARDI', 605, 0, 0, 605, 6.05],
  ['MICHELE STEWART', 'TROY TAYLOR', 602, 0, 0, 602, 6.02],
  ['JILLIAN GETZ', 'TAYLOR BONEBERG', 591, 0, 0, 591, 5.91],
  [null, 'LANCE VERVACK', 563, 0, 573, 1136, 11.36],
  ['BRUCE HARDER', 'BRUCE HARDER', 561, 0, 4887, 5448, 54.48],
  ['CARRINGTON HANNA', 'DOMINIQUE CARTER', 504, 0, 0, 504, 5.04],
  ['JOE YOUNG', 'CHRISTOPHER JEANTET', 467, 0, 3225, 3692, 36.92],
  ['ANDI IFTIU', 'JOSHUA WALKER', 388, 0, 0, 388, 3.88],
  ['STEPHEN JUBREY', 'CLAYTON PETRYSHYN', 325, 0, 0, 325, 3.25],
  ['ANDI IFTIU', 'ROBERTO MURILLO', 266, 0, 0, 266, 2.66],
  ['JOSEPH TOMANOVICH', 'ANDREA ROMIG', 0, 0, 1678, 1678, 16.78],
  ['CARRINGTON HANNA', 'CAMERON CHRISTENSEN', 0, 10972, 0, 10972, 109.72],
  ['GIBSON WEIN', 'THOMAS GUNN', 0, 0, 418, 418, 4.18],
  ['CARLO BUHAY', 'PETER MOON', 0, 0, 714, 714, 7.14],
  ['SARA VAZ', 'NICOLE MILKOVICH', 0, 0, 3952, 3952, 39.52],
];

let inserted = 0;
for (const [exec, producer, mAlp, nmAlp, plusAlp, totalAlp, per100] of rows) {
  await pool.query(`
    INSERT INTO market_alp_weekly (week_ending, market, exec_producer, producer, market_alp, non_market_alp, plus_lead_alp, total_alp, alp_per_100_leads)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (week_ending, market, producer) DO UPDATE SET
      exec_producer = EXCLUDED.exec_producer,
      market_alp = EXCLUDED.market_alp,
      non_market_alp = EXCLUDED.non_market_alp,
      plus_lead_alp = EXCLUDED.plus_lead_alp,
      total_alp = EXCLUDED.total_alp,
      alp_per_100_leads = EXCLUDED.alp_per_100_leads
  `, [weekEnding, market, exec, producer, mAlp, nmAlp, plusAlp, totalAlp, per100]);
  inserted++;
}

// Verify totals
const totals = await pool.query(`SELECT SUM(market_alp) as m, SUM(non_market_alp) as nm, SUM(plus_lead_alp) as pl, SUM(total_alp) as total FROM market_alp_weekly WHERE week_ending = $1`, [weekEnding]);
console.log(`✅ Inserted ${inserted} rows for week ending ${weekEnding}`);
console.log(`   Market ALP: $${Number(totals.rows[0].m).toLocaleString()}`);
console.log(`   Non-Market: $${Number(totals.rows[0].nm).toLocaleString()}`);
console.log(`   Plus Lead:  $${Number(totals.rows[0].pl).toLocaleString()}`);
console.log(`   Total ALP:  $${Number(totals.rows[0].total).toLocaleString()}`);
pool.end();
