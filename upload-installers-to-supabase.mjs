import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase config
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inljeno3amV0eHdwZmd0cnpleXl0dCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3MjYxNjk0ODEsImV4cCI6MjA0MTc0NTQ4MX0.0z1Zdt2z2YNmLMYK1qvZ7UkS5QO3pFwipg7WYIobGt0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadInstaller(filePath, fileName) {
  try {
    console.log(`📤 Uploading ${fileName}...`);
    
    const fileBuffer = fs.readFileSync(filePath);
    const fileSize = (fileBuffer.length / (1024 * 1024)).toFixed(2);
    console.log(`   File size: ${fileSize} MB`);
    
    // Upload to Supabase storage in 'installers' bucket
    const { data, error } = await supabase.storage
      .from('installers')
      .upload(fileName, fileBuffer, {
        contentType: 'application/x-msdownload',
        upsert: true
      });

    if (error) {
      console.error(`❌ Error uploading ${fileName}:`, error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('installers')
      .getPublicUrl(fileName);

    console.log(`✅ Uploaded: ${fileName}`);
    console.log(`   URL: ${urlData.publicUrl}`);
    return urlData.publicUrl;

  } catch (error) {
    console.error(`❌ Failed to upload ${fileName}:`, error);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting installer upload to Supabase...\n');

  // Check if installers bucket exists, create if not
  const { data: buckets } = await supabase.storage.listBuckets();
  const installersBucket = buckets?.find(b => b.name === 'installers');
  
  if (!installersBucket) {
    console.log('📦 Creating "installers" bucket...');
    const { error } = await supabase.storage.createBucket('installers', {
      public: true,
      fileSizeLimit: 200 * 1024 * 1024 // 200 MB
    });
    if (error) {
      console.error('❌ Failed to create bucket:', error);
      return;
    }
    console.log('✅ Bucket created\n');
  }

  const installers = [
    {
      path: path.join(__dirname, 'electron-dist', 'AOIntelligence-Setup-1.0.3.exe'),
      name: 'ConnectNow-Setup.exe'
    },
    {
      path: path.join(__dirname, 'electron-dist', 'AO Intelligence 1.0.3.exe'),
      name: 'ConnectNow.exe'
    }
  ];

  const urls = {};

  for (const installer of installers) {
    if (fs.existsSync(installer.path)) {
      const url = await uploadInstaller(installer.path, installer.name);
      if (url) {
        urls[installer.name] = url;
      }
    } else {
      console.log(`⚠️  File not found: ${installer.path}`);
    }
  }

  console.log('\n📋 Upload Summary:');
  console.log('═══════════════════════════════════════════');
  Object.entries(urls).forEach(([name, url]) => {
    console.log(`\n${name}:`);
    console.log(`  ${url}`);
  });
  
  console.log('\n✅ All installers uploaded to Supabase!');
  console.log('\n📝 Update your Downloads.tsx with these URLs');
}

main().catch(console.error);

