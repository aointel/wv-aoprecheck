/**
 * Dial/Reach/Booked Report
 * Total and per-user stats for a date range. Optional split by market (Globe vs Veteran).
 * Excludes low-activity users (barely log on)
 *
 * Run: npx tsx scripts/january-dial-reach-booked.ts [options]
 *
 * Options:
 *   --year=2026         Year (for January mode)
 *   --min-dials=200     Exclude users with ≤ this many dials; only include agents over this threshold (default: 200)
 *   --last-two-weeks    Last 2 weeks (rolling from today, or Jan 16–31 if combined with --year)
 *   --by-market         Separate report by Globe / Veteran / Other (by lead's market)
 *   --totals-only       Only print totals, skip per-user breakdown
 *   --csv               Output agent breakdown by market as CSV (use with --by-market)
 *   --output=file.csv   Write CSV to file (use with --csv); omit to print to stdout
 *
 * Examples:
 *   npx tsx scripts/january-dial-reach-booked.ts --last-two-weeks
 *   npx tsx scripts/january-dial-reach-booked.ts --last-two-weeks --by-market
 *   npx tsx scripts/january-dial-reach-booked.ts --year=2026 --last-two-weeks --by-market
 *   npx tsx scripts/january-dial-reach-booked.ts --last-two-weeks --by-market --min-dials=50 --csv > report.csv
 */

import * as fs from 'fs';

import {
  calculateDialReachBookedRealtime,
  calculateDialReachBookedByMarket,
  getDateRangeForTimePeriod,
} from '../server/scripts/calculate-dial-reach-booked-realtime';

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function escapeCsv(val: string | number): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function printTable(stats: { agentEmail: string; agentName?: string; dialed: number; reached: number; booked: number; reachRate: number; bookedRate: number }[], totals: { dialed: number; reached: number; booked: number }) {
  const reachRate = totals.dialed > 0 ? ((totals.reached / totals.dialed) * 100).toFixed(1) : '0';
  const bookRate = totals.reached > 0 ? ((totals.booked / totals.reached) * 100).toFixed(1) : '0';
  console.log(
    'AGENT EMAIL'.padEnd(42) + 'DIALED'.padStart(8) + 'REACHED'.padStart(10) + 'BOOKED'.padStart(8) + 'REACH %'.padStart(10) + 'BOOK %'.padStart(10)
  );
  console.log('-'.repeat(90));
  for (const s of stats) {
    const name = (s.agentName || s.agentEmail).substring(0, 40).padEnd(42);
    console.log(
      name +
        String(s.dialed).padStart(8) +
        String(s.reached).padStart(10) +
        String(s.booked).padStart(8) +
        `${s.reachRate}%`.padStart(10) +
        `${s.bookedRate}%`.padStart(10)
    );
  }
  console.log('-'.repeat(90));
  console.log('TOTALS'.padEnd(42) + String(totals.dialed).padStart(8) + String(totals.reached).padStart(10) + String(totals.booked).padStart(8) + `${reachRate}%`.padStart(10) + `${bookRate}%`.padStart(10));
}

async function main() {
  const year = parseInt(process.argv.find((a) => a.startsWith('--year='))?.split('=')[1] || String(new Date().getFullYear()), 10);
  const minDials = parseInt(process.argv.find((a) => a.startsWith('--min-dials='))?.split('=')[1] || '200', 10);
  const lastTwoWeeks = process.argv.includes('--last-two-weeks');
  const byMarket = process.argv.includes('--by-market');
  const totalsOnly = process.argv.includes('--totals-only');

  let startStr: string;
  let endStr: string;
  let rangeLabel: string;

  if (lastTwoWeeks) {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 13);
    startStr = fmt(start);
    endStr = fmt(end);
    rangeLabel = `Last 2 weeks (${startStr} to ${endStr})`;
  } else {
    startStr = `${year}-01-01`;
    endStr = `${year}-01-31`;
    rangeLabel = `January ${year}`;
  }

  const { start, end } = getDateRangeForTimePeriod('custom', startStr, endStr);
  const outputCsv = process.argv.includes('--csv');
  if (!outputCsv) {
    console.log(`\n📅 ${rangeLabel} Report (unique agents, >${minDials} total dials)${byMarket ? ' – by market' : ''}`);
    console.log(`   Range: ${start.toISOString()} → ${end.toISOString()}\n`);
  }

  if (byMarket) {
    let bm: Record<string, { agentEmail: string; agentName?: string; dialed: number; reached: number; booked: number; reachRate: number; bookedRate: number }[]>;
    let all: { agentEmail: string; agentName?: string; dialed: number; reached: number; booked: number; reachRate: number; bookedRate: number }[];
    if (outputCsv) {
      const origLog = console.log;
      console.log = () => {};
      try {
        const res = await calculateDialReachBookedByMarket(undefined, 'custom', startStr, endStr);
        bm = res.byMarket;
        all = res.all;
      } finally {
        console.log = origLog;
      }
    } else {
      const res = await calculateDialReachBookedByMarket(undefined, 'custom', startStr, endStr);
      bm = res.byMarket;
      all = res.all;
    }
    const qualifyingEmails = new Set(all.filter((s) => s.dialed > minDials).map((s) => s.agentEmail));
    const allStats = all.filter((s) => s.dialed > minDials);

    if (outputCsv) {
      const marketStats = new Map<string, { agentName?: string; Globe: { d: number; r: number; b: number }; Veteran: { d: number; r: number; b: number }; Other: { d: number; r: number; b: number } }>();
      for (const a of allStats) {
        marketStats.set(a.agentEmail, {
          agentName: a.agentName,
          Globe: { d: 0, r: 0, b: 0 },
          Veteran: { d: 0, r: 0, b: 0 },
          Other: { d: 0, r: 0, b: 0 },
        });
      }
      for (const m of ['Globe', 'Veteran', 'Other'] as const) {
        for (const s of (bm[m] || [])) {
          if (qualifyingEmails.has(s.agentEmail)) {
            const row = marketStats.get(s.agentEmail);
            if (row) {
              row[m] = { d: s.dialed, r: s.reached, b: s.booked };
            }
          }
        }
      }
      const headers = ['agent_email', 'agent_name', 'globe_dialed', 'globe_reached', 'globe_booked', 'veteran_dialed', 'veteran_reached', 'veteran_booked', 'other_dialed', 'other_reached', 'other_booked', 'total_dialed', 'total_reached', 'total_booked'];
      const lines = [headers.join(',')];
      for (const a of allStats) {
        const row = marketStats.get(a.agentEmail)!;
        lines.push([
          escapeCsv(a.agentEmail),
          escapeCsv(a.agentName ?? ''),
          row.Globe.d,
          row.Globe.r,
          row.Globe.b,
          row.Veteran.d,
          row.Veteran.r,
          row.Veteran.b,
          row.Other.d,
          row.Other.r,
          row.Other.b,
          a.dialed,
          a.reached,
          a.booked,
        ].join(','));
      }
      const csvContent = lines.join('\n');
      const outFile = process.argv.find((a) => a.startsWith('--output='))?.split('=')[1];
      if (outFile) {
        fs.writeFileSync(outFile, csvContent, 'utf-8');
        console.error(`✅ Wrote ${allStats.length} agents to ${outFile}`);
      } else {
        console.log(csvContent);
      }
      return;
    }
    for (const m of ['Globe', 'Veteran', 'Other']) {
      let stats = (bm[m] || []).filter((s) => qualifyingEmails.has(s.agentEmail));
      if (stats.length === 0) continue;
      const totalDialed = stats.reduce((s, a) => s + a.dialed, 0);
      const totalReached = stats.reduce((s, a) => s + a.reached, 0);
      const totalBooked = stats.reduce((s, a) => s + a.booked, 0);
      console.log('='.repeat(90));
      console.log(`${rangeLabel.toUpperCase()} – ${m.toUpperCase()} MARKET`);
      console.log('='.repeat(90));
      const users = stats.length;
      console.log(`  Users: ${users}  |  Dialed: ${totalDialed}  |  Reached: ${totalReached}  |  Booked: ${totalBooked}`);
      if (!totalsOnly) {
        console.log('');
        printTable(stats, { dialed: totalDialed, reached: totalReached, booked: totalBooked });
      }
      console.log('');
    }
    if (allStats.length > 0) {
      const totalDialed = allStats.reduce((s, a) => s + a.dialed, 0);
      const totalReached = allStats.reduce((s, a) => s + a.reached, 0);
      const totalBooked = allStats.reduce((s, a) => s + a.booked, 0);
      console.log('='.repeat(90));
      console.log(`${rangeLabel.toUpperCase()} – ALL MARKETS COMBINED`);
      console.log('='.repeat(90));
      console.log(`  Users: ${allStats.length}  |  Dialed: ${totalDialed}  |  Reached: ${totalReached}  |  Booked: ${totalBooked}`);
      if (!totalsOnly) {
        console.log('');
        printTable(allStats, { dialed: totalDialed, reached: totalReached, booked: totalBooked });
      }
    }
  } else {
    let stats = await calculateDialReachBookedRealtime(undefined, 'custom', startStr, endStr);
    const excluded = stats.filter((s) => s.dialed <= minDials).length;
    stats = stats.filter((s) => s.dialed > minDials);
    if (excluded > 0) console.log(`   Excluded ${excluded} users with ≤ ${minDials} dials\n`);
    if (stats.length === 0) {
      console.log('No data for this period.');
      return;
    }
    const totalDialed = stats.reduce((s, a) => s + a.dialed, 0);
    const totalReached = stats.reduce((s, a) => s + a.reached, 0);
    const totalBooked = stats.reduce((s, a) => s + a.booked, 0);
    const uniqueUsers = stats.length;
    const avgDialed = Math.round(totalDialed / uniqueUsers);
    const avgReached = Math.round(totalReached / uniqueUsers);
    const avgBooked = Math.round(totalBooked / uniqueUsers);
    const reachRate = totalDialed > 0 ? ((totalReached / totalDialed) * 100).toFixed(1) : '0';
    const bookRate = totalReached > 0 ? ((totalBooked / totalReached) * 100).toFixed(1) : '0';
    console.log('='.repeat(70));
    console.log(`${rangeLabel.toUpperCase()} – TOTALS`);
    console.log('='.repeat(70));
    console.log(`  Total Dialed:    ${totalDialed}`);
    console.log(`  Total Reached:   ${totalReached}`);
    console.log(`  Total Booked:    ${totalBooked}`);
    console.log(`  Reach Rate:      ${reachRate}%`);
    console.log(`  Book Rate:       ${bookRate}%`);
    console.log('');
    console.log('='.repeat(70));
    console.log(`UNIQUE USERS: ${uniqueUsers}`);
    console.log('='.repeat(70));
    console.log(`  Avg Dialed/user:  ${avgDialed}`);
    console.log(`  Avg Reached/user: ${avgReached}`);
    console.log(`  Avg Booked/user:  ${avgBooked}`);
    if (!totalsOnly) {
      console.log('');
      console.log('='.repeat(90));
      console.log('PER-USER BREAKDOWN');
      console.log('='.repeat(90));
      printTable(stats, { dialed: totalDialed, reached: totalReached, booked: totalBooked });
    }
  }
  console.log('='.repeat(90));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
