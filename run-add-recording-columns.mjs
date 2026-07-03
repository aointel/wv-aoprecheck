import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

console.log('\n🔧 Adding recording columns to meets table...\n');

const sql = fs.readFileSync('add-recording-columns-to-meets.sql', 'utf8');
const statements = sql.split(';').filter(s => s.trim().length > 0);

for (const statement of statements) {
  const trimmed = statement.trim();
  if (!trimmed || trimmed.startsWith('--') || trimmed.startsWith('COMMENT')) continue;
  
  console.log(`Executing: ${trimmed.substring(0, 60)}...`);
  
  // Use raw SQL execution
  const { error } = await supabase.rpc('exec_raw_sql', { sql: trimmed });
  
  if (error) {
    console.error('❌ Error:', error.message);
  } else {
    console.log('✅ Success');
  }
}

console.log('\n✅ Recording columns added to meets table!\n');

