// Debug script to test Martin Toma lead filtering
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMartinLeads() {
  const userEmail = 'martintoma@aoglobelife.com';
  
  console.log(`Testing lead query for: ${userEmail}`);
  
  try {
    // Test the exact same query from the routes file
    const { data: masterLeads, error: masterError } = await supabase
      .from('masterlead')
      .select('*')
      .eq('cn_email', userEmail)
      .or('cnresolution.is.null,cnresolution.eq.pending,cnresolution.eq.no_answer')
      .order('updated_at', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: false });

    if (masterError) {
      console.error('Query error:', masterError);
      return;
    }

    console.log(`Query returned ${masterLeads?.length || 0} leads`);
    
    if (masterLeads && masterLeads.length > 0) {
      console.log('First few cn_emails:', masterLeads.slice(0, 5).map(l => l.cn_email));
      
      // Check if any leads actually match the email
      const matching = masterLeads.filter(l => l.cn_email === userEmail);
      const nonMatching = masterLeads.filter(l => l.cn_email !== userEmail);
      
      console.log(`Matching leads: ${matching.length}`);
      console.log(`Non-matching leads: ${nonMatching.length}`);
      
      if (nonMatching.length > 0) {
        console.log('Non-matching emails found:', [...new Set(nonMatching.map(l => l.cn_email))]);
      }
    } else {
      console.log('No leads found - this is correct for Martin Toma');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testMartinLeads();