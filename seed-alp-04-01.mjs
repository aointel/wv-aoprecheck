import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

const weekEnding = '2026-04-01';
const market = 'Globe';

const rows = [
  ['GIBSON WEIN', 'AUSTIN SARIBOYAJIAN', 6869, 0, 0, 6869, 68.69],
  ['SHAHRIAR MOHAMMADI', 'AMIN ANSARI', 4758, 0, 0, 4758, 47.58],
  ['DANIEL PERKINS', 'LAURA CHAVEZ', 4713, 0, 1320, 6033, 60.33],
  ['ANDI IFTIU', 'JOSHUA WALKER', 4595, 0, 0, 4595, 45.95],
  ['GIBSON WEIN', 'JESSE RUSSO', 4182, 0, 0, 4182, 41.82],
  ['GIBSON WEIN', 'CRISTINA RAVARD', 3910, 12722, 749, 17381, 173.81],
  ['SHAHRIAR MOHAMMADI', 'ROBERT MORLEY', 3785, 0, 6210, 9994, 99.94],
  ['SARA VAZ', 'AUSTIN ROCKALL', 3195, 0, 0, 3195, 31.95],
  ['MARK DUSHAJ', 'MALLORY SITTO', 2901, 15703, 0, 18604, 186.04],
  ['DUANE SHAW', 'CAROLYN GEORGE', 2729, 2751, 0, 5480, 54.80],
  ['MATHEW KAHWAJI', 'LANE BEASLEY', 2582, 0, 0, 2582, 25.82],
  ['DANIEL PERKINS', 'JOEL GUZMANVAZQUEZ', 1977, 5052, 0, 7029, 70.29],
  ['ANDI IFTIU', 'CUTTER CAMEAU', 1863, 0, 0, 1863, 18.63],
  ['GIBSON WEIN', 'DOMINIC RIBEIRO', 1726, 0, 0, 1726, 17.26],
  ['GUJRAL AGENCY LTD', 'DEREK WOO', 1701, 1518, 0, 3219, 32.19],
  ['CARLO BUHAY', 'MARVA KING', 1671, 0, 0, 1671, 16.71],
  ['MARK DUSHAJ', 'LAUREN PASQUAL', 1647, 1283, 3005, 5935, 59.35],
  ['CARRINGTON HANNA', 'HOPE MALLER', 1614, 0, 0, 1614, 16.14],
  ['JESSICA CHANG', 'ANTHONY MICHAEL', 1571, 13061, 111, 14743, 147.43],
  ['CARLO BUHAY', 'KENEILWE PHAPHE', 1550, 0, 4512, 6062, 60.62],
  ['SHAWN TOMA', 'KACELA VEREEN', 1517, 2780, 1361, 5657, 56.57],
  ['JUSTIN MALONE', 'ANKITA DAS', 1505, 1982, 2864, 6351, 63.51],
  ['MARKUS WEST', 'ASHLEY DUVENDACK', 1367, 0, 9526, 10893, 108.93],
  ['CHRISTIAN GOJCAJ', 'BRANDON HEGWOOD', 1363, 0, 0, 1363, 13.63],
  ['MARK DUSHAJ', 'ROVENA LULGJURAJ', 1358, 1008, 0, 2366, 23.66],
  ['MICHAEL MCKIERNAN', 'COURTNEY SOMSAN', 1298, 0, 9294, 10592, 105.92],
  ['DANIEL PERKINS', 'JENNIFER MUELLER', 1263, 0, 0, 1263, 12.63],
  ['KINGSLEY IBEH', 'BRIDGET CALLAHAN', 1242, 1807, 4342, 7391, 73.91],
  ['ANDI IFTIU', 'DAVAE HONZU', 1213, 0, 0, 1213, 12.13],
  ['JEROME EY', 'JANINNE HUTSONBLACK', 1188, 0, 0, 1188, 11.88],
  ['ANDI IFTIU', 'JOLEEN CERTEZA', 1169, 0, 0, 1169, 11.69],
  ['MARY MALEK', 'TAYLOR BONEBERG', 1163, 0, 1310, 2473, 24.73],
  ['CARRINGTON HANNA', 'CAMREN MOORE', 1112, 0, 0, 1112, 11.12],
  ['GIBSON WEIN', 'NATHALIA BRENNAN', 1110, 0, 0, 1110, 11.10],
  ['CARRINGTON HANNA', 'COLE THIELFOLDT', 1090, 0, 0, 1090, 10.90],
  ['SHAWN TOMA', 'TOM OHANSIANS', 883, 0, 0, 883, 8.83],
  ['DANIEL PERKINS', 'ABEL KLUG', 833, 1741, 0, 2574, 25.74],
  ['KALLEE MENHINICK', 'KIM TRAN', 801, 0, 0, 801, 8.01],
  ['NATHANIEL MARCO', 'ASHLEY WREN', 784, 0, 0, 784, 7.84],
  ['CARLO BUHAY', 'PETER MOON', 642, 0, 1576, 2218, 22.18],
  ['GIBSON WEIN', 'WILMER FERNANDEZ', 632, 0, 4179, 4811, 48.11],
  ['MICHAEL ROMERO', 'JAMES ROMERO', 610, 0, 0, 610, 6.10],
  ['MATHEW KAHWAJI', 'TYJERE MORROW', 600, 1745, 0, 2345, 23.45],
  ['TANYA STARK', 'DEBORAH MORRIS', 489, 2942, 0, 3431, 34.31],
  [null, 'CHRIS ANDERSON', 427, 1434, 397, 2258, 22.58],
  ['ERVIN METAJ', 'RAMADAN SOPOTI', 328, 0, 0, 328, 3.28],
  ['GIBSON WEIN', 'PHILIPPE FIORE', 174, 1400, 1021, 2594, 25.94],
  ['MARK DUSHAJ', 'JOHNNY BROOKS', 129, 0, 0, 129, 1.29],
  ['CARRINGTON HANNA', 'MORGANA DEPARTEE', 0, 0, 1186, 1186, 11.86],
  ['ROBERT HAMILTON', 'MICHAEL MCLAUGHLIN', 0, 1324, 1745, 3069, 30.69],
  ['MATHEW KAHWAJI', 'MICHAEL DEVITA', 0, 3821, 0, 3821, 38.21],
  ['KINGSLEY IBEH', 'FRANCES BREWER', 0, 2909, 792, 3701, 37.01],
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
console.log(`✅ ${inserted} rows for week ending ${weekEnding}`);
console.log(`   Market ALP: $${Number(t.rows[0].m).toLocaleString()}`);
console.log(`   Non-Market: $${Number(t.rows[0].nm).toLocaleString()}`);
console.log(`   Plus Lead:  $${Number(t.rows[0].pl).toLocaleString()}`);
console.log(`   Total ALP:  $${Number(t.rows[0].total).toLocaleString()}`);
pool.end();
