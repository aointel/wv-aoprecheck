import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔍 Checking which users have Electron app version 1.0.3...\n');

// Get all presentation sessions from today and yesterday
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

const { data: sessions } = await supabase
  .from('presentation_sessions')
  .select('agent_email, started_at, electron_session_id')
  .gte('started_at', yesterday.toISOString())
  .order('started_at', { ascending: false });

console.log(`📊 Sessions in last 24 hours: ${sessions?.length}\n`);

// Group by agent
const agentActivity = {};
sessions?.forEach(session => {
  if (!agentActivity[session.agent_email]) {
    agentActivity[session.agent_email] = {
      sessions: 0,
      hasElectronId: 0,
      latestSession: session.started_at
    };
  }
  agentActivity[session.agent_email].sessions++;
  if (session.electron_session_id?.startsWith('session_')) {
    agentActivity[session.agent_email].hasElectronId++;
  }
});

console.log('Agents with activity (last 24 hours):');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

Object.entries(agentActivity)
  .sort((a, b) => b[1].sessions - a[1].sessions)
  .forEach(([email, data]) => {
    const hasNewApp = data.hasElectronId > 0;
    const status = hasNewApp ? '✅ HAS v1.0.3' : '❌ OLD VERSION';
    console.log(`${status} - ${email}`);
    console.log(`   Sessions: ${data.sessions}`);
    console.log(`   Latest: ${new Date(data.latestSession).toLocaleString()}`);
    console.log('');
  });

// Check for scraped data in last 24 hours
const { data: recentScraped } = await supabase
  .from('scraped_presentation_data')
  .select('session_id, created_at')
  .gte('created_at', yesterday.toISOString());

console.log(`\n📋 Scraped data in last 24 hours: ${recentScraped?.length || 0} records`);

const uniqueScrapedSessions = [...new Set(recentScraped?.map(r => r.session_id))];
console.log(`   From ${uniqueScrapedSessions.length} unique sessions`);

if (uniqueScrapedSessions.length > 0) {
  console.log('\n   Sessions with scraping data:');
  uniqueScrapedSessions.forEach(id => {
    const count = recentScraped.filter(r => r.session_id === id).length;
    console.log(`   - ${id} (${count} scrapes)`);
  });
}

