/* eslint-disable no-console */
/**
 * Upload Mac and Windows installers to Supabase Storage
 * 
 * Usage: node scripts/upload-installers-to-supabase.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BUCKET_NAME = 'installers';

async function uploadFile(filePath, fileName) {
  try {
    console.log(`📤 Uploading ${fileName}...`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      return false;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileStats = fs.statSync(filePath);
    const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`   Size: ${fileSizeMB} MB`);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, fileBuffer, {
        contentType: fileName.endsWith('.dmg') ? 'application/x-apple-diskimage' :
                     fileName.endsWith('.zip') ? 'application/zip' :
                     fileName.endsWith('.exe') ? 'application/x-msdownload' :
                     'application/octet-stream',
        upsert: true, // Overwrite if exists
      });

    if (error) {
      console.error(`❌ Upload failed for ${fileName}:`, error.message);
      return false;
    }

    // Make file public
    const { error: publicError } = await supabase.storage
      .from(BUCKET_NAME)
      .updatePublicAccess(fileName, { public: true });

    if (publicError) {
      console.warn(`⚠️ Failed to make ${fileName} public:`, publicError.message);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    console.log(`✅ Uploaded: ${fileName}`);
    console.log(`   Public URL: ${urlData.publicUrl}`);
    return true;
  } catch (error) {
    console.error(`❌ Error uploading ${fileName}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting installer upload to Supabase Storage...\n');

  const installers = [
    // Mac installers
    {
      localPath: path.join(__dirname, '../electron-dist/AO Intelligence-1.0.4.dmg'),
      fileName: 'AO-Intelligence-1.0.4-mac-intel.dmg',
      description: 'Mac Intel (x64) DMG'
    },
    {
      localPath: path.join(__dirname, '../electron-dist/AO Intelligence-1.0.4-arm64.dmg'),
      fileName: 'AO-Intelligence-1.0.4-mac-arm64.dmg',
      description: 'Mac Apple Silicon (arm64) DMG'
    },
    {
      localPath: path.join(__dirname, '../electron-dist/AO Intelligence-1.0.4-mac.zip'),
      fileName: 'AO-Intelligence-1.0.4-mac-intel.zip',
      description: 'Mac Intel (x64) ZIP'
    },
    {
      localPath: path.join(__dirname, '../electron-dist/AO Intelligence-1.0.4-arm64-mac.zip'),
      fileName: 'AO-Intelligence-1.0.4-mac-arm64.zip',
      description: 'Mac Apple Silicon (arm64) ZIP'
    },
    // Windows installers (if they exist)
    {
      localPath: path.join(__dirname, '../electron-dist/AO Intelligence-1.0.4.exe'),
      fileName: 'AO-Intelligence-1.0.4-windows.exe',
      description: 'Windows Installer',
      optional: true
    },
  ];

  let successCount = 0;
  let failCount = 0;

  for (const installer of installers) {
    if (installer.optional && !fs.existsSync(installer.localPath)) {
      console.log(`⏭️  Skipping optional: ${installer.description}`);
      continue;
    }

    const success = await uploadFile(installer.localPath, installer.fileName);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    console.log(''); // Blank line between uploads
  }

  console.log('📊 Upload Summary:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);

  if (failCount === 0) {
    console.log('\n🎉 All installers uploaded successfully!');
  } else {
    console.log('\n⚠️  Some uploads failed. Check errors above.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

