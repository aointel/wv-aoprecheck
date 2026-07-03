import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

console.log('\n📤 UPLOADING INSTALLER TO SUPABASE...\n');

const installerPath = path.join(process.cwd(), 'electron-dist', 'AOIntelligence-Setup-1.0.3.exe');

if (!fs.existsSync(installerPath)) {
  console.error('❌ Installer not found:', installerPath);
  process.exit(1);
}

const stats = fs.statSync(installerPath);
const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log('📦 File:', path.basename(installerPath));
console.log('📊 Size:', sizeInMB, 'MB');
console.log();

const fileBuffer = fs.readFileSync(installerPath);

console.log('☁️ Uploading to Supabase Storage...');

// Upload with proper name
const { data, error } = await supabase.storage
  .from('installers')
  .upload('ConnectNow-Setup.exe', fileBuffer, {
    contentType: 'application/x-msdownload',
    upsert: true
  });

if (error) {
  console.error('❌ Upload failed:', error);
  process.exit(1);
}

// Get public URL
const { data: urlData } = supabase.storage
  .from('installers')
  .getPublicUrl('ConnectNow-Setup.exe');

console.log('\n✅ UPLOAD COMPLETE!');
console.log('\n📋 PUBLIC URL:');
console.log(urlData.publicUrl);
console.log();
console.log('🔧 Update Downloads.tsx to use this URL');
console.log();

