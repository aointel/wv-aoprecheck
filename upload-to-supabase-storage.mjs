import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase config from hardcoded-config.ts
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function uploadToSupabase() {
  const filePath = path.join(__dirname, 'electron-dist', 'AO Intelligence 1.0.3.exe');
  const fileName = 'ConnectNow.exe';
  
  console.log('📤 Uploading to Supabase Storage...');
  console.log(`   File: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ File not found!');
    return;
  }
  
  const fileSize = fs.statSync(filePath).size;
  console.log(`   Size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);
  console.log('');
  
  // Read file
  const fileBuffer = fs.readFileSync(filePath);
  
  // Check if 'installers' bucket exists, create if not
  console.log('📦 Checking for installers bucket...');
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error('❌ Error listing buckets:', listError);
    return;
  }
  
  const installersBucket = buckets?.find(b => b.name === 'installers');
  
  if (!installersBucket) {
    console.log('📦 Creating installers bucket...');
    const { error: createError } = await supabase.storage.createBucket('installers', {
      public: true,
      fileSizeLimit: 200 * 1024 * 1024 // 200 MB limit
    });
    
    if (createError) {
      console.error('❌ Error creating bucket:', createError);
      return;
    }
    console.log('✅ Bucket created');
  } else {
    console.log('✅ Bucket exists');
  }
  
  console.log('');
  console.log('⬆️  Uploading file...');
  
  // Upload file
  const { data, error } = await supabase.storage
    .from('installers')
    .upload(fileName, fileBuffer, {
      contentType: 'application/octet-stream',
      upsert: true
    });
  
  if (error) {
    console.error('❌ Upload failed:', error);
    return;
  }
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('installers')
    .getPublicUrl(fileName);
  
  console.log('');
  console.log('✅ Upload successful!');
  console.log('');
  console.log('📥 Public URL:');
  console.log(`   ${urlData.publicUrl}`);
  console.log('');
  console.log('📋 Update Downloads.tsx:');
  console.log(`   const downloadUrl = '${urlData.publicUrl}';`);
}

uploadToSupabase().catch(console.error);

