const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function generateMissingUrls() {
  console.log('\n🔗 GENERATING MISSING SIGNED URLS\n');
  console.log('============================================================');
  
  // Get all screenshots without URLs
  const { data: screenshots, error } = await supabase
    .from('presentation_screenshots')
    .select('*')
    .is('screenshot_url', null)
    .not('file_path', 'is', null);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`📸 Found ${screenshots.length} screenshots without URLs\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const screenshot of screenshots) {
    try {
      // Generate signed URL (1 year expiry)
      const { data: urlData, error: urlError } = await supabase.storage
        .from('verify_agent_screenshot')
        .createSignedUrl(screenshot.file_path, 31536000);
      
      if (urlError || !urlData) {
        console.log(`❌ Failed to create URL for: ${screenshot.file_path}`);
        failCount++;
        continue;
      }
      
      // Update the screenshot record
      const { error: updateError } = await supabase
        .from('presentation_screenshots')
        .update({ screenshot_url: urlData.signedUrl })
        .eq('id', screenshot.id);
      
      if (updateError) {
        console.log(`❌ Failed to update: ${screenshot.id}`);
        failCount++;
      } else {
        successCount++;
        process.stdout.write(`✅ [${successCount + failCount}/${screenshots.length}]\r`);
      }
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      failCount++;
    }
  }
  
  console.log(`\n\n📊 RESULTS:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
}

generateMissingUrls().catch(console.error);

