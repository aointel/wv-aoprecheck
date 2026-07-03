/**
 * Find duplicate leads by taalk_lead_id (DO NOT DELETE - ANALYSIS ONLY)
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function findDuplicateLeads() {
  console.log('\n🔍 FINDING DUPLICATE LEADS BY taalk_lead_id\n');
  console.log('='.repeat(60));

  try {
    // Get all leads
    console.log('📊 Fetching all masterlead records...\n');
    
    const { data: allLeads, error } = await supabase
      .from('masterlead')
      .select('id, taalk_lead_id, first_name, last_name, phone, taalk_secretkey, created_at, cn_email')
      .not('taalk_lead_id', 'is', null)
      .order('taalk_lead_id', { ascending: true });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log(`✅ Found ${allLeads.length} leads with taalk_lead_id\n`);

    // Group by taalk_lead_id
    const leadGroups = new Map();
    
    allLeads.forEach(lead => {
      const leadId = lead.taalk_lead_id;
      if (!leadGroups.has(leadId)) {
        leadGroups.set(leadId, []);
      }
      leadGroups.get(leadId).push(lead);
    });

    // Find duplicates
    const duplicates = Array.from(leadGroups.entries())
      .filter(([_, leads]) => leads.length > 1)
      .map(([leadId, leads]) => ({ leadId, leads }));

    console.log(`🔍 Found ${duplicates.length} duplicate taalk_lead_id values\n`);
    console.log('='.repeat(60));

    if (duplicates.length === 0) {
      console.log('\n✅ No duplicates found!');
      return;
    }

    // Analyze duplicates
    let totalDuplicateRecords = 0;
    let recordsToKeep = 0;
    let recordsToDelete = 0;
    let cantDecide = 0;

    duplicates.forEach(({ leadId, leads }) => {
      totalDuplicateRecords += leads.length;
      
      // Count how many have secret keys
      const withKey = leads.filter(l => l.taalk_secretkey !== null && l.taalk_secretkey !== '');
      const withoutKey = leads.filter(l => l.taalk_secretkey === null || l.taalk_secretkey === '');

      console.log(`\n📋 taalk_lead_id: ${leadId} (${leads.length} records)`);
      console.log(`   Name: ${leads[0].first_name} ${leads[0].last_name}`);
      console.log(`   Phone: ${leads[0].phone}`);
      
      leads.forEach((lead, idx) => {
        const hasKey = lead.taalk_secretkey !== null && lead.taalk_secretkey !== '';
        const keyDisplay = hasKey ? `"${lead.taalk_secretkey}"` : 'NULL';
        const action = hasKey ? '✅ KEEP' : '❌ DELETE';
        console.log(`   ${idx + 1}. DB ID: ${lead.id}, Key: ${keyDisplay}, Created: ${lead.created_at?.substring(0, 10)}, Agent: ${lead.cn_email || 'unassigned'} → ${action}`);
      });

      // Decide action
      if (withKey.length === 1 && withoutKey.length > 0) {
        // Perfect: 1 with key, rest without - KEEP the one with key
        recordsToKeep += 1;
        recordsToDelete += withoutKey.length;
        console.log(`   ✅ ACTION: Keep ID ${withKey[0].id}, delete ${withoutKey.length} record(s)`);
      } else if (withKey.length > 1) {
        // Multiple with keys - need to decide which to keep (keep newest?)
        recordsToKeep += 1;
        recordsToDelete += leads.length - 1;
        cantDecide++;
        console.log(`   ⚠️ CONFLICT: ${withKey.length} have secret keys - need manual review`);
      } else if (withoutKey.length === leads.length) {
        // All have NULL keys - keep newest
        recordsToKeep += 1;
        recordsToDelete += leads.length - 1;
        console.log(`   ⚠️ ALL NULL: Keep newest (ID ${leads.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].id}), delete ${leads.length - 1}`);
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 DUPLICATE ANALYSIS SUMMARY:\n`);
    console.log(`   Total Duplicate Sets: ${duplicates.length}`);
    console.log(`   Total Duplicate Records: ${totalDuplicateRecords}`);
    console.log(`   Records to KEEP: ${recordsToKeep}`);
    console.log(`   Records to DELETE: ${recordsToDelete}`);
    console.log(`   Conflicts needing review: ${cantDecide}`);
    console.log(`\n⚠️ NO DELETIONS PERFORMED - ANALYSIS ONLY\n`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

findDuplicateLeads()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

