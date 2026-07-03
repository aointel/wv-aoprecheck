/**
 * TEMPORARY: Disable Live Call Board Stats Scheduler
 * 
 * Run this to stop the scheduler from resetting data
 */

import { liveCallBoardStatsScheduler } from './live-call-board-stats-scheduler';

// Stop the scheduler
liveCallBoardStatsScheduler.stop();

console.log('✅ Live Call Board Stats Scheduler has been stopped');
console.log('   Data will no longer be reset by the scheduler');

