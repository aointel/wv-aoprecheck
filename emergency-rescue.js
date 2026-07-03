import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Supabase setup
const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inljeno3amV0eHdwZmd0cnpleXl0dCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3MDMyMjE1NDIsImV4cCI6MjAxODc5NzU0Mn0.6N2k9B71Dw90I_xMsUxBp_lvb6wV_jKo9RkZnJjBU5I'
);

const TAALK_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

async function downloadRecording(callId, sessionId) {
  const url = `https://api.taalk.ai/api/calls/${callId}/recording?db=michaelmandella`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TAALK_API_KEY}`,
        'Accept': 'audio/mpeg'
      }
    });
    
    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      const filename = `./recordings/${callId}-${Date.now()}.mp3`;
      
      // Create recordings dir if it doesn't exist
      if (!fs.existsSync('./recordings')) {
        fs.mkdirSync('./recordings', { recursive: true });
      }
      
      fs.writeFileSync(filename, buffer);
      console.log(`✅ SAVED: ${sessionId} -> ${filename}`);
      
      // Update Supabase
      await supabase
        .from('verification_sessions')
        .update({ taalk_call_url: filename })
        .eq('session_id', sessionId);
      
      return true;
    } else {
      console.log(`❌ FAILED: ${sessionId} (${response.status})`);
      return false;
    }
  } catch (error) {
    console.log(`💀 ERROR: ${sessionId} - ${error.message}`);
    return false;
  }
}

async function rescueRecordings() {
  // Get all sessions from last week with call IDs but no stored recordings
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  const { data: sessions } = await supabase
    .from('verification_sessions')
    .select('session_id, taalk_call_id')
    .not('taalk_call_id', 'is', null)
    .is('taalk_call_url', null)
    .gte('created_at', oneWeekAgo.toISOString())
    .order('created_at', { ascending: false });
  
  console.log(`🚨 Found ${sessions?.length || 0} sessions to rescue`);
  
  let saved = 0;
  let failed = 0;
  
  for (const session of sessions || []) {
    const result = await downloadRecording(session.taalk_call_id, session.session_id);
    if (result) saved++;
    else failed++;
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n📊 RESULTS: ${saved} saved, ${failed} failed`);
}

rescueRecordings();
