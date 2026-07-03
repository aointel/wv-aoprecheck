/**
 * Call Pattern Analysis Script
 * 
 * Analyzes call data from agent_dial_metrics, call_log, and twilio_call_logs
 * to determine normal patterns and detect gaming behavior.
 * 
 * Usage: npm run analyze:call-patterns
 *        tsx scripts/analyze-call-patterns.ts [--days=30] [--agent=email@example.com]
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface CallData {
  agent_email: string;
  call_duration: number | null;
  disposition: string | null;
  event_timestamp: string;
  event_type: string;
  call_sid: string | null;
}

interface AgentStats {
  agentEmail: string;
  totalCalls: number;
  answeredCalls: number;
  durations: number[];
  dispositions: string[];
  thresholdHits: {
    at45s: number;
    at120s: number;
    at300s: number;
  };
  dispositionTimings: number[]; // Time between dial and disposition (seconds)
  meanDuration: number;
  stdDevDuration: number;
  percentile25: number;
  percentile50: number;
  percentile75: number;
  percentile95: number;
}

// Parse command line arguments
const args = process.argv.slice(2);
const daysArg = args.find(arg => arg.startsWith('--days='));
const agentArg = args.find(arg => arg.startsWith('--agent='));
const days = daysArg ? parseInt(daysArg.split('=')[1]) : 30;
const specificAgent = agentArg ? agentArg.split('=')[1] : null;

async function fetchCallData(): Promise<CallData[]> {
  console.log(`📊 Fetching call data from last ${days} days...`);
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const allCalls: CallData[] = [];
  
  // 1. Fetch from agent_dial_metrics (primary source)
  console.log('  → Querying agent_dial_metrics...');
  const { data: metricsData, error: metricsError } = await supabase
    .from('agent_dial_metrics')
    .select('agent_email, call_duration, disposition, event_timestamp, event_type, call_sid')
    .gte('event_timestamp', startDate.toISOString())
    .eq('event_type', 'dial') // Only dial events have duration
    .not('call_duration', 'is', null)
    .gt('call_duration', 0);
  
  if (metricsError) {
    console.error('❌ Error fetching agent_dial_metrics:', metricsError);
  } else {
    console.log(`  ✅ Found ${metricsData?.length || 0} calls in agent_dial_metrics`);
    if (metricsData) {
      allCalls.push(...metricsData.map(c => ({
        agent_email: c.agent_email,
        call_duration: c.call_duration,
        disposition: c.disposition,
        event_timestamp: c.event_timestamp,
        event_type: c.event_type,
        call_sid: c.call_sid
      })));
    }
  }
  
  // 2. Fetch from call_log (secondary source)
  console.log('  → Querying call_log...');
  const { data: callLogData, error: callLogError } = await supabase
    .from('call_log')
    .select('agent_email, duration_seconds, disposition, started_at, call_sid')
    .gte('started_at', startDate.toISOString())
    .not('duration_seconds', 'is', null)
    .gt('duration_seconds', 0);
  
  if (callLogError) {
    console.error('❌ Error fetching call_log:', callLogError);
  } else {
    console.log(`  ✅ Found ${callLogData?.length || 0} calls in call_log`);
    if (callLogData) {
      allCalls.push(...callLogData.map(c => ({
        agent_email: c.agent_email,
        call_duration: c.duration_seconds,
        disposition: c.disposition,
        event_timestamp: c.started_at,
        event_type: 'dial',
        call_sid: c.call_sid
      })));
    }
  }
  
  // 3. Fetch from twilio_call_logs (tertiary source)
  console.log('  → Querying twilio_call_logs...');
  const { data: twilioData, error: twilioError } = await supabase
    .from('twilio_call_logs')
    .select('owner_email, call_duration, call_status, call_started_at, twilio_call_sid')
    .gte('call_started_at', startDate.toISOString())
    .not('call_duration', 'is', null)
    .gt('call_duration', 0)
    .eq('call_direction', 'outbound');
  
  if (twilioError) {
    console.error('❌ Error fetching twilio_call_logs:', twilioError);
  } else {
    console.log(`  ✅ Found ${twilioData?.length || 0} calls in twilio_call_logs`);
    if (twilioData) {
      allCalls.push(...twilioData.map(c => ({
        agent_email: c.owner_email,
        call_duration: c.call_duration,
        disposition: null, // twilio_call_logs doesn't have disposition
        event_timestamp: c.call_started_at,
        event_type: 'dial',
        call_sid: c.twilio_call_sid
      })));
    }
  }
  
  // Filter by specific agent if provided
  if (specificAgent) {
    return allCalls.filter(c => c.agent_email.toLowerCase() === specificAgent.toLowerCase());
  }
  
  return allCalls;
}

async function fetchDispositionTimings(agentEmail: string, startDate: Date): Promise<number[]> {
  // Get dial events and their corresponding disposition events
  const { data: dialEvents } = await supabase
    .from('agent_dial_metrics')
    .select('event_timestamp, call_sid, lead_phone')
    .eq('agent_email', agentEmail)
    .eq('event_type', 'dial')
    .gte('event_timestamp', startDate.toISOString());
  
  if (!dialEvents || dialEvents.length === 0) return [];
  
  const timings: number[] = [];
  
  for (const dial of dialEvents) {
    // Find disposition event for same call (by call_sid or lead_phone within 5 minutes)
    const dialTime = new Date(dial.event_timestamp);
    const fiveMinutesLater = new Date(dialTime.getTime() + 5 * 60 * 1000);
    
    const { data: dispositionEvents } = await supabase
      .from('agent_dial_metrics')
      .select('event_timestamp, disposition')
      .eq('agent_email', agentEmail)
      .not('disposition', 'is', null)
      .eq('lead_phone', dial.lead_phone)
      .gte('event_timestamp', dial.event_timestamp)
      .lte('event_timestamp', fiveMinutesLater.toISOString())
      .limit(1);
    
    if (dispositionEvents && dispositionEvents.length > 0) {
      const dispositionTime = new Date(dispositionEvents[0].event_timestamp);
      const timeDiff = (dispositionTime.getTime() - dialTime.getTime()) / 1000; // seconds
      timings.push(timeDiff);
    }
  }
  
  return timings;
}

function calculateStats(durations: number[]): {
  mean: number;
  stdDev: number;
  percentile25: number;
  percentile50: number;
  percentile75: number;
  percentile95: number;
} {
  if (durations.length === 0) {
    return { mean: 0, stdDev: 0, percentile25: 0, percentile50: 0, percentile75: 0, percentile95: 0 };
  }
  
  const sorted = [...durations].sort((a, b) => a - b);
  const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
  const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;
  const stdDev = Math.sqrt(variance);
  
  const percentile = (p: number) => {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  };
  
  return {
    mean,
    stdDev,
    percentile25: percentile(25),
    percentile50: percentile(50),
    percentile75: percentile(75),
    percentile95: percentile(95)
  };
}

function detectThresholdGaming(durations: number[]): { at45s: number; at120s: number; at300s: number } {
  const thresholdWindow = 2; // ±2 seconds
  const thresholds = [45, 120, 300];
  
  const hits = { at45s: 0, at120s: 0, at300s: 0 };
  
  durations.forEach(duration => {
    if (Math.abs(duration - 45) <= thresholdWindow) hits.at45s++;
    if (Math.abs(duration - 120) <= thresholdWindow) hits.at120s++;
    if (Math.abs(duration - 300) <= thresholdWindow) hits.at300s++;
  });
  
  return hits;
}

async function analyzeAgent(agentEmail: string, calls: CallData[], startDate: Date): Promise<AgentStats> {
  const answeredCalls = calls.filter(c => c.call_duration && c.call_duration > 0);
  const durations = answeredCalls.map(c => c.call_duration!).filter(d => d > 0);
  const dispositions = answeredCalls.map(c => c.disposition).filter(d => d !== null) as string[];
  
  const thresholdHits = detectThresholdGaming(durations);
  const stats = calculateStats(durations);
  const dispositionTimings = await fetchDispositionTimings(agentEmail, startDate);
  
  return {
    agentEmail,
    totalCalls: calls.length,
    answeredCalls: answeredCalls.length,
    durations,
    dispositions,
    thresholdHits,
    dispositionTimings,
    ...stats
  };
}

function generateRecommendations(allAgentStats: AgentStats[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('📋 RECOMMENDATIONS BASED ON DATA ANALYSIS');
  console.log('='.repeat(80) + '\n');
  
  // Calculate overall statistics
  const allDurations = allAgentStats.flatMap(s => s.durations);
  const overallStats = calculateStats(allDurations);
  
  // Calculate threshold gaming percentages
  const thresholdGamingPercentages = allAgentStats.map(stat => ({
    agent: stat.agentEmail,
    at45s: (stat.thresholdHits.at45s / stat.answeredCalls) * 100,
    at120s: (stat.thresholdHits.at120s / stat.answeredCalls) * 100,
    at300s: (stat.thresholdHits.at300s / stat.answeredCalls) * 100,
    total: ((stat.thresholdHits.at45s + stat.thresholdHits.at120s + stat.thresholdHits.at300s) / stat.answeredCalls) * 100
  }));
  
  const avgThresholdGaming = thresholdGamingPercentages.reduce((sum, p) => sum + p.total, 0) / thresholdGamingPercentages.length;
  
  // Calculate disposition timing statistics
  const allDispositionTimings = allAgentStats.flatMap(s => s.dispositionTimings);
  const dispositionTimingStats = calculateStats(allDispositionTimings);
  
  // Calculate variation statistics
  const variationStats = allAgentStats.map(stat => ({
    agent: stat.agentEmail,
    stdDev: stat.stdDevDuration,
    mean: stat.meanDuration
  }));
  const avgStdDev = variationStats.reduce((sum, v) => sum + v.stdDev, 0) / variationStats.length;
  
  console.log('📊 OVERALL STATISTICS:');
  console.log(`   Total Calls Analyzed: ${allAgentStats.reduce((sum, s) => sum + s.totalCalls, 0).toLocaleString()}`);
  console.log(`   Answered Calls: ${allAgentStats.reduce((sum, s) => sum + s.answeredCalls, 0).toLocaleString()}`);
  console.log(`   Average Call Duration: ${overallStats.mean.toFixed(1)}s (${(overallStats.mean / 60).toFixed(1)} min)`);
  console.log(`   Standard Deviation: ${overallStats.stdDev.toFixed(1)}s`);
  console.log(`   Median (50th percentile): ${overallStats.percentile50.toFixed(1)}s`);
  console.log(`   95th percentile: ${overallStats.percentile95.toFixed(1)}s`);
  console.log(`   Average Threshold Gaming: ${avgThresholdGaming.toFixed(1)}%`);
  console.log(`   Average Call Duration Variation (std dev): ${avgStdDev.toFixed(1)}s`);
  console.log(`   Average Disposition Timing: ${dispositionTimingStats.mean.toFixed(1)}s`);
  
  console.log('\n🎯 RECOMMENDED THRESHOLDS:');
  console.log('\n   1. THRESHOLD GAMING DETECTION:');
  console.log(`      • Flag if >${(avgThresholdGaming * 1.5).toFixed(1)}% of calls are at thresholds (45s, 120s, 300s)`);
  console.log(`      • Current average: ${avgThresholdGaming.toFixed(1)}%`);
  console.log(`      • Recommendation: ${(avgThresholdGaming * 1.5).toFixed(1)}% threshold (1.5x average)`);
  
  console.log('\n   2. CALL DURATION VARIATION:');
  console.log(`      • Flag if std dev < ${(avgStdDev * 0.5).toFixed(1)}s (too consistent)`);
  console.log(`      • Current average std dev: ${avgStdDev.toFixed(1)}s`);
  console.log(`      • Recommendation: ${(avgStdDev * 0.5).toFixed(1)}s minimum (50% of average)`);
  
  console.log('\n   3. DISPOSITION TIMING:');
  console.log(`      • Flag if >20% of dispositions applied < ${Math.max(10, dispositionTimingStats.percentile25).toFixed(0)}s after dial`);
  console.log(`      • Current average: ${dispositionTimingStats.mean.toFixed(1)}s`);
  console.log(`      • Recommendation: ${Math.max(10, dispositionTimingStats.percentile25).toFixed(0)}s minimum`);
  
  console.log('\n   4. STATISTICAL ANOMALY DETECTION:');
  console.log(`      • Use 1 standard deviation from mean for anomaly detection`);
  console.log(`      • Mean: ${overallStats.mean.toFixed(1)}s`);
  console.log(`      • Std Dev: ${overallStats.stdDev.toFixed(1)}s`);
  console.log(`      • Normal range: ${(overallStats.mean - overallStats.stdDev).toFixed(1)}s - ${(overallStats.mean + overallStats.stdDev).toFixed(1)}s`);
  
  console.log('\n⚠️  AGENTS WITH SUSPICIOUS PATTERNS:');
  const suspiciousAgents = allAgentStats.filter(stat => {
    const thresholdPct = ((stat.thresholdHits.at45s + stat.thresholdHits.at120s + stat.thresholdHits.at300s) / stat.answeredCalls) * 100;
    return thresholdPct > (avgThresholdGaming * 1.5) || stat.stdDevDuration < (avgStdDev * 0.5);
  });
  
  if (suspiciousAgents.length === 0) {
    console.log('   ✅ No suspicious patterns detected');
  } else {
    suspiciousAgents.forEach(stat => {
      const thresholdPct = ((stat.thresholdHits.at45s + stat.thresholdHits.at120s + stat.thresholdHits.at300s) / stat.answeredCalls) * 100;
      console.log(`   • ${stat.agentEmail}:`);
      console.log(`     - Threshold gaming: ${thresholdPct.toFixed(1)}% (avg: ${avgThresholdGaming.toFixed(1)}%)`);
      console.log(`     - Call variation: ${stat.stdDevDuration.toFixed(1)}s std dev (avg: ${avgStdDev.toFixed(1)}s)`);
      console.log(`     - At 45s: ${stat.thresholdHits.at45s} calls (${(stat.thresholdHits.at45s / stat.answeredCalls * 100).toFixed(1)}%)`);
      console.log(`     - At 120s: ${stat.thresholdHits.at120s} calls (${(stat.thresholdHits.at120s / stat.answeredCalls * 100).toFixed(1)}%)`);
    });
  }
  
  console.log('\n📚 INDUSTRY STANDARDS (for reference):');
  console.log('   • Insurance Sales Average Call Duration: ~516 seconds (8.6 minutes)');
  console.log('   • Service Calls Average: ~426 seconds (7.1 minutes)');
  console.log('   • Anomaly Detection: Typically use 1-2 standard deviations from mean');
  console.log('   • Fraud Detection: Look for patterns, not just outliers');
}

async function main() {
  console.log('🔍 CALL PATTERN ANALYSIS');
  console.log('='.repeat(80));
  console.log(`Analyzing data from last ${days} days${specificAgent ? ` for agent: ${specificAgent}` : ' (all agents)'}`);
  console.log('='.repeat(80) + '\n');
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const allCalls = await fetchCallData();
  
  if (allCalls.length === 0) {
    console.log('❌ No call data found');
    return;
  }
  
  console.log(`\n✅ Total calls fetched: ${allCalls.length.toLocaleString()}\n`);
  
  // Group by agent
  const callsByAgent = new Map<string, CallData[]>();
  allCalls.forEach(call => {
    const email = call.agent_email.toLowerCase();
    if (!callsByAgent.has(email)) {
      callsByAgent.set(email, []);
    }
    callsByAgent.get(email)!.push(call);
  });
  
  console.log(`📊 Analyzing ${callsByAgent.size} agents...\n`);
  
  const agentStats: AgentStats[] = [];
  
  for (const [agentEmail, calls] of callsByAgent.entries()) {
    const stats = await analyzeAgent(agentEmail, calls, startDate);
    agentStats.push(stats);
    
    // Show top agents with most calls
    if (callsByAgent.size <= 10 || stats.totalCalls > 100) {
      console.log(`   ${agentEmail}:`);
      console.log(`      Calls: ${stats.totalCalls} (${stats.answeredCalls} answered)`);
      console.log(`      Avg Duration: ${stats.meanDuration.toFixed(1)}s (std dev: ${stats.stdDevDuration.toFixed(1)}s)`);
      console.log(`      Threshold Hits: 45s=${stats.thresholdHits.at45s}, 120s=${stats.thresholdHits.at120s}, 300s=${stats.thresholdHits.at300s}`);
      if (stats.dispositionTimings.length > 0) {
        const avgTiming = stats.dispositionTimings.reduce((a, b) => a + b, 0) / stats.dispositionTimings.length;
        console.log(`      Avg Disposition Timing: ${avgTiming.toFixed(1)}s`);
      }
      console.log('');
    }
  }
  
  generateRecommendations(agentStats);
  
  console.log('\n✅ Analysis complete!\n');
}

main().catch(console.error);
