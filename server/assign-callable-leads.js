// Assign ONLY callable leads to Chris based on current time
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Eastern Time callable states (8am-9pm ET)
const easternStates = ['FL', 'GA', 'SC', 'NC', 'VA', 'WV', 'KY', 'TN', 'AL', 'MS', 'OH', 'MI', 'IN', 'PA', 'NY', 'VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD', 'DC'];
// Central Time callable states (8am-9pm CT)  
const centralStates = ['TX', 'OK', 'KS', 'NE', 'MO', 'AR', 'LA', 'IA', 'MN', 'WI', 'IL', 'MS', 'AL', 'TN'];
// Mountain Time callable states (8am-9pm MT)
const mountainStates = ['CO', 'WY', 'MT', 'ND', 'SD', 'UT', 'NV', 'AZ', 'NM'];
// Pacific Time callable states (8am-9pm PT)
const pacificStates = ['CA', 'OR', 'WA', 'ID', 'AK', 'HI'];

function isCallableNow() {
  const now = new Date();
  const currentET = now.toLocaleString("en-US", {timeZone: "America/New_York"});
  const currentCT = now.toLocaleString("en-US", {timeZone: "America/Chicago"}); 
  const currentMT = now.toLocaleString("en-US", {timeZone: "America/Denver"});
  const currentPT = now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"});

  console.log('🕐 Current times:');
  console.log('ET:', currentET);
  console.log('CT:', currentCT); 
  console.log('MT:', currentMT);
  console.log('PT:', currentPT);

  const etHour = new Date(currentET).getHours();
  const ctHour = new Date(currentCT).getHours();
  const mtHour = new Date(currentMT).getHours();
  const ptHour = new Date(currentPT).getHours();

  return {
    eastern: etHour >= 8 && etHour <= 20,
    central: ctHour >= 8 && ctHour <= 20,
    mountain: mtHour >= 8 && mtHour <= 20,
    pacific: ptHour >= 8 && ptHour <= 20
  };
}

async function assignCallableLeads() {
  console.log('🎯 ASSIGNING ONLY CALLABLE LEADS TO CHRIS...');
  
  const callable = isCallableNow();
  console.log('📞 Callable zones:', callable);

  let callableStates = [];
  if (callable.eastern) callableStates = [...callableStates, ...easternStates];
  if (callable.central) callableStates = [...callableStates, ...centralStates];
  if (callable.mountain) callableStates = [...callableStates, ...mountainStates];
  if (callable.pacific) callableStates = [...callableStates, ...pacificStates];

  // Remove duplicates
  callableStates = [...new Set(callableStates)];
  
  console.log(`📍 Callable states right now: ${callableStates.length} states`);
  console.log('States:', callableStates.slice(0, 10), '...');

  if (callableStates.length === 0) {
    console.log('❌ NO STATES ARE CALLABLE RIGHT NOW');
    return;
  }

  // First, unassign Chris's current leads that aren't callable
  const { data: currentLeads, error: currentError } = await supabase
    .from('hotlead')
    .select('*')
    .eq('cn_email', 'chrislafond@aoglobelife.com')
    .eq('cnresolution', 'assigned');

  if (currentLeads) {
    let unassigned = 0;
    for (const lead of currentLeads) {
      if (!callableStates.includes(lead.state)) {
        const { error: unassignError } = await supabase
          .from('hotlead')
          .update({
            cn_email: null,
            cnresolution: 'pending',
            assigned_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', lead.id);

        if (!unassignError) {
          unassigned++;
          console.log(`❌ Unassigned non-callable lead: ${lead.first_name} ${lead.last_name} (${lead.state})`);
        }
      }
    }
    console.log(`🚫 Unassigned ${unassigned} non-callable leads`);
  }

  // Now assign callable leads
  const { data: hotleads, error } = await supabase
    .from('hotlead')
    .select('*')
    .or('cn_email.is.null,owned_by_user_id.is.null')
    .in('cnresolution', ['pending', 'null'])
    .in('state', callableStates)
    .limit(25)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching callable hotleads:', error);
    return;
  }

  console.log(`📋 Found ${hotleads.length} CALLABLE hotleads to assign`);

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
      console.log(`✅ Assigned CALLABLE lead: ${lead.first_name} ${lead.last_name} (${lead.state}) to Chris`);
    }
  }

  console.log(`🎯 ASSIGNMENT COMPLETE: ${assigned} CALLABLE leads assigned to Chris`);
}

assignCallableLeads().catch(console.error);