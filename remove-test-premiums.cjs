/**
 * Remove verification sessions with test premium values
 * Removes: 100.00, 100, 123.00, 123
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function removeTestPremiums() {
  console.log('\n🗑️  REMOVING TEST PREMIUM VERIFICATION SESSIONS\n');
  console.log('='.repeat(60));

  const testPremiums = ['100.00', '100', '123.00', '123'];

  try {
    // First, preview what will be deleted
    console.log('\n🔍 PREVIEW: Sessions that will be deleted:\n');
    
    const { data: previewSessions, error: previewError } = await supabase
      .from('verification_sessions')
      .select('*')
      .in('premium', testPremiums);

    if (previewError) {
      console.error('❌ Error fetching preview:', previewError);
      return;
    }

    if (!previewSessions || previewSessions.length === 0) {
      console.log('✅ No test premium sessions found!');
      return;
    }

    console.log(`Found ${previewSessions.length} sessions with test premiums:\n`);
    
    const byPremium = {};
    previewSessions.forEach(session => {
      const prem = session.premium;
      if (!byPremium[prem]) {
        byPremium[prem] = [];
      }
      byPremium[prem].push(session);
    });

    Object.entries(byPremium).forEach(([premium, sessions]) => {
      console.log(`\n💰 Premium: $${premium}`);
      console.log(`   Count: ${sessions.length} sessions`);
      sessions.slice(0, 5).forEach(s => {
        console.log(`     - ID: ${s.id}, Phone: ${s.phone}, Agent: ${s.agent_email}, Created: ${new Date(s.created_at).toLocaleDateString()}`);
      });
      if (sessions.length > 5) {
        console.log(`     ... and ${sessions.length - 5} more`);
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('\n⚠️  READY TO DELETE:');
    console.log(`   Total sessions to delete: ${previewSessions.length}`);
    console.log(`   Premium values: ${testPremiums.join(', ')}`);
    console.log('\n🗑️  Proceeding with deletion in 3 seconds...');
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Delete sessions
    console.log('\n🗑️  Deleting sessions...\n');
    
    const { data: deleted, error: deleteError } = await supabase
      .from('verification_sessions')
      .delete()
      .in('premium', testPremiums)
      .select();

    if (deleteError) {
      console.error('❌ Delete error:', deleteError);
      return;
    }

    console.log(`\n✅ DELETED ${deleted?.length || 0} sessions with test premiums!`);
    console.log('\n📊 Breakdown by premium:');
    
    const deletedByPremium = {};
    (deleted || []).forEach(session => {
      const prem = session.premium;
      deletedByPremium[prem] = (deletedByPremium[prem] || 0) + 1;
    });

    Object.entries(deletedByPremium).forEach(([premium, count]) => {
      console.log(`   $${premium}: ${count} deleted`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 Test premium sessions removed!\n');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

removeTestPremiums()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

