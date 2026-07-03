// Check Supabase directly for David's 4+ minute calls
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkDavidSupabaseCalls() {
  console.log('🔍 Checking Supabase for David\'s 4+ minute calls...');
  
  try {
    // Check for David's calls in Supabase twilio_call_logs
    const { data: davidCalls, error } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .or('agent_email.eq.davidfulfer@aoglobelife.com,owner_email.eq.davidfulfer@aoglobelife.com')
      .gte('call_duration', 240)
      .eq('call_status', 'completed')
      .gte('call_started_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('call_started_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('❌ Error checking Supabase:', error);
      return;
    }

    console.log(`📞 Found ${davidCalls?.length || 0} calls over 4 minutes for David in Supabase`);
    
    if (davidCalls && davidCalls.length > 0) {
      console.log('\n📋 David\'s 4+ minute calls in Supabase:');
      davidCalls.forEach((call, i) => {
        console.log(`${i+1}. ${call.twilio_call_sid}`);
        console.log(`   📞 Duration: ${call.call_duration} seconds`);
        console.log(`   📅 Date: ${call.call_started_at}`);
        console.log(`   📱 Phone: ${call.to_number}`);
        console.log(`   🔄 Direction: ${call.call_direction}`);
        console.log(`   👤 Agent: ${call.agent_email || call.owner_email}`);
      });
      
      console.log('\n🚨 David DOES have accountability calls in Supabase that need disposition!');
    } else {
      console.log('✅ No 4+ minute calls found for David in Supabase');
    }
    
  } catch (error) {
    console.error('❌ Failed to check Supabase:', error);
  }
}

checkDavidSupabaseCalls();