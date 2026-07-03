import { createClient } from '@supabase/supabase-js';
import { HARDCODED_CONFIG } from './server/hardcoded-config';

const supabaseUrl = HARDCODED_CONFIG.SUPABASE_URL;
const supabaseKey = HARDCODED_CONFIG.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface DispositionRecord {
  id: number;
  agent_email: string;
  agent_name: string;
  lead_id: number | null;
  lead_phone: string;
  disposition: string;
  event_timestamp: string;
}

interface AgentViolation {
  agent_email: string;
  agent_name: string;
  violations: {
    type: string;
    count: number;
    details: string[];
  }[];
  totalViolations: number;
}

async function findDispositionAbusers() {
  console.log('🔍 Finding agents abusing the disposition system...\n');
  
  const excludedDispositions = ['no_answer', 'no_answer_vm', 'called', 'wrong_number'];
  console.log(`⚠️ EXCLUDING: "${excludedDispositions.join('", "')}" dispositions from analysis\n`);

  // Get last 30 days of data to catch more abusers
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  console.log(`📅 Analyzing dispositions since: ${thirtyDaysAgo}\n`);

  // Fetch all relevant dispositions
  const { data: allDispositions, error } = await supabase
    .from('agent_dial_metrics')
    .select('id, agent_email, agent_name, lead_id, lead_phone, disposition, event_timestamp')
    .not('disposition', 'is', null)
    .gte('event_timestamp', thirtyDaysAgo)
    .order('agent_email', { ascending: true })
    .order('event_timestamp', { ascending: true });

  // Filter out excluded dispositions
  const dispositions = (allDispositions || []).filter(d => {
    const disp = d.disposition?.toLowerCase().trim();
    return disp && !excludedDispositions.includes(disp);
  });

  if (error) {
    console.error('❌ Error fetching dispositions:', error);
    process.exit(1);
  }

  if (!dispositions || dispositions.length === 0) {
    console.log('✅ No dispositions found matching criteria');
    return;
  }

  console.log(`📊 Analyzing ${dispositions.length} dispositions from ${new Set(dispositions.map(d => d.agent_email)).size} agents\n`);

  // Group by agent
  const agentMap = new Map<string, DispositionRecord[]>();
  for (const disp of dispositions) {
    const email = disp.agent_email?.toLowerCase().trim();
    if (!email) continue;
    
    if (!agentMap.has(email)) {
      agentMap.set(email, []);
    }
    agentMap.get(email)!.push(disp);
  }

  const violations: AgentViolation[] = [];

  // Check each agent for violations
  for (const [agentEmail, agentDispositions] of agentMap.entries()) {
    const agentViolations: AgentViolation['violations'] = [];
    
    // Sort by timestamp
    agentDispositions.sort((a, b) => 
      new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime()
    );

    // NOTE: Duplicate dispositions on same lead are excluded from violations
    // This allows agents to correct mistakes or update dispositions on the same lead

    // Check for rate limit violations (1 per minute)
    const minuteViolations: string[] = [];
    for (let i = 0; i < agentDispositions.length; i++) {
      const curr = agentDispositions[i];
      const currTime = new Date(curr.event_timestamp).getTime();
      const oneMinuteAgo = currTime - 60 * 1000;
      
      // Count dispositions in the last minute before this one
      const recentCount = agentDispositions.filter(d => {
        const dTime = new Date(d.event_timestamp).getTime();
        return dTime >= oneMinuteAgo && dTime < currTime;
      }).length;

      if (recentCount >= 1) {
        minuteViolations.push(
          `${new Date(curr.event_timestamp).toLocaleString()}: ${recentCount + 1} dispositions in 1 minute (max 1/min) - "${curr.disposition}" on lead ${curr.lead_id || curr.lead_phone}`
        );
      }
    }

    if (minuteViolations.length > 0) {
      agentViolations.push({
        type: 'Rate Limit Violations (1 per minute)',
        count: minuteViolations.length,
        details: minuteViolations.slice(0, 10) // Show first 10
      });
    }

    // Check for rate limit violations (10 per hour)
    const hourViolations: string[] = [];
    for (let i = 0; i < agentDispositions.length; i++) {
      const curr = agentDispositions[i];
      const currTime = new Date(curr.event_timestamp).getTime();
      const oneHourAgo = currTime - 60 * 60 * 1000;
      
      // Count dispositions in the last hour before this one
      const recentCount = agentDispositions.filter(d => {
        const dTime = new Date(d.event_timestamp).getTime();
        return dTime >= oneHourAgo && dTime < currTime;
      }).length;

      if (recentCount >= 10) {
        hourViolations.push(
          `${new Date(curr.event_timestamp).toLocaleString()}: ${recentCount + 1} dispositions in 1 hour (max 10/hour) - "${curr.disposition}" on lead ${curr.lead_id || curr.lead_phone}`
        );
      }
    }

    if (hourViolations.length > 0) {
      agentViolations.push({
        type: 'Rate Limit Violations (10 per hour)',
        count: hourViolations.length,
        details: hourViolations.slice(0, 10) // Show first 10
      });
    }

    // Only add agent if they have violations
    if (agentViolations.length > 0) {
      const totalViolations = agentViolations.reduce((sum, v) => sum + v.count, 0);
      violations.push({
        agent_email: agentEmail,
        agent_name: agentDispositions[0]?.agent_name || 'Unknown',
        violations: agentViolations,
        totalViolations
      });
    }
  }

  // Sort by total violations (most violations first)
  violations.sort((a, b) => b.totalViolations - a.totalViolations);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`🚨 FOUND ${violations.length} AGENTS WITH DISPOSITION VIOLATIONS`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (violations.length === 0) {
    console.log('✅ No violations found! All agents are following the rules.');
    return;
  }

  // Display violations
  for (let i = 0; i < violations.length; i++) {
    const agent = violations[i];
    console.log(`${i + 1}. ${agent.agent_name || 'Unknown'} (${agent.agent_email})`);
    console.log(`   Total Violations: ${agent.totalViolations}`);
    console.log(`   Total Dispositions Analyzed: ${agentMap.get(agent.agent_email)?.length || 0}`);
    
    for (const violation of agent.violations) {
      console.log(`\n   ⚠️  ${violation.type}: ${violation.count} violations`);
      if (violation.details.length > 0) {
        console.log(`      Examples:`);
        violation.details.forEach((detail, idx) => {
          console.log(`      ${idx + 1}. ${detail}`);
        });
        if (violation.details.length < violation.count) {
          console.log(`      ... and ${violation.count - violation.details.length} more`);
        }
      }
    }
    console.log('\n' + '─'.repeat(60) + '\n');
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total agents analyzed: ${agentMap.size}`);
  console.log(`Agents with violations: ${violations.length}`);
  console.log(`Total violations: ${violations.reduce((sum, v) => sum + v.totalViolations, 0)}`);
  console.log(`\nTop 10 worst offenders:`);
  violations.slice(0, 10).forEach((agent, idx) => {
    console.log(`  ${idx + 1}. ${agent.agent_email} - ${agent.totalViolations} violations`);
  });
}

findDispositionAbusers().catch(console.error);

