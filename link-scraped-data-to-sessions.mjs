import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔗 Linking scraped data to presentation sessions via UUID...\n');

// Get all presentation sessions with electron_session_id
const { data: sessions } = await supabase
  .from('presentation_sessions')
  .select('id, electron_session_id')
  .not('electron_session_id', 'is', null);

console.log(`Found ${sessions?.length} sessions with electron_session_id\n`);

let updated = 0;

for (const session of sessions || []) {
  // Update all scraped_presentation_data records to use the UUID instead
  const { count, error } = await supabase
    .from('scraped_presentation_data')
    .update({ session_id: session.id }) // Update to use UUID
    .eq('session_id', session.electron_session_id); // Where it matches electron ID

  if (error) {
    console.log(`❌ Error updating ${session.electron_session_id}:`, error.message);
  } else if (count > 0) {
    console.log(`✅ Updated ${count} scraped records: ${session.electron_session_id} → ${session.id}`);
    updated += count;
  }
}

console.log(`\n✅ Complete! Updated ${updated} scraped data records to use session UUIDs`);

