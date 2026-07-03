// Force assign hotleads to Chris right now
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function forceAssignHotleads() {
  console.log('🎯 FORCE ASSIGNING 25 HOTLEADS TO CHRIS...');
  
  // Get first 25 unassigned hotleads (any market)
  const { data: hotleads, error } = await supabase
    .from('hotlead')
    .select('*')
    .or('cn_email.is.null,owned_by_user_id.is.null')
    .in('cnresolution', ['pending', 'null'])
    .limit(25)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching hotleads:', error);
    return;
  }

  console.log(`📋 Found ${hotleads.length} hotleads to assign`);

  let assigned = 0;
  for (const lead of hotleads) {
    const { error: updateError } = await supabase
      .from('hotlead')
      .update({
        cn_email: 'chrislafond@aoglobelife.com',
        cnresolution: 'assigned',
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', lead.id);

    if (!updateError) {
      assigned++;
      console.log(`✅ Assigned hotlead ${lead.id} (${lead.first_name} ${lead.last_name}) to Chris`);
    } else {
      console.error(`❌ Failed to assign ${lead.id}:`, updateError);
    }
  }

  console.log(`🎯 ASSIGNMENT COMPLETE: ${assigned} hotleads assigned to Chris`);
}

forceAssignHotleads().catch(console.error);