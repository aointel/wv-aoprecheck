/**
 * Run call analytics analysis on pending transfer calls.
 * Usage: npx tsx server/scripts/run-call-analytics-analysis.ts [daysBack] [--runs=N]
 * Default: 7 days, 1 run. Use --runs=10 to slam through backlog (10 batches of 1000).
 * Loads .env from project root so SUPABASE_URL and SUPABASE_SERVICE_KEY are used when set.
 */
import 'dotenv/config';

import { callAnalyticsScheduler } from '../call-analytics-scheduler';

let daysBack = 7;
let runs = 1;
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--runs=')) runs = Math.max(1, parseInt(a.split('=')[1], 10) || 1);
  else if (!a.startsWith('--')) daysBack = parseInt(a, 10) || 7;
}

async function main() {
  console.log(`📊 Running call analytics (last ${daysBack} days, ${runs} run(s))...`);
  for (let i = 0; i < runs; i++) {
    if (runs > 1) console.log(`\n--- Batch ${i + 1}/${runs} ---`);
    await callAnalyticsScheduler.processPendingCalls(daysBack);
  }
  console.log('\n✅ Call analytics analysis complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
