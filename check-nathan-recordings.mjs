import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try multiple env file locations
dotenv.config({ path: join(__dirname, '.env.local') });
dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const email = 'nathanlittin@aoglobelife.com';

async function checkRecordings() {
  console.log(`🔍 Checking for recordings for ${email}...\n`);

  // Check vdp_calls table (likely where Twilio calls are stored)
  console.log('📞 Checking vdp_calls...');
  const { data: vdpCalls, error: vdpError } = await supabase
    .from('vdp_calls')
    .select('id, company_email, agent, twilio_call_sid, recording_url, recording_status, time, created_at, updated_at')
    .or(`company_email.ilike.%${email}%,agent.eq.${email}`)
    .order('time', { ascending: false })
    .limit(100);

  if (vdpError) {
    console.error('❌ Error fetching vdp_calls:', vdpError);
  } else {
    console.log(`   Found ${vdpCalls?.length || 0} calls in vdp_calls\n`);
    if (vdpCalls && vdpCalls.length > 0) {
      const withRecordings = vdpCalls.filter(call => 
        call.recording_url || call.recording_status === 'completed' || call.twilio_call_sid
      );
      console.log(`   📼 Calls with potential recordings: ${withRecordings.length}`);
      
      vdpCalls.slice(0, 20).forEach((call, i) => {
        console.log(`\n   ${i + 1}. Call ID: ${call.id}`);
        console.log(`      Twilio SID: ${call.twilio_call_sid || 'N/A'}`);
        console.log(`      Recording URL: ${call.recording_url || 'N/A'}`);
        console.log(`      Recording Status: ${call.recording_status || 'N/A'}`);
        console.log(`      Date: ${call.time || call.created_at || 'N/A'}`);
      });
    }
  }

  // Check twilio_call_logs if it exists
  console.log('\n📞 Checking twilio_call_logs...');
  const { data: twilioCalls, error: twilioError } = await supabase
    .from('twilio_call_logs')
    .select('*')
    .or(`agent_email.ilike.%${email}%,company_email.ilike.%${email}%`)
    .order('call_started_at', { ascending: false })
    .limit(100);

  if (twilioError) {
    if (twilioError.code === 'PGRST116') {
      console.log('   ⚠️ twilio_call_logs table does not exist');
    } else {
      console.error('❌ Error fetching twilio_call_logs:', twilioError);
    }
  } else {
    console.log(`   Found ${twilioCalls?.length || 0} calls in twilio_call_logs\n`);
    if (twilioCalls && twilioCalls.length > 0) {
      const withRecordings = twilioCalls.filter(call => 
        call.recording_url || call.recording_sid
      );
      console.log(`   📼 Calls with potential recordings: ${withRecordings.length}`);
      
      twilioCalls.slice(0, 20).forEach((call, i) => {
        console.log(`\n   ${i + 1}. Call SID: ${call.call_sid || call.twilio_call_sid || 'N/A'}`);
        console.log(`      Recording SID: ${call.recording_sid || 'N/A'}`);
        console.log(`      Recording URL: ${call.recording_url || 'N/A'}`);
        console.log(`      Date: ${call.call_started_at || call.created_at || 'N/A'}`);
      });
    }
  }

  // Summary
  console.log(`\n📊 Summary:`);
  console.log(`   vdp_calls: ${vdpCalls?.length || 0} total calls`);
  console.log(`   twilio_call_logs: ${twilioCalls?.length || 0} total calls`);
}

checkRecordings().catch(console.error);
