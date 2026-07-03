const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function testStorage() {
  console.log('🧪 Testing Supabase Storage upload...\n');
  
  // Create a test image
  const testData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  
  const fileName = `TEST-${Date.now()}.png`;
  
  console.log('📤 Uploading test file:', fileName);
  
  const { data, error } = await supabase.storage
    .from('verify_agent_screenshot')
    .upload(fileName, testData, {
      contentType: 'image/png',
      cacheControl: '3600',
      upsert: false
    });
  
  if (error) {
    console.error('❌ Upload failed:', error);
    console.error('   Error code:', error.statusCode);
    console.error('   Error message:', error.message);
  } else {
    console.log('✅ Upload successful!');
    console.log('   Path:', data.path);
    
    // Try to get signed URL
    const { data: urlData, error: urlError } = await supabase.storage
      .from('verify_agent_screenshot')
      .createSignedUrl(fileName, 31536000);
    
    if (urlError) {
      console.error('❌ Failed to create signed URL:', urlError);
    } else {
      console.log('✅ Signed URL created:', urlData.signedUrl);
    }
  }
}

testStorage().catch(console.error);

