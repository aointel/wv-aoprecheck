import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

const weekEnding = '2026-04-08';
const market = 'Globe';

const rows = [
  [null, 'RODNEY JONES', 4500, 0, 256, 4756, 47.56],
  ['MICHAEL ROMERO', 'JAMES ROMERO', 4141, 240, 0, 4381, 43.81],
  ['KINGSLEY IBEH', 'BARBARA JOYNT', 3838, 0, 0, 3838, 38.38],
  ['KINGSLEY IBEH', 'BRIDGET CALLAHAN', 3497, 0, 0, 3497, 34.97],
  ['JUSTIN LOWE', 'BOBBY RAMJIST', 3364, 0, 0, 3364, 33.64],
  ['CARLO BUHAY', 'HOI WAN', 3315, 0, 0, 3315, 33.15],
  ['SHAHRIAR MOHAMMADI', 'OLIVER RYAN', 2728, 0, 1408, 4136, 41.36],
  ['ANDI IFTIU', 'JOSHUA WALKER', 2542, 0, 0, 2542, 25.42],
  ['ANDI IFTIU', 'ZACHARIAH SEMLANI', 2499, 0, 0, 2499, 24.99],
  ['MARK DUSHAJ', 'LAUREN PASQUAL', 2420, 0, 0, 2420, 24.20],
  ['JOSEPH DIECEDUE', 'JENNIFER ALVAREZ', 2242, 0, 0, 2242, 22.42],
  ['GIBSON WEIN', 'ADRIAN RODRIGUEZ', 2195, 0, 0, 2195, 21.95],
  ['MARK DUSHAJ', 'MALLORY SITTO', 2192, 3859, 0, 6050, 60.50],
  ['GIBSON WEIN', 'JOHN AVILA', 2144, 0, 3492, 5636, 56.36],
  ['GIBSON WEIN', 'CRISTINA RAVARD', 2026, 0, 0, 2026, 20.26],
  ['NATHANIEL MARCO', 'STEPHANIE CAHALL', 1969, 6072, 1311, 9351, 93.51],
  ['DANIEL PERKINS', 'LAURA CHAVEZ', 1914, 0, 0, 1914, 19.14],
  ['ANDI IFTIU', 'CUTTER CAMEAU', 1903, 0, 587, 2490, 24.90],
  ['FELIPE MACHADOSANTANNA', 'VITOR INGLESBUCHE', 1845, 0, 0, 1845, 18.45],
  ['KINGSLEY IBEH', 'RAQUEL ALEXANDER', 1843, 0, 0, 1843, 18.43],
  ['BRAYLON WEBB', 'BRITTANY LAPIO', 1841, 0, 0, 1841, 18.41],
  ['CARRINGTON HANNA', 'ALONZO ALEXANDER', 1717, 0, 0, 1717, 17.17],
  [null, 'ANTHONY GRECO', 1498, 0, 0, 1498, 14.98],
  ['TANYA STARK', 'LISA ZGOLLI', 1399, 0, 250, 1649, 16.49],
  ['GIBSON WEIN', 'EDWARD WERTHNER JR', 1392, 0, 0, 1392, 13.92],
  ['SHAHRIAR MOHAMMADI', 'ROBERT MORLEY', 1337, 0, 716, 2053, 20.53],
  ['GIBSON WEIN', 'DOMINIC RIBEIRO', 1157, 0, 0, 1157, 11.57],
  ['MARSHALL FERNANDEZ', 'TALAYA THOMAS', 974, 0, 0, 974, 9.74],
  ['SHAHRIAR MOHAMMADI', 'AMIN ANSARI', 767, 0, 0, 767, 7.67],
  ['JACOB BUZZARD', 'RYAN ALEMAN', 690, 2462, 1814, 4965, 49.65],
  ['JUSTIN HERMANN', 'LINDA MARQUEZ', 655, 0, 3930, 4585, 45.85],
  ['BLAKE HIGUCHI', 'CHANDELE TACHIBANA', 622, 0, 0, 622, 6.22],
  ['CARRINGTON HANNA', 'DOMINIQUE CARTER', 564, 0, 0, 564, 5.64],
  ['MEAGHAN MAHER', 'KAYLEE MCCARTNEY', 547, 0, 0, 547, 5.47],
  ['CARRINGTON HANNA', 'STEPHEN LONGARD', 540, 0, 0, 540, 5.40],
  ['ANDI IFTIU', 'CHRISTOPHER BLANC', 525, 2269, 0, 2793, 27.93],
  ['MATHEW KAHWAJI', 'TYJERE MORROW', 520, 0, 500, 1020, 10.20],
  [null, 'HELEN BRADLEY', 431, 0, 1042, 1472, 14.72],
  ['MARY MALEK', 'JAYLEN BOND', 240, 0, 0, 240, 2.40],
  ['MATHEW KAHWAJI', 'TY STAPLES', 0, 8172, 0, 8172, 81.72],
  ['SARA VAZ', 'NICOLE MILKOVICH', 0, 0, 1562, 1562, 15.62],
];

let inserted = 0;
for (const [exec, producer, mAlp, nmAlp, plusAlp, totalAlp, per100] of rows) {
  await pool.query(`
    INSERT INTO market_alp_weekly (week_ending, market, exec_producer, producer, market_alp, non_market_alp, plus_lead_alp, total_alp, alp_per_100_leads)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (week_ending, market, producer) DO UPDATE SET
      exec_producer=EXCLUDED.exec_producer, market_alp=EXCLUDED.market_alp,
      non_market_alp=EXCLUDED.non_market_alp, plus_lead_alp=EXCLUDED.plus_lead_alp,
      total_alp=EXCLUDED.total_alp, alp_per_100_leads=EXCLUDED.alp_per_100_leads
  `, [weekEnding, market, exec, producer, mAlp, nmAlp, plusAlp, totalAlp, per100]);
  inserted++;
}

const t = await pool.query(`SELECT SUM(market_alp) m, SUM(non_market_alp) nm, SUM(plus_lead_alp) pl, SUM(total_alp) total FROM market_alp_weekly WHERE week_ending=$1`, [weekEnding]);
console.log(`✅ ${inserted} rows inserted for week ending ${weekEnding}`);
console.log(`   Market ALP: $${Number(t.rows[0].m).toLocaleString()}`);
console.log(`   Non-Market: $${Number(t.rows[0].nm).toLocaleString()}`);
console.log(`   Plus Lead:  $${Number(t.rows[0].pl).toLocaleString()}`);
console.log(`   Total ALP:  $${Number(t.rows[0].total).toLocaleString()}`);
pool.end();
