const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const USER_EMAIL = 'cnsysop@aoglobelife.com';

async function testPendingReports() {
  console.log(`\n🔍 Testing pending reports for ${USER_EMAIL}...\n`);

  try {
    // Check masterlead records
    const { data: masterleadCalls, error: masterleadError } = await supabase
      .from('masterlead')
      .select('*')
      .eq('cn_email', USER_EMAIL)
      .in('cnresolution', ['booked', 'appointment_set', 'callback_requested'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (masterleadError) {
      console.error('❌ Error fetching masterlead:', masterleadError);
    } else {
      console.log(`✅ Found ${masterleadCalls?.length || 0} masterlead records:`);
      masterleadCalls?.forEach((call, i) => {
        console.log(`   ${i + 1}. ID: ${call.id}, Resolution: ${call.cnresolution}, Name: ${call.first_name} ${call.last_name}, Phone: ${call.phone}`);
      });
    }

    // Test the API endpoint
    console.log('\n📡 Testing API endpoint...');
    const response = await fetch(`http://localhost:5000/api/aoi-reports/pending?userEmail=${encodeURIComponent(USER_EMAIL)}`, {
      headers: {
        'x-user-email': USER_EMAIL
      }
    });

    if (!response.ok) {
      console.error(`❌ API error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(`   Response: ${text}`);
    } else {
      const data = await response.json();
      console.log(`✅ API returned ${Array.isArray(data) ? data.length : 'non-array'} items`);
      if (Array.isArray(data) && data.length > 0) {
        console.log(`   First item:`, JSON.stringify(data[0], null, 2));
      } else {
        console.log(`   Full response:`, JSON.stringify(data, null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPendingReports();

































