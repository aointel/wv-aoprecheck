import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔄 Updating agent emails for unknown sessions...\n');

// Map of electron session IDs to actual agents (from earlier check)
const sessionAgentMap = {
  'session_1761428935414_58d3y3a7c': 'leynatran@aoglobelife.com',
  'session_1761440606476_lsdsbql0l': 'leynatran@aoglobelife.com',
  'session_1761450648520_v9c799qvv': 'diankablash@aoglobelife.com' // Latest one
};

for (const [electronId, agentEmail] of Object.entries(sessionAgentMap)) {
  const { error } = await supabase
    .from('presentation_sessions')
    .update({
      agent_email: agentEmail,
      agent_name: agentEmail.split('@')[0]
    })
    .eq('electron_session_id', electronId);

  if (error) {
    console.log(`❌ Failed to update ${electronId}:`, error.message);
  } else {
    console.log(`✅ Updated ${electronId} → ${agentEmail}`);
  }
}

console.log('\n✅ All agents updated!');

