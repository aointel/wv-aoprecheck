/**
 * ConnectNow Analytics Database Population Script
 * Processes CSV file and populates the connectnow_daily_kpis table
 * Can be run manually or scheduled to update data
 */

import * as fs from 'fs';
import * as path from 'path';
import { supabaseAdmin } from './supabase';
import { processDailyReport, CAMPAIGN_MAPPINGS } from './connectnow-analytics-service';
import { format, parse, eachDayOfInterval, addDays, startOfWeek, endOfWeek } from 'date-fns';

interface DailyKPI {
  date: string;
  campaign_id: string;
  market: string;
  campaign_type: string;
  total_new: number;
  connected: number;
  transferred: number;
  percent_transferred: number;
  agent_answered: number;
  percent_answered: number;
  ring_duration_avg: number;
  billed: number;
  percent_billed: number;
  missed_with_agent: number;
  percent_missed_agent: number;
  missed_no_agent: number;
  percent_missed_no_agent: number;
  total_missed: number;
  percent_total_missed: number;
}

/**
 * Convert date string from CSV format (MM/DD/YYYY) to PostgreSQL DATE format (YYYY-MM-DD)
 */
function convertDate(dateStr: string): string {
  try {
    const parsed = parse(dateStr, 'M/d/yyyy', new Date());
    return format(parsed, 'yyyy-MM-dd');
  } catch (error) {
    console.error(`Error parsing date: ${dateStr}`, error);
    return dateStr; // Return as-is if parsing fails
  }
}

/**
 * Populate database for a single date
 */
async function populateDate(csvFilePath: string, dateStr: string): Promise<void> {
  const report = await processDailyReport(csvFilePath, dateStr);
  
  const kpisToInsert: DailyKPI[] = [];
  
  for (const campaign of report.campaigns) {
    const kpi: DailyKPI = {
      date: convertDate(dateStr),
      campaign_id: campaign.campaignId,
      market: campaign.market,
      campaign_type: campaign.campaignType,
      total_new: campaign.totalNew,
      connected: campaign.kpis.connected,
      transferred: campaign.kpis.transferred,
      percent_transferred: parseFloat(campaign.kpis.percentTransferred.toFixed(2)),
      agent_answered: campaign.kpis.agentAnswered,
      percent_answered: parseFloat(campaign.kpis.percentAnswered.toFixed(2)),
      ring_duration_avg: parseFloat(campaign.kpis.ringDuration.toFixed(2)),
      billed: campaign.kpis.billed,
      percent_billed: parseFloat(campaign.kpis.percentBilled.toFixed(2)),
      missed_with_agent: campaign.kpis.missedWithAgent,
      percent_missed_agent: parseFloat(campaign.kpis.percentMissedAgent.toFixed(2)),
      missed_no_agent: campaign.kpis.missedNoAgent,
      percent_missed_no_agent: parseFloat(campaign.kpis.percentMissedNoAgent.toFixed(2)),
      total_missed: campaign.kpis.totalMissed,
      percent_total_missed: parseFloat(campaign.kpis.percentTotalMissed.toFixed(2)),
    };
    
    kpisToInsert.push(kpi);
  }
  
  // Use upsert to handle duplicates (ON CONFLICT)
  if (kpisToInsert.length > 0) {
    const { error } = await supabaseAdmin
      .from('connectnow_daily_kpis')
      .upsert(kpisToInsert, {
        onConflict: 'date,campaign_id',
        ignoreDuplicates: false
      });
    
    if (error) {
      console.error(`❌ Error inserting KPIs for ${dateStr}:`, error);
      throw error;
    }
    
    console.log(`✅ Inserted ${kpisToInsert.length} campaign KPIs for ${dateStr}`);
  }
}

/**
 * Get all unique dates from CSV file
 */
function getUniqueDatesFromCSV(csvFilePath: string): string[] {
  const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  const dates = new Set<string>();
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Parse CSV line - Date is first column
    const match = line.match(/^([^,]+),/);
    if (match && match[1]) {
      const dateStr = match[1].trim().replace(/"/g, '');
      if (dateStr && dateStr.match(/\d+\/\d+\/\d+/)) {
        dates.add(dateStr);
      }
    }
  }
  
  return Array.from(dates).sort();
}

/**
 * Populate database for all dates in CSV or a specific date range
 */
export async function populateAnalyticsDatabase(
  csvFilePath: string, 
  startDate?: string, 
  endDate?: string
): Promise<void> {
  console.log('📊 Starting ConnectNow Analytics database population...');
  console.log(`📄 CSV File: ${csvFilePath}`);
  
  if (!fs.existsSync(csvFilePath)) {
    throw new Error(`CSV file not found: ${csvFilePath}`);
  }
  
  // Get dates to process
  let datesToProcess: string[] = [];
  
  if (startDate && endDate) {
    // Process date range
    const start = parse(startDate, 'M/d/yyyy', new Date());
    const end = parse(endDate, 'M/d/yyyy', new Date());
    const allDays = eachDayOfInterval({ start, end });
    datesToProcess = allDays.map(d => format(d, 'M/d/yyyy'));
    console.log(`📅 Processing date range: ${startDate} to ${endDate} (${datesToProcess.length} days)`);
  } else {
    // Get all unique dates from CSV
    datesToProcess = getUniqueDatesFromCSV(csvFilePath);
    console.log(`📅 Found ${datesToProcess.length} unique dates in CSV`);
  }
  
  // Process each date
  let processed = 0;
  let failed = 0;
  
  for (const dateStr of datesToProcess) {
    try {
      await populateDate(csvFilePath, dateStr);
      processed++;
      
      // Small delay to avoid overwhelming the database
      if (processed % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error: any) {
      console.error(`❌ Failed to process ${dateStr}:`, error.message);
      failed++;
    }
  }
  
  console.log(`\n✅ Database population complete!`);
  console.log(`   Processed: ${processed} dates`);
  if (failed > 0) {
    console.log(`   Failed: ${failed} dates`);
  }
}

/**
 * Update database for the current rolling week (Thursday - Wednesday PST)
 */
export async function updateCurrentRollingWeek(csvFilePath: string): Promise<void> {
  console.log('📊 Updating current rolling week...');
  
  // Calculate current rolling week (Thursday to Wednesday PST)
  const now = new Date();
  const pstOffset = -8 * 60; // PST is UTC-8
  const pstNow = new Date(now.getTime() + (now.getTimezoneOffset() + pstOffset) * 60 * 1000);
  
  // Find most recent Thursday
  let weekStart = new Date(pstNow);
  const dayOfWeek = weekStart.getDay(); // 0 = Sunday, 4 = Thursday
  const daysSinceThursday = (dayOfWeek + 3) % 7; // Days since last Thursday
  if (daysSinceThursday > 0) {
    weekStart = addDays(weekStart, -daysSinceThursday);
  }
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = addDays(weekStart, 6); // Wednesday
  weekEnd.setHours(23, 59, 59, 999);
  
  const startDateStr = format(weekStart, 'M/d/yyyy');
  const endDateStr = format(weekEnd, 'M/d/yyyy');
  
  console.log(`📅 Rolling week: ${startDateStr} (Thursday) to ${endDateStr} (Wednesday) PST`);
  
  await populateAnalyticsDatabase(csvFilePath, startDateStr, endDateStr);
}

// CLI usage - run if executed directly
// Allow CSV file to be specified as first argument, otherwise use default
const args = process.argv.slice(2);
const csvFileName = args[0] && args[0].endsWith('.csv') ? args[0] : '3c4b684f-daa5-407c-8248-fe43bfbbfddf.csv';
const csvFilePath = path.join(process.cwd(), 'server', csvFileName);
const scriptArgs = args[0] && args[0].endsWith('.csv') ? args.slice(1) : args;

if (args[0] === '--week' || args[0] === '-w') {
  // Update current rolling week
  updateCurrentRollingWeek(csvFilePath)
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
} else if (args[0] === '--all' || args[0] === '-a') {
  // Populate all dates
  populateAnalyticsDatabase(csvFilePath)
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
} else if (args[0] && args[1]) {
  // Populate date range
  populateAnalyticsDatabase(csvFilePath, args[0], args[1])
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
} else {
  console.log('Usage:');
  console.log('  npm run populate-analytics -- --week          Update current rolling week');
  console.log('  npm run populate-analytics -- --all           Populate all dates from CSV');
  console.log('  npm run populate-analytics -- <start> <end>   Populate date range (M/d/yyyy)');
  console.log('');
  console.log('Example:');
  console.log('  npm run populate-analytics -- 11/21/2025 11/27/2025');
  process.exit(1);
}

