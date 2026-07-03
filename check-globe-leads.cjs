/**
 * Check if Globe market leads exist and why they're not showing
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkGlobeLeads() {
  console.log('\n🔍 CHECKING GLOBE MARKET LEADS');
  console.log('═'.repeat(70));
  
  try {
    // Check total Globe market leads
    const { data: allGlobe, count: totalGlobe } = await supabase
      .from('masterlead')
      .select('*', { count: 'exact' })
      .ilike('taalk_market', '%globe%');
    
    console.log(`\n📊 Total Globe market leads: ${totalGlobe || 0}`);
    
    if (allGlobe && allGlobe.length > 0) {
      console.log(`\n📋 Sample Globe leads (first 5):`);
      allGlobe.slice(0, 5).forEach((lead, i) => {
        console.log(`  ${i + 1}. ${lead.first_name} ${lead.last_name}`);
        console.log(`     Market: ${lead.taalk_market}`);
        console.log(`     Resolution: ${lead.cnresolution || 'NULL'}`);
        console.log(`     Assigned to: ${lead.cn_email || 'NONE'}`);
        console.log(`     Phone: ${lead.phone}`);
        console.log('');
      });
    }
    
    // Check Globe leads with cnresolution=pending
    const { data: pendingGlobe, count: pendingCount } = await supabase
      .from('masterlead')
      .select('*', { count: 'exact' })
      .ilike('taalk_market', '%globe%')
      .eq('cnresolution', 'pending');
    
    console.log(`\n📊 Pending Globe leads (cnresolution='pending'): ${pendingCount || 0}`);
    
    if (pendingGlobe && pendingGlobe.length > 0) {
      console.log(`\n📋 Pending Globe leads by agent:`);
      const byAgent = pendingGlobe.reduce((acc, lead) => {
        const email = lead.cn_email || 'UNASSIGNED';
        if (!acc[email]) acc[email] = 0;
        acc[email]++;
        return acc;
      }, {});
      
      Object.entries(byAgent).forEach(([email, count]) => {
        console.log(`  ${email}: ${count} pending Globe leads`);
      });
    }
    
    // Check Globe leads with other cnresolutions
    const { data: otherResolutions } = await supabase
      .from('masterlead')
      .select('cnresolution', { count: 'exact' })
      .ilike('taalk_market', '%globe%')
      .not('cnresolution', 'eq', 'pending');
    
    if (otherResolutions && otherResolutions.length > 0) {
      console.log(`\n📊 Globe leads with other resolutions:`);
      const resolutionCounts = otherResolutions.reduce((acc, lead) => {
        const res = lead.cnresolution || 'NULL';
        if (!acc[res]) acc[res] = 0;
        acc[res]++;
        return acc;
      }, {});
      
      Object.entries(resolutionCounts).forEach(([resolution, count]) => {
        console.log(`  ${resolution}: ${count} leads`);
      });
    }
    
    console.log('\n' + '═'.repeat(70));
    console.log('✅ DIAGNOSIS COMPLETE');
    console.log('═'.repeat(70) + '\n');
    
    // Summary
    console.log('💡 SUMMARY:');
    console.log(`   Total Globe leads: ${totalGlobe || 0}`);
    console.log(`   Pending (callable): ${pendingCount || 0}`);
    console.log(`   Other statuses: ${(totalGlobe || 0) - (pendingCount || 0)}`);
    console.log('');
    console.log('🎯 For Globe leads to show in Call Connector Pro:');
    console.log('   1. cnresolution must be "pending"');
    console.log('   2. cn_email must match the agent email');
    console.log('');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

checkGlobeLeads();

