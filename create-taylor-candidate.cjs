const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function createCandidate() {
  console.log('🆕 Creating test candidate for Taylor...');
  
  const candidateData = {
    first_name: 'Randall',
    last_name: 'Crews',
    phone: '5032018470',
    email: 'egonspangler@comcast.net',
    status: 'new',
    current_stage_id: 3, // Virtual Overview
    agent_id: '2233111',
    agent_email: 'taylorermis@aoglobelife.com',
    ai_summary: `Background: Randall is seeking a position in sales operations or as a purchasing flash buyer. He is interested in roles that offer flexibility to work from home and is open to opportunities with significant earning potential. However, he did not feel the insurance sales role at Globe Life was a fit for him.
Work From Home: Strongly prefers remote work
Earning Interest: High earning potential important
Leadership Ready: Some supervisory experience mentioned
Status: Interested but had concerns about insurance industry fit`,
    notes: 'AI Screening completed on 10/9/2025, 1:11:30 PM',
    source: 'AI Screening Call',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  const { data, error } = await supabase
    .from('recruit_candidates')
    .insert(candidateData)
    .select()
    .single();
  
  if (error) {
    console.error('❌ Error creating candidate:', error);
    return;
  }
  
  console.log('✅ Candidate created!');
  console.log('  ID:', data.id);
  console.log('  Name:', data.first_name, data.last_name);
  console.log('  Agent:', data.agent_email);
  console.log('\n🎯 Candidate should now appear in Taylor\'s dashboard!');
  console.log('   Refresh http://localhost:5000/dashboard/ao-recruit to see it.');
}

createCandidate();


