import 'dotenv/config';

import { verificationAnalysisScheduler } from '../server/verification-analysis-scheduler';

async function run() {
  try {
    const limitArg = process.argv[2];
    const limit = limitArg ? Math.max(1, Number(limitArg) || 0) : undefined;
    await verificationAnalysisScheduler.runFullAnalysisNow(limit);
    console.log('✅ Verification analysis completed');
  } catch (error) {
    console.error('❌ Verification analysis failed:', error);
    process.exitCode = 1;
  }
}

run();

