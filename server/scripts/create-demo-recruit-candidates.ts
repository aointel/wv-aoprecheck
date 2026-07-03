import { supabaseAdmin } from '../supabase.js';

interface DemoCandidate {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  zipCode: string;
  status: string;
  position: string;
  experience: string;
  agentId: string;
  agentEmail: string;
  currentStageId: number;
  aiSummary: string;
  notes: string;
}

const demoCandidates: DemoCandidate[] = [
  {
    firstName: 'John',
    lastName: 'Smith',
    phone: '+15035551234',
    email: 'john.smith@example.com',
    city: 'Denver',
    state: 'CO',
    zipCode: '80202',
    status: 'new',
    position: 'Sales Agent',
    experience: '5 years insurance sales experience',
    agentId: '999',
    agentEmail: 'cnsysop@aoglobelife.com',
    currentStageId: 1,
    aiSummary: JSON.stringify([
      { key: "Background", value: "John has 5 years of experience in insurance sales, previously worked at State Farm. Strong communication skills and proven track record of meeting sales goals." },
      { key: "Interest Level", value: "High interest in joining the team. Currently exploring opportunities and looking for a company with good growth potential." },
      { key: "Availability", value: "Available to start within 2 weeks. Prefers full-time position with flexible scheduling." },
      { key: "Compensation Expectations", value: "Looking for base salary plus commission structure. Expects to earn $50k+ in first year." },
      { key: "Next Steps", value: "Follow up in 3 days to discuss interview scheduling. Send company overview and benefits package." }
    ]),
    notes: 'Demo candidate for testing Call Connector Pro (Recruit)'
  },
  {
    firstName: 'Sarah',
    lastName: 'Johnson',
    phone: '+15035552345',
    email: 'sarah.johnson@example.com',
    city: 'Phoenix',
    state: 'AZ',
    zipCode: '85001',
    status: 'new',
    position: 'Entry Level Sales',
    experience: 'Recent graduate, internship experience',
    agentId: '999',
    agentEmail: 'cnsysop@aoglobelife.com',
    currentStageId: 1,
    aiSummary: JSON.stringify([
      { key: "Background", value: "Recent college graduate with degree in Business Administration. Completed summer internship at local insurance agency. Eager to start career in sales." },
      { key: "Interest Level", value: "Very interested in entry-level opportunity. Enthusiastic about learning and growing within the company." },
      { key: "Availability", value: "Immediately available. Flexible with schedule and willing to work weekends if needed." },
      { key: "Compensation Expectations", value: "Open to entry-level compensation. Focused on learning and career development opportunities." },
      { key: "Next Steps", value: "Schedule phone interview to discuss training program and growth opportunities. Send application form." }
    ]),
    notes: 'Demo candidate for testing Call Connector Pro (Recruit)'
  },
  {
    firstName: 'Michael',
    lastName: 'Chen',
    phone: '+15035553456',
    email: 'michael.chen@example.com',
    city: 'Seattle',
    state: 'WA',
    zipCode: '98101',
    status: 'new',
    position: 'Sales Representative',
    experience: '10 years customer service, transitioning to sales',
    agentId: '999',
    agentEmail: 'cnsysop@aoglobelife.com',
    currentStageId: 1,
    aiSummary: JSON.stringify([
      { key: "Background", value: "10 years of customer service experience in retail and hospitality. Strong interpersonal skills and problem-solving abilities. Looking to transition into sales role." },
      { key: "Interest Level", value: "Moderate interest. Wants to learn more about commission structure and training program before making decision." },
      { key: "Availability", value: "Can start in 4 weeks after giving notice to current employer. Prefers daytime schedule." },
      { key: "Compensation Expectations", value: "Needs to maintain current income level ($45k). Interested in base + commission model." },
      { key: "Next Steps", value: "Send detailed compensation breakdown and training schedule. Schedule follow-up call in 1 week." }
    ]),
    notes: 'Demo candidate for testing Call Connector Pro (Recruit)'
  },
  {
    firstName: 'Emily',
    lastName: 'Rodriguez',
    phone: '+15035554567',
    email: 'emily.rodriguez@example.com',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
    status: 'new',
    position: 'Senior Sales Agent',
    experience: '8 years insurance industry experience',
    agentId: '999',
    agentEmail: 'cnsysop@aoglobelife.com',
    currentStageId: 1,
    aiSummary: JSON.stringify([
      { key: "Background", value: "8 years of experience in insurance sales, licensed in multiple states. Currently working at competitor but open to new opportunities. Strong referral network." },
      { key: "Interest Level", value: "High interest. Actively looking for better commission structure and support system. Quick decision maker." },
      { key: "Availability", value: "Can start immediately after contract negotiation. Prefers remote/hybrid work option." },
      { key: "Compensation Expectations", value: "Expects $70k+ first year with potential for $100k+. Interested in leadership opportunities." },
      { key: "Next Steps", value: "Schedule in-person interview this week. Prepare competitive offer package. Discuss team structure." }
    ]),
    notes: 'Demo candidate for testing Call Connector Pro (Recruit)'
  },
  {
    firstName: 'David',
    lastName: 'Thompson',
    phone: '+15035555678',
    email: 'david.thompson@example.com',
    city: 'Portland',
    state: 'OR',
    zipCode: '97201',
    status: 'new',
    position: 'Part-Time Sales',
    experience: 'Current full-time job, seeking side income',
    agentId: '999',
    agentEmail: 'cnsysop@aoglobelife.com',
    currentStageId: 1,
    aiSummary: JSON.stringify([
      { key: "Background", value: "Currently employed full-time in unrelated field. Looking for part-time sales opportunity to supplement income. Some customer service experience." },
      { key: "Interest Level", value: "Interested in part-time option only. Flexible with hours but prefers evenings and weekends." },
      { key: "Availability", value: "Available evenings after 6pm and weekends. Limited weekday availability due to current job." },
      { key: "Compensation Expectations", value: "Understands part-time rates. Mainly interested in commission-based structure." },
      { key: "Next Steps", value: "Confirm part-time position availability and commission structure. Schedule evening call to discuss details." }
    ]),
    notes: 'Demo candidate for testing Call Connector Pro (Recruit)'
  }
];

async function createDemoRecruitCandidates() {
  console.log('🚀 Creating demo recruit candidates for cnsysop@aoglobelife.com...\n');

  try {
    const createdCandidates: any[] = [];
    
    for (const candidate of demoCandidates) {
      console.log(`📝 Creating candidate: ${candidate.firstName} ${candidate.lastName} (${candidate.phone})`);
      
      // First, check if candidate already exists
      const { data: existing } = await supabaseAdmin
        .from('recruit_candidates')
        .select('id, phone')
        .eq('phone', candidate.phone)
        .eq('agent_email', candidate.agentEmail)
        .maybeSingle();
      
      if (existing) {
        console.log(`  ⚠️  Candidate already exists with ID ${existing.id}, skipping...`);
        continue;
      }
      
      // Insert into recruit_candidates
      const { data: newCandidate, error: insertError } = await supabaseAdmin
        .from('recruit_candidates')
        .insert({
          first_name: candidate.firstName,
          last_name: candidate.lastName,
          phone: candidate.phone,
          email: candidate.email,
          city: candidate.city,
          state: candidate.state,
          zip_code: candidate.zipCode,
          status: candidate.status,
          position: candidate.position,
          experience: candidate.experience,
          agent_id: candidate.agentId,
          agent_email: candidate.agentEmail,
          current_stage_id: candidate.currentStageId,
          ai_summary: candidate.aiSummary,
          notes: candidate.notes
        })
        .select()
        .single();
      
      if (insertError) {
        console.error(`  ❌ Error creating candidate:`, insertError);
        continue;
      }
      
      console.log(`  ✅ Created candidate with ID: ${newCandidate.id}`);
      createdCandidates.push(newCandidate);
      
      // Check if masterleadrecruit table exists before trying to insert
      try {
        // Insert into masterleadrecruit (if table exists)
        const { error: mlrError } = await supabaseAdmin
          .from('masterleadrecruit')
          .insert({
            candidate_id: newCandidate.id,
            first_name: candidate.firstName,
            last_name: candidate.lastName,
            phone: candidate.phone,
            email: candidate.email,
            city: candidate.city,
            state: candidate.state,
            zip: candidate.zipCode,
            cn_email: candidate.agentEmail,
            cnresolution: 'pending',
            assigned_date: new Date().toISOString(),
            market: 'aorecruit'
          });
        
        if (mlrError) {
          console.log(`  ⚠️  masterleadrecruit table may not exist yet (this is OK):`, mlrError.message);
        } else {
          console.log(`  ✅ Added to masterleadrecruit queue`);
        }
      } catch (mlrErr) {
        console.log(`  ⚠️  masterleadrecruit table may not exist yet (this is OK)`);
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`  ✅ Created: ${createdCandidates.length} candidates`);
    console.log(`  ⚠️  Skipped: ${demoCandidates.length - createdCandidates.length} (already exist)`);
    
    // Show final state
    console.log('\n📋 Created candidates:');
    createdCandidates.forEach(c => {
      console.log(`  - ${c.first_name} ${c.last_name} (ID: ${c.id}, Phone: ${c.phone})`);
    });
    
  } catch (error) {
    console.error('\n❌ Failed to create demo candidates:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('create-demo-recruit-candidates')) {
  createDemoRecruitCandidates()
    .then(() => {
      console.log('\n✅ Demo candidates creation completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Demo candidates creation failed:', error);
      process.exit(1);
    });
}

export { createDemoRecruitCandidates };
