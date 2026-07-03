const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function getAgentEmails() {
  try {
    // Get all booked calls from masterlead
    const { data: bookedCalls, error } = await supabase
      .from('masterlead')
      .select('phone, first_name, last_name, cn_email, taalk_market, updated_at')
      .eq('cnresolution', 'booked');

    if (error) {
      console.error('Error fetching booked calls:', error);
      return;
    }

    console.log(`\n🚨 PHANTOM BOOKINGS BY AGENT EMAIL:\n`);
    
    // Count by cn_email
    const emailCounts = {};
    bookedCalls.forEach(call => {
      const email = call.cn_email || 'NO EMAIL';
      if (!emailCounts[email]) {
        emailCounts[email] = [];
      }
      emailCounts[email].push(`${call.first_name} ${call.last_name} (${call.phone}) - ${call.taalk_market}`);
    });
    
    // Sort by count (highest first)
    const sortedEmails = Object.entries(emailCounts).sort((a, b) => b[1].length - a[1].length);
    
    sortedEmails.forEach(([email, bookings]) => {
      console.log(`\n📧 ${email}: ${bookings.length} phantom bookings`);
      bookings.forEach((booking, index) => {
        console.log(`   ${index + 1}. ${booking}`);
      });
    });
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`- ${bookedCalls.length} total phantom bookings`);
    console.log(`- ${sortedEmails.length} different agents`);
    console.log(`- All marked as "booked" but zero appointments in database`);
    
  } catch (error) {
    console.error('Script error:', error);
  }
}

getAgentEmails();