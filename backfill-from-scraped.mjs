import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔄 Backfilling presentation sessions from scraped data...\n');

// Get unique session IDs from scraped data
const { data: scrapedData } = await supabase
  .from('scraped_presentation_data')
  .select('session_id, created_at, scraped_data')
  .order('created_at', { ascending: true });

// Group by session_id
const sessions = {};
scrapedData?.forEach(record => {
  if (!sessions[record.session_id]) {
    sessions[record.session_id] = {
      electronSessionId: record.session_id,
      records: [],
      firstRecord: record,
      lastRecord: record
    };
  }
  sessions[record.session_id].records.push(record);
  sessions[record.session_id].lastRecord = record;
});

console.log(`📊 Found ${Object.keys(sessions).length} unique sessions\n`);

let created = 0;

for (const session of Object.values(sessions)) {
  const startTime = new Date(session.firstRecord.created_at);
  const endTime = new Date(session.lastRecord.created_at);
  const durationSeconds = Math.floor((endTime - startTime) / 1000);
  const url = session.firstRecord.scraped_data?.url || '';
  
  console.log(`Creating session: ${session.electronSessionId}`);
  console.log(`  - ${session.records.length} data points`);
  console.log(`  - Duration: ${durationSeconds}s`);
  
  const { error } = await supabase
    .from('presentation_sessions')
    .insert({
      electron_session_id: session.electronSessionId,
      agent_email: 'unknown@aoglobelife.com',
      agent_name: 'Unknown',
      presentation_url: url,
      presentation_type: url.includes('hppro') ? 'hppro' : 'other',
      started_at: session.firstRecord.created_at,
      ended_at: session.lastRecord.created_at,
      status: 'completed'
    });

  if (error) {
    console.log(`  ❌ Error: ${error.message}`);
  } else {
    console.log(`  ✅ Created!`);
    created++;
  }
}

console.log(`\n✅ Done! Created ${created} sessions`);

