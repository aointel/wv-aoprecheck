/**
 * Insert demo data into taalk_call_analytics
 * Pulls real billing_transactions (connects) from PST and generates realistic demo analytics
 */
import { supabaseAdmin } from './server/supabase';

// Helper to generate random number in range
function random(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// Helper to pick random item from array
function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate realistic scorecard results
function generateScorecard(overallScore: number) {
  const variance = 15; // Allow scores to vary by +/- 15 points from overall
  
  const disclosure = Math.max(0, Math.min(100, overallScore + random(-variance, variance)));
  const agendaBuyIn = Math.max(0, Math.min(100, overallScore + random(-variance, variance)));
  const objectionHandling = Math.max(0, Math.min(100, overallScore + random(-variance, variance)));
  const needsAssessment = Math.max(0, Math.min(100, overallScore + random(-variance, variance)));
  const nextSteps = Math.max(0, Math.min(100, overallScore + random(-variance, variance)));
  const closingAbility = Math.max(0, Math.min(100, overallScore + random(-variance, variance)));
  
  const avgScore = (disclosure + agendaBuyIn + objectionHandling + needsAssessment + nextSteps + closingAbility) / 6;
  
  const objections = objectionHandling < 70 ? randomItem([
    ['price'],
    ['timing'],
    ['price', 'timing'],
    ['competitor'],
    []
  ]) : [];
  
  return {
    disclosure: {
      score: Math.round(disclosure),
      notes: disclosure > 80 ? "Clear and professional disclosure delivered early in the call." : 
             disclosure > 60 ? "Disclosure mentioned but could be more prominent." : 
             "Disclosure was unclear or delivered too late in the conversation.",
      passed: disclosure >= 70
    },
    agendaBuyIn: {
      score: Math.round(agendaBuyIn),
      notes: agendaBuyIn > 80 ? "Excellent agenda setting with clear buy-in from client." :
             agendaBuyIn > 60 ? "Agenda was set but client engagement was moderate." :
             "Agenda was unclear or client did not fully buy into the structure.",
      passed: agendaBuyIn >= 70
    },
    objectionHandling: {
      score: Math.round(objectionHandling),
      notes: objectionHandling > 80 ? "Handled objections smoothly with empathy and solutions." :
             objectionHandling > 60 ? "Addressed objections but could have been more proactive." :
             "Struggled to address client concerns effectively.",
      objections: objections,
      passed: objectionHandling >= 70
    },
    needsAssessment: {
      score: Math.round(needsAssessment),
      notes: needsAssessment > 80 ? "Thorough needs assessment with excellent questioning." :
             needsAssessment > 60 ? "Basic needs identified but could dig deeper." :
             "Needs assessment was superficial or incomplete.",
      passed: needsAssessment >= 70
    },
    nextSteps: {
      score: Math.round(nextSteps),
      notes: nextSteps > 80 ? "Clear next steps with specific timeline and action items." :
             nextSteps > 60 ? "Next steps mentioned but could be more concrete." :
             "Next steps were vague or unclear.",
      clarity: nextSteps > 80 ? "CLEAR" : nextSteps > 60 ? "MODERATE" : "UNCLEAR"
    },
    closingAbility: {
      score: Math.round(closingAbility),
      notes: closingAbility > 80 ? "Strong closing with clear value proposition." :
             closingAbility > 60 ? "Attempted to close but could be more direct." :
             "Closing was weak or non-existent.",
      passed: closingAbility >= 70
    },
    overallScore: Math.round(avgScore * 100) / 100
  };
}

// Generate compliance flags
function generateComplianceFlags(scorecard: ReturnType<typeof generateScorecard>) {
  return {
    disclosureRecorded: scorecard.disclosure.passed,
    properIntroduction: scorecard.agendaBuyIn.passed,
    needsAssessed: scorecard.needsAssessment.passed,
    objectionsAddressed: scorecard.objectionHandling.passed,
    nextStepsSet: scorecard.nextSteps.clarity === "CLEAR",
    professionalTone: true // Assume professional tone for demo
  };
}

// Generate key moments
function generateKeyMoments(callOutcome: string) {
  const moments: Array<{ timestamp: string; description: string }> = [
    { timestamp: "0:05", description: "Agent introduces themselves and company" },
    { timestamp: "0:15", description: "Disclosure statement delivered" },
    { timestamp: "0:30", description: "Agenda set and client buy-in obtained" }
  ];
  
  if (callOutcome === 'SOLD' || callOutcome === 'CALLBACK') {
    moments.push(
      { timestamp: "2:15", description: "Needs assessment questions asked" },
      { timestamp: "3:45", description: "Value proposition presented" },
      { timestamp: "5:20", description: "Next steps clearly defined" }
    );
  } else if (callOutcome === 'OBJECTION') {
    moments.push(
      { timestamp: "2:30", description: "Client raises objection about pricing" },
      { timestamp: "3:10", description: "Agent attempts to address concern" }
    );
  }
  
  return moments;
}

// Generate demo analytics for a transaction
function generateAnalytics(transaction: any) {
  // Generate varied call scores (some good, some bad, some mediocre)
  const scoreRanges = [
    { min: 85, max: 95, weight: 0.2 }, // Great calls
    { min: 70, max: 84, weight: 0.4 }, // Good calls
    { min: 55, max: 69, weight: 0.3 }, // Mediocre calls
    { min: 40, max: 54, weight: 0.1 }  // Poor calls
  ];
  
  const rand = Math.random();
  let selectedRange;
  if (rand < 0.2) selectedRange = scoreRanges[0];
  else if (rand < 0.6) selectedRange = scoreRanges[1];
  else if (rand < 0.9) selectedRange = scoreRanges[2];
  else selectedRange = scoreRanges[3];
  
  const callScore = Math.round(random(selectedRange.min, selectedRange.max) * 100) / 100;
  const scorecard = generateScorecard(callScore);
  
  // Determine call outcome based on score
  let callOutcome: string, callOutcomeConfidence: number;
  if (callScore >= 85) {
    callOutcome = randomItem(['SOLD', 'CALLBACK']);
    callOutcomeConfidence = random(0.85, 0.95);
  } else if (callScore >= 70) {
    callOutcome = randomItem(['CALLBACK', 'THINK', 'SOLD']);
    callOutcomeConfidence = random(0.70, 0.85);
  } else if (callScore >= 55) {
    callOutcome = randomItem(['THINK', 'OBJECTION', 'CALLBACK']);
    callOutcomeConfidence = random(0.55, 0.70);
  } else {
    callOutcome = randomItem(['OBJECTION', 'NO_SHOW', 'OTHER']);
    callOutcomeConfidence = random(0.40, 0.55);
  }
  
  // Sentiment based on score
  const sentimentScore = (callScore / 100) * 2 - 1; // Convert 0-100 to -1 to 1
  const sentimentLabel = sentimentScore > 0.3 ? 'POSITIVE' : sentimentScore < -0.3 ? 'NEGATIVE' : 'NEUTRAL';
  
  // Agent talk time (should be around 40-60% ideally)
  const agentTalkTimePct = random(35, 70);
  const clientEngagementLevel = callScore > 75 ? 'HIGH' : callScore > 60 ? 'MEDIUM' : 'LOW';
  
  // Key topics
  const allTopics = ['retirement planning', 'investment options', 'tax benefits', 'healthcare costs', 'estate planning', 'income replacement'];
  const numTopics = Math.floor(random(2, 5));
  const keyTopics: string[] = [];
  for (let i = 0; i < numTopics; i++) {
    const topic = randomItem(allTopics);
    if (!keyTopics.includes(topic)) keyTopics.push(topic);
  }
  
  // Objections detected
  const objectionsDetected = scorecard.objectionHandling.objections || [];
  
  // Coaching notes
  const coachingNotes = callScore >= 80 
    ? "Excellent call execution. Continue building rapport and maintaining this level of professionalism."
    : callScore >= 70
    ? "Good overall performance. Focus on improving objection handling and setting clearer next steps."
    : callScore >= 60
    ? "Call had potential but needs improvement in needs assessment and closing techniques."
    : "Multiple areas need attention: disclosure clarity, objection handling, and next steps need significant improvement.";
  
  // Transcript (demo snippet)
  const transcriptSnippets = [
    "Agent: Hi, this is [Agent] calling from [Company]. How are you doing today?\nClient: I'm doing well, thanks.\nAgent: Great! I wanted to take a few minutes to discuss your retirement planning options...",
    "Agent: Good morning! This is [Agent]. I'm reaching out regarding your recent inquiry about our services.\nClient: Yes, I was interested in learning more.\nAgent: Perfect. Before we begin, I need to let you know that this call is being recorded for quality assurance...",
    "Agent: Hello, [Client Name]? This is [Agent] calling. Do you have a few minutes to chat?\nClient: Sure, what's this about?\nAgent: I'd like to discuss some financial planning opportunities that might be a good fit for your situation..."
  ];
  
  return {
    billing_transaction_id: transaction.id.toString(),
    agent_email: transaction.agent_email,
    call_date: transaction.transaction_date,
    taalk_call_id: `taalk_${transaction.id}_${Date.now()}`,
    recording_url: `https://recordings.taalk.com/call/${transaction.id}`,
    transcript: randomItem(transcriptSnippets),
    transcript_source: randomItem(['taalk_api', 'ai_transcription', 'manual']),
    ai_analysis: {
      summary: `Call analysis completed for transaction ${transaction.id}. Overall quality score: ${callScore}/100.`,
      strengths: callScore > 70 ? ["Clear communication", "Good rapport building"] : ["Attempted to engage client"],
      weaknesses: callScore < 70 ? ["Needs improvement in objection handling", "Next steps could be clearer"] : ["Minor areas for improvement"],
      recommendations: ["Continue building on strengths", "Practice objection handling scenarios"]
    },
    call_score: callScore,
    scorecard_results: scorecard,
    coaching_notes: coachingNotes,
    key_topics: keyTopics,
    objections_detected: objectionsDetected,
    sentiment_score: Math.round(sentimentScore * 100) / 100,
    sentiment_label: sentimentLabel,
    agent_talk_time_pct: Math.round(agentTalkTimePct * 100) / 100,
    client_engagement_level: clientEngagementLevel,
    call_outcome: callOutcome,
    call_outcome_confidence: Math.round(callOutcomeConfidence * 100) / 100,
    compliance_flags: generateComplianceFlags(scorecard),
    key_moments: generateKeyMoments(callOutcome),
    analyzed_at: new Date().toISOString(),
    analysis_model: randomItem(['gpt-4o-mini', 'gpt-4', 'gpt-4-turbo']),
    analysis_version: '1.0.0',
    analysis_status: 'completed'
  };
}

async function insertDemoAnalytics() {
  console.log('🚀 Starting demo analytics insertion...\n');
  
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not initialized');
    process.exit(1);
  }
  
  // Pull recent connect transactions from PST
  console.log('📊 Fetching billing_transactions (connects) from database...');
  const { data: transactions, error: txError } = await supabaseAdmin
    .from('billing_transactions')
    .select('id, transaction_id, agent_email, transaction_date, lead_name, lead_phone')
    .eq('transaction_type', 'connect')
    .eq('status', 'completed')
    .order('transaction_date', { ascending: false })
    .limit(50); // Get last 50 connects
  
  if (txError) {
    console.error('❌ Error fetching transactions:', txError);
    process.exit(1);
  }
  
  if (!transactions || transactions.length === 0) {
    console.log('⚠️ No connect transactions found. Cannot generate demo data.');
    process.exit(0);
  }
  
  console.log(`✅ Found ${transactions.length} connect transactions\n`);
  
  // Check which ones already have analytics
  console.log('🔍 Checking for existing analytics...');
  const { data: existing } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('billing_transaction_id');
  
  const existingIds = new Set(existing?.map(e => e.billing_transaction_id) || []);
  const transactionsToProcess = transactions.filter(t => !existingIds.has(t.id.toString()));
  
  console.log(`📋 ${transactionsToProcess.length} transactions need analytics (${transactions.length - transactionsToProcess.length} already have analytics)\n`);
  
  if (transactionsToProcess.length === 0) {
    console.log('✅ All transactions already have analytics. Done!');
    process.exit(0);
  }
  
  // Generate and insert analytics
  console.log('🎲 Generating demo analytics data...');
  const analyticsData = transactionsToProcess.map(tx => generateAnalytics(tx));
  
  console.log(`💾 Inserting ${analyticsData.length} analytics records...`);
  
  // Insert in batches of 10
  const batchSize = 10;
  let inserted = 0;
  let errors = 0;
  
  for (let i = 0; i < analyticsData.length; i += batchSize) {
    const batch = analyticsData.slice(i, i + batchSize);
    
    const { data, error } = await supabaseAdmin
      .from('taalk_call_analytics')
      .insert(batch)
      .select();
    
    if (error) {
      console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
      errors += batch.length;
    } else {
      inserted += data?.length || 0;
      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(analyticsData.length / batchSize)} (${inserted} total)`);
    }
  }
  
  console.log(`\n✨ Done! Inserted ${inserted} analytics records`);
  if (errors > 0) {
    console.log(`⚠️ ${errors} records failed to insert`);
  }
  
  // Show summary stats
  console.log('\n📊 Summary:');
  const scoreRanges = {
    excellent: analyticsData.filter(a => a.call_score >= 85).length,
    good: analyticsData.filter(a => a.call_score >= 70 && a.call_score < 85).length,
    mediocre: analyticsData.filter(a => a.call_score >= 55 && a.call_score < 70).length,
    poor: analyticsData.filter(a => a.call_score < 55).length
  };
  
  console.log(`   Excellent (85+): ${scoreRanges.excellent}`);
  console.log(`   Good (70-84): ${scoreRanges.good}`);
  console.log(`   Mediocre (55-69): ${scoreRanges.mediocre}`);
  console.log(`   Poor (<55): ${scoreRanges.poor}`);
  
  const outcomes: Record<string, number> = {};
  analyticsData.forEach(a => {
    outcomes[a.call_outcome] = (outcomes[a.call_outcome] || 0) + 1;
  });
  console.log('\n📈 Call Outcomes:');
  Object.entries(outcomes).forEach(([outcome, count]) => {
    console.log(`   ${outcome}: ${count}`);
  });
}

insertDemoAnalytics()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
