import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

console.log('\n📦 Creating meet-recordings storage bucket...\n');

// Check if bucket exists
const { data: buckets } = await supabase.storage.listBuckets();
const exists = buckets?.find(b => b.name === 'meet-recordings');

if (exists) {
  console.log('✅ Bucket already exists');
  process.exit(0);
}

// Create bucket
const { data, error } = await supabase.storage.createBucket('meet-recordings', {
  public: false, // Private - only accessible with signed URLs
  fileSizeLimit: 500 * 1024 * 1024, // 500 MB per recording
  allowedMimeTypes: ['video/mp4', 'video/webm', 'audio/mp3', 'audio/wav']
});

if (error) {
  console.error('❌ Failed to create bucket:', error);
  process.exit(1);
}

console.log('✅ Bucket created successfully!');
console.log('\n📋 Bucket configuration:');
console.log('   Name: meet-recordings');
console.log('   Public: false (private - signed URLs only)');
console.log('   Size limit: 500 MB per file');
console.log('   Allowed types: MP4, WebM, MP3, WAV');
console.log();

