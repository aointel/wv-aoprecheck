import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

console.log('\n🔍 CHECKING VERIFICATION TABLE STRUCTURE...\n');

// Get ANY verification record to see the structure
const { data: sample, error } = await supabase
  .from('verification_sessions')
  .select('*')
  .limit(5);

if (error) {
  console.error('❌ Error:', error.message);
  if (error.message.includes('does not exist')) {
    console.log('\n⚠️  Table might not exist. Let me check what tables DO exist...\n');
  }
  process.exit(1);
}

if (!sample || sample.length === 0) {
  console.log('❌ NO VERIFICATION RECORDS AT ALL\n');
  process.exit(0);
}

console.log(`✅ Found ${sample.length} verification records\n`);
console.log('Column names:', Object.keys(sample[0]));
console.log('\nSample record:\n');
console.log(JSON.stringify(sample[0], null, 2));

