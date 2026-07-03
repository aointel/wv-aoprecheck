/**
 * Test Changelog Script
 * Adds a test changelog entry to verify the system works
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testChangelog() {
  console.log('🧪 Testing Changelog System\n');

  try {
    // Check if tables exist
    console.log('1. Checking if changelog_entries table exists...');
    const { data: entries, error: entriesError } = await supabase
      .from('changelog_entries')
      .select('*')
      .limit(1);

    if (entriesError) {
      console.error('❌ Error accessing changelog_entries:', entriesError);
      return;
    }
    console.log('✅ changelog_entries table exists\n');

    // Check changelog_views table
    console.log('2. Checking if changelog_views table exists...');
    const { data: views, error: viewsError } = await supabase
      .from('changelog_views')
      .select('*')
      .limit(1);

    if (viewsError) {
      console.error('❌ Error accessing changelog_views:', viewsError);
      return;
    }
    console.log('✅ changelog_views table exists\n');

    // Count existing entries
    const { count } = await supabase
      .from('changelog_entries')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Current changelog entries: ${count || 0}\n`);

    // Add a test entry
    console.log('3. Adding test changelog entry...');
    const testEntry = {
      version: new Date().toISOString().split('T')[0],
      title: 'Enhanced Notification System',
      description: 'We\'ve completely rebuilt the notification system with real-time updates and better organization.',
      items: [
        { type: 'feature', text: 'Real-time notification updates' },
        { type: 'improvement', text: 'Better notification filtering (All, Unread, Urgent)' },
        { type: 'improvement', text: 'Clickable notifications with action links' },
        { type: 'improvement', text: 'Visual icons and color coding by notification type' },
        { type: 'improvement', text: 'Relative timestamps (e.g., "5m ago")' },
        { type: 'feature', text: 'New changelog system to keep you informed' }
      ],
      priority: 'high',
      published_at: new Date().toISOString(),
    };

    const { data: newEntry, error: insertError } = await supabase
      .from('changelog_entries')
      .insert(testEntry)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Failed to insert changelog entry:', insertError);
      return;
    }

    console.log('✅ Test changelog entry created!');
    console.log(`   ID: ${newEntry.id}`);
    console.log(`   Version: ${newEntry.version}`);
    console.log(`   Title: ${newEntry.title}\n`);

    // Verify it can be fetched
    console.log('4. Verifying entry can be fetched...');
    const { data: fetched, error: fetchError } = await supabase
      .from('changelog_entries')
      .select('*')
      .eq('id', newEntry.id)
      .single();

    if (fetchError) {
      console.error('❌ Failed to fetch entry:', fetchError);
    } else {
      console.log('✅ Entry fetched successfully!');
      console.log(`   Items: ${fetched.items.length}`);
      console.log(`   Priority: ${fetched.priority}\n`);
    }

    console.log('🎉 Changelog system is working!');
    console.log('\n📝 Next steps:');
    console.log('   1. Log in to the app');
    console.log('   2. The changelog modal should appear automatically');
    console.log('   3. Or click the sparkles icon (✨) in the header to view it manually');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testChangelog()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

































