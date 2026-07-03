const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function fixEmails() {
  console.log('🧹 Cleaning up cn_email whitespace in masterlead table...\n');
  
  // Get all leads with non-null cn_email
  const { data: leads, error } = await supabase
    .from('masterlead')
    .select('id, cn_email')
    .not('cn_email', 'is', null);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`📊 Found ${leads.length} leads with cn_email set`);
  
  let fixedCount = 0;
  let alreadyCleanCount = 0;
  
  for (const lead of leads) {
    const originalEmail = lead.cn_email;
    const trimmedEmail = originalEmail?.trim();
    
    if (originalEmail !== trimmedEmail) {
      // Update the email
      const { error: updateError } = await supabase
        .from('masterlead')
        .update({ cn_email: trimmedEmail })
        .eq('id', lead.id);
      
      if (updateError) {
        console.error(`❌ Failed to update lead ${lead.id}:`, updateError.message);
      } else {
        fixedCount++;
        if (fixedCount <= 5) {
          console.log(`✅ Fixed lead ${lead.id}: "${originalEmail}" → "${trimmedEmail}"`);
        }
      }
    } else {
      alreadyCleanCount++;
    }
  }
  
  console.log('\n📊 CLEANUP COMPLETE:');
  console.log(`   Fixed: ${fixedCount}`);
  console.log(`   Already clean: ${alreadyCleanCount}`);
  console.log(`   Total: ${leads.length}`);
}

fixEmails();

