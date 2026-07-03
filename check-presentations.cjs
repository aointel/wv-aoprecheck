const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkPresentations() {
  console.log('\n📊 CHECKING PRESENTATION DATA\n');
  console.log('='.repeat(60));

  const agents = [
    'patriciasantamarina@aoglobelife.com',
    'tabithamcdermid@aoglobelife.com',
    'dylanwhite@aoglobelife.com',
    'jacobvaldellon@aoglobelife.com',
    'chrislafond@aoglobelife.com'
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const email of agents) {
    console.log(`\n👤 ${email.split('@')[0]}:`);
    
    const { data, error, count } = await supabase
      .from('presentation_sessions')
      .select('*', { count: 'exact' })
      .eq('agent_email', email)
      .gte('started_at', today.toISOString());

    if (error) {
      console.error('  ❌ Error:', error);
      continue;
    }

    console.log(`  📊 Presentations Today: ${count || 0}`);
    
    if (data && data.length > 0) {
      console.log(`  ✅ YES - Has ${data.length} presentation records:`);
      data.forEach((pres, i) => {
        console.log(`     ${i+1}. ID: ${pres.id} | Started: ${new Date(pres.started_at).toLocaleString()} | Type: ${pres.presentation_type || 'N/A'}`);
      });
    } else {
      console.log(`  ❌ NO DATA - Count shows ${count} but no records returned`);
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

checkPresentations().then(() => process.exit(0));

