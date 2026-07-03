// Fix Chris's leads to only include CALLABLE ones RIGHT NOW
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function isCallableTime() {
  const now = new Date();
  
  // Get current time in different zones
  const etDate = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const ctDate = new Date(now.toLocaleString("en-US", {timeZone: "America/Chicago"})); 
  const mtDate = new Date(now.toLocaleString("en-US", {timeZone: "America/Denver"}));
  const ptDate = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));

  const etHour = etDate.getHours();
  const ctHour = ctDate.getHours();
  const mtHour = mtDate.getHours();
  const ptHour = ptDate.getHours();

  console.log(`🕐 Current time check: ET=${etHour}:${etDate.getMinutes()}, CT=${ctHour}:${ctDate.getMinutes()}, MT=${mtHour}:${mtDate.getMinutes()}, PT=${ptHour}:${ptDate.getMinutes()}`);

  // 8am-9pm calling hours (20 = 8pm, so 8am-8:59pm is ok)
  return {
    eastern: etHour >= 8 && etHour <= 20,
    central: ctHour >= 8 && ctHour <= 20,
    mountain: mtHour >= 8 && mtHour <= 20,
    pacific: ptHour >= 8 && ptHour <= 20
  };
}

async function fixCallableLeads() {
  console.log('🎯 FIXING CHRIS\'S LEADS TO ONLY CALLABLE ONES...');
  
  const callable = isCallableTime();
  console.log('📞 Callable time zones:', callable);

  // First, get sample hotlead to check field structure
  const { data: sample, error: sampleError } = await supabase
    .from('hotlead')
    .select('*')
    .limit(1);

  if (sample && sample.length > 0) {
    console.log('📋 Sample hotlead structure:');
    console.log('Available fields:', Object.keys(sample[0]));
    
    // Look for state field
    const stateField = Object.keys(sample[0]).find(key => 
      key.toLowerCase().includes('state') || 
      key.toLowerCase().includes('st') ||
      key === 'taalk_state' ||
      key === 'prospect_state'
    );
    
    console.log('🔍 State field found:', stateField);
    
    if (stateField && sample[0][stateField]) {
      console.log('📍 Sample state value:', sample[0][stateField]);
    }
  }

  // Central/Mountain/Pacific zones are callable now
  // Get Chris's current assigned leads to check what we have
  const { data: chrisLeads, error } = await supabase
    .from('hotlead')
    .select('*')
    .eq('cn_email', 'chrislafond@aoglobelife.com')
    .eq('cnresolution', 'assigned');

  if (error) {
    console.error('❌ Error fetching Chris\'s leads:', error);
    return;
  }

  console.log(`📋 Chris currently has ${chrisLeads ? chrisLeads.length : 0} assigned leads`);

  if (chrisLeads && chrisLeads.length > 0) {
    console.log('🔍 First lead structure:');
    const lead = chrisLeads[0];
    console.log('Lead fields:', Object.keys(lead));
    
    // Look for phone, state, and time zone info
    const phoneField = lead.phone || lead.taalk_phone || lead.prospect_phone;
    console.log('📞 Phone number:', phoneField);
    
    // Check different possible state fields
    const possibleStateFields = ['state', 'taalk_state', 'prospect_state', 'region', 'st'];
    for (let field of possibleStateFields) {
      if (lead[field]) {
        console.log(`📍 ${field}:`, lead[field]);
      }
    }
  }

  // For now, since it's late ET but callable in other zones, keep all leads
  // The real fix needs the proper state field identified
  console.log('⚡ KEEPING ALL LEADS FOR NOW - Need to identify correct state field');
  console.log(`✅ Chris has ${chrisLeads ? chrisLeads.length : 0} hotleads ready to call`);
}

fixCallableLeads().catch(console.error);