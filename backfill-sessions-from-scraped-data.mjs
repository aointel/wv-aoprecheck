import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔄 Creating presentation sessions from scraped data...\n');

// Get all unique session IDs from scraped data
const { data: scrapedData } = await supabase
  .from('scraped_presentation_data')
  .select('session_id, created_at, scraped_data')
  .order('created_at', { ascending: true });

// Group by session_id
const sessionGroups = {};
scrapedData?.forEach(record => {
  if (!sessionGroups[record.session_id]) {
    sessionGroups[record.session_id] = [];
  }
  sessionGroups[record.session_id].push(record);
});

console.log(`📊 Found ${Object.keys(sessionGroups).length} unique session IDs in scraped data\n`);

let created = 0;
let skipped = 0;

for (const [sessionId, records] of Object.entries(sessionGroups)) {
  // Check if session already exists
  const { data: existing } = await supabase
    .from('presentation_sessions')
    .select('id')
    .eq('id', sessionId)
    .single();

  if (existing) {
    console.log(`⏭️  Session exists: ${sessionId}`);
    skipped++;
    continue;
  }

  // Get first and last records for this session
  const firstRecord = records[0];
  const lastRecord = records[records.length - 1];
  
  const startTime = new Date(firstRecord.created_at);
  const endTime = new Date(lastRecord.created_at);
  const durationSeconds = Math.floor((endTime - startTime) / 1000);

  // Try to extract agent email from URL or data
  const url = firstRecord.scraped_data?.url || '';
  const isHppro = url.includes('hppro');
  
  // Create the session
  const { error: createError } = await supabase
    .from('presentation_sessions')
    .insert({
      id: sessionId,
      agent_email: 'unknown@aoglobelife.com', // Will need to be manually updated
      agent_name: 'Unknown Agent',
      presentation_url: url,
      presentation_type: isHppro ? 'hppro' : 'other',
      started_at: firstRecord.created_at,
      ended_at: lastRecord.created_at,
      status: 'completed',
      screenshot_count: 0
    });

  if (createError) {
    console.error(`❌ Failed to create session ${sessionId}:`, createError.message);
  } else {
    console.log(`✅ Created session: ${sessionId}`);
    console.log(`   - ${records.length} scraped data points`);
    console.log(`   - Duration: ${durationSeconds}s`);
    console.log(`   - Started: ${firstRecord.created_at}`);
    created++;
  }
}

console.log(`\n✅ Backfill complete!`);
console.log(`   Created: ${created} sessions`);
console.log(`   Skipped: ${skipped} (already exist)`);
console.log(`\n📝 Next step: Update agent_email for each session manually or via another script`);

