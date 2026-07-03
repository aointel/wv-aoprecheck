import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0',
  { auth: { persistSession: false } }
);

// Get sample row to see all columns
const { data: sample, error: sErr } = await supabase.from('twilio_call_logs').select('*').limit(3).order('id', { ascending: false });
if (sErr) { console.error('Error:', sErr.message); process.exit(1); }
if (!sample || sample.length === 0) { console.log('twilio_call_logs is EMPTY'); process.exit(0); }

console.log('Columns:', Object.keys(sample[0]).join(', '));
console.log('\nSample rows:');
sample.forEach(r => console.log(JSON.stringify(r, null, 2)));

// Count today's rows with various filters
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const startUTC = today + 'T07:00:00.000Z';
const endUTC = new Date(new Date(startUTC).getTime() + 86400000).toISOString();

// Try different timestamp columns
for (const col of ['call_started_at', 'created_at', 'start_time', 'timestamp', 'updated_at']) {
  const { count } = await supabase.from('twilio_call_logs').select('*', { count: 'exact', head: true }).gte(col, startUTC).lt(col, endUTC).catch(() => ({ count: null }));
  if (count !== null) console.log(`\n${col} today count: ${count}`);
}
