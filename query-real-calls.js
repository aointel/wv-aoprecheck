// Query real Supabase data for 4+ minute calls  
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function getRealCallData() {
  console.log('🔍 Connecting to Supabase directly...\n');
  
  // Use correct hardcoded Supabase credentials from system
  const SUPABASE_URL = "https://ycztjetxwpfgtrzeyytt.supabase.co";
  const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0";
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('❌ Missing Supabase credentials');
    return;
  }
  
  // Create direct connection
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  console.log('✅ Supabase connected, querying real data...\n');
  
  // Query hotleads table for 4+ minute calls without disposition
  console.log('📋 HOTLEADS TABLE - 4+ minute calls:');
  const { data: hotleads, error: hotleadError } = await client
    .from('hotleads')
    .select('*')
    .gte('call_duration', 240);
    
  if (hotleadError) {
    console.error('❌ Hotleads error:', hotleadError);
  } else {
    console.log(`Found ${hotleads?.length || 0} hotleads with 4+ min calls`);
    if (hotleads?.length > 0) {
      hotleads.forEach(lead => {
        console.log(`   📱 ${lead.phone}: ${lead.call_duration}s (${Math.floor(lead.call_duration/60)}:${String(lead.call_duration%60).padStart(2,'0')}) - ${lead.agent_email} - ${lead.disposition || 'NO DISPOSITION'}`);
      });
    }
  }
  
  console.log('\n📋 TWILIO_CALL_LOGS TABLE - 4+ minute calls:');
  // Query twilio_call_logs table  
  const { data: twilioLogs, error: twilioError } = await client
    .from('twilio_call_logs')
    .select('*')
    .gte('call_duration', 240);
    
  if (twilioError) {
    console.error('❌ Twilio logs error:', twilioError);
  } else {
    console.log(`Found ${twilioLogs?.length || 0} Twilio logs with 4+ min calls`);
    if (twilioLogs?.length > 0) {
      twilioLogs.forEach(call => {
        console.log(`   📱 ${call.to_number}: ${call.call_duration}s (${Math.floor(call.call_duration/60)}:${String(call.call_duration%60).padStart(2,'0')}) - ${call.owner_email} - Status: ${call.call_status}`);
      });
    }
  }
  
  console.log('\n📋 MASTERLEAD TABLE - Checking for call disposition tracking:');
  // Check masterlead table for any with call tracking
  const { data: masterleads, error: masterError } = await client
    .from('masterlead')
    .select('*')
    .not('last_contacted', 'is', null)
    .limit(10);
    
  if (masterError) {
    console.error('❌ Masterlead error:', masterError);
  } else {
    console.log(`Found ${masterleads?.length || 0} masterleads with contact history (showing first 10)`);
    if (masterleads?.length > 0) {
      masterleads.forEach(lead => {
        console.log(`   📱 ${lead.phone}: Last contacted ${lead.last_contacted} - ${lead.email}`);
      });
    }
  }
}

getRealCallData().catch(console.error);