import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔍 Matching scraped data session IDs to presentation session UUIDs...\n');

// Get the 3 sessions we created from scraped data
const sessionsWithScrapedData = [
  { electronId: 'session_1761428935414_58d3y3a7c', agent: 'leynatran@aoglobelife.com' },
  { electronId: 'session_1761440606476_lsdsbql0l', agent: 'leynatran@aoglobelife.com' },
  { electronId: 'session_1761450648520_v9c799qvv', agent: 'diankablash@aoglobelife.com' }
];

for (const { electronId, agent } of sessionsWithScrapedData) {
  // Find the presentation_session with this electron_session_id
  const { data: session } = await supabase
    .from('presentation_sessions')
    .select('id, electron_session_id')
    .eq('electron_session_id', electronId)
    .single();

  if (!session) {
    console.log(`❌ No session found for ${electronId}`);
    continue;
  }

  console.log(`\nSession: ${electronId}`);
  console.log(`  UUID: ${session.id}`);

  // Update scraped_presentation_data to use the UUID
  const { count, error } = await supabase
    .from('scraped_presentation_data')
    .update({ session_id: session.id })
    .eq('session_id', electronId);

  if (error) {
    console.log(`  ❌ Error: ${error.message}`);
  } else {
    console.log(`  ✅ Updated ${count} scraped records to use UUID`);
  }
}

console.log('\n✅ All scraped data now linked to session UUIDs!');

