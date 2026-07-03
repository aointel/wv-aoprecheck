import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

console.log('\n🔍 LIVE SCRAPER TEST - Monitoring cnsysop@aoglobelife.com\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('👉 NOW: Open HPPRO and start a presentation');
console.log('👉 Fill in client data and we\'ll watch it come in');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let lastCount = 0;
let sessionId = null;

// Check for new session first
async function checkForNewSession() {
  const { data: sessions } = await supabase
    .from('presentation_sessions')
    .select('id, electron_session_id, started_at, presentation_url')
    .eq('agent_email', 'cnsysop@aoglobelife.com')
    .gte('started_at', new Date().toISOString().split('T')[0])
    .order('started_at', { ascending: false })
    .limit(1);
  
  if (sessions && sessions.length > 0 && sessions[0].id !== sessionId) {
    sessionId = sessions[0].id;
    console.log('\n🎬 NEW SESSION DETECTED!');
    console.log(`   Session ID: ${sessionId}`);
    console.log(`   Started: ${sessions[0].started_at}`);
    console.log(`   URL: ${sessions[0].presentation_url}\n`);
  }
}

// Monitor scraped data
async function checkScrapedData() {
  if (!sessionId) return;
  
  const { count, error } = await supabase
    .from('scraped_presentation_data')
    .select('*', { count: 'exact', head: true })
    .or(`session_id.eq.${sessionId}`);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  if (count > lastCount) {
    const newRecords = count - lastCount;
    console.log(`📊 +${newRecords} new scrapes | Total: ${count}`);
    
    // Get the latest scrape
    const { data: latest } = await supabase
      .from('scraped_presentation_data')
      .select('scraped_data, timestamp')
      .or(`session_id.eq.${sessionId}`)
      .order('timestamp', { ascending: false })
      .limit(1);
    
    if (latest && latest[0]) {
      const data = latest[0].scraped_data;
      console.log(`   URL: ${data.url || 'N/A'}`);
      console.log(`   Title: ${data.title || 'N/A'}`);
      
      // Check for client data in forms
      if (data.forms && data.forms.length > 0) {
        data.forms.forEach(form => {
          if (form.fields) {
            const filledFields = form.fields.filter(f => f.value && f.value.trim().length > 0);
            if (filledFields.length > 0) {
              console.log(`   ✅ Form data found:`);
              filledFields.slice(0, 3).forEach(f => {
                console.log(`      ${f.name || 'unnamed'}: ${f.value.slice(0, 50)}`);
              });
            }
          }
        });
      }
      
      // Check for text content
      if (data.textContent) {
        const text = data.textContent.slice(0, 200).replace(/\n/g, ' ');
        if (text.trim().length > 0) {
          console.log(`   Text: ${text}...`);
        }
      }
      
      console.log(`   Time: ${latest[0].timestamp}\n`);
    }
    
    lastCount = count;
  }
}

// Check every 2 seconds
console.log('⏳ Waiting for activity...\n');

const interval = setInterval(async () => {
  await checkForNewSession();
  await checkScrapedData();
}, 2000);

// Keep running for 10 minutes
setTimeout(() => {
  clearInterval(interval);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⏱️  10 minutes elapsed - Test complete');
  console.log(`📊 Total scrapes captured: ${lastCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  process.exit(0);
}, 10 * 60 * 1000);

// Handle Ctrl+C
process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('\n\n🛑 Test stopped by user');
  console.log(`📊 Total scrapes captured: ${lastCount}\n`);
  process.exit(0);
});

