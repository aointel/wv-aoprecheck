/**
 * Check if Leyna exists in producers table
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkLeyna() {
  console.log('\n🔍 CHECKING IF LEYNA EXISTS IN PRODUCERS TABLE');
  console.log('═'.repeat(70));
  
  try {
    // Check for leynatran
    const { data: leyna, error } = await supabase
      .from('producers')
      .select('*')
      .eq('email', 'leynatran@aoglobelife.com');
    
    if (error) {
      console.error('❌ Query error:', error.message);
      return;
    }
    
    console.log(`\n📊 Query result: ${leyna.length} records found\n`);
    
    if (leyna.length === 0) {
      console.log('❌ LEYNA DOES NOT EXIST IN PRODUCERS TABLE!');
      console.log('   This is why associate_id returns 999!');
      console.log('   This is why WebRTC might fail!');
      console.log('\n💡 SOLUTION: Add Leyna to the producers table with:');
      console.log('   - email: leynatran@aoglobelife.com');
      console.log('   - associate_id: 117239 (or her real associate ID)');
      console.log('   - name: LEYNA TRAN');
      console.log('   - status: active');
      console.log('   - markets: [appropriate markets]');
      console.log('   - states: [appropriate states]');
    } else {
      console.log('✅ LEYNA EXISTS IN PRODUCERS TABLE');
      console.log('\nData:');
      leyna.forEach(record => {
        console.log(JSON.stringify(record, null, 2));
      });
    }
    
    // Also check for variations
    console.log('\n🔍 Checking for email variations...\n');
    
    const { data: variations } = await supabase
      .from('producers')
      .select('email, name, associate_id')
      .or('email.ilike.%leyna%,name.ilike.%leyna%,name.ilike.%tran%');
    
    if (variations && variations.length > 0) {
      console.log('📋 Found similar records:');
      variations.forEach(v => {
        console.log(`  ${v.name} - ${v.email} - Associate ID: ${v.associate_id}`);
      });
    } else {
      console.log('❌ No similar records found');
    }
    
    console.log('\n' + '═'.repeat(70) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

checkLeyna();

