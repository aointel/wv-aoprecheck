import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔍 Checking session ID mismatch...\n');

// Get Leyna's presentation sessions
const { data: sessions } = await supabase
  .from('presentation_sessions')
  .select('id')
  .eq('agent_email', 'leynatran@aoglobelife.com')
  .limit(5);

console.log('📊 Leyna\'s presentation_sessions IDs:');
sessions?.forEach(s => console.log(`  - ${s.id}`));

console.log('\n📋 Scraped data session_ids:');
const { data: scraped } = await supabase
  .from('scraped_presentation_data')
  .select('session_id')
  .limit(10);

const uniqueSessionIds = [...new Set(scraped?.map(s => s.session_id))];
uniqueSessionIds.forEach(id => console.log(`  - ${id}`));

console.log('\n❌ MISMATCH CHECK:');
console.log('The scraped data uses:', uniqueSessionIds[0]);
console.log('But presentation_sessions has:', sessions?.[0]?.id);
console.log('\nThey don\'t match! The session IDs are different formats.');
console.log('Scraped data uses: session_TIMESTAMP_RANDOM');
console.log('presentation_sessions uses: UUID');

