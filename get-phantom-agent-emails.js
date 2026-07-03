// Simple script to get agent emails for phantom bookings
const fetch = require('node-fetch');

async function getPhantomAgentEmails() {
  try {
    const response = await fetch('http://localhost:5000/api/check-phantom-bookings');
    const data = await response.json();
    
    console.log('\n🚨 PHANTOM BOOKINGS BY AGENT EMAIL:\n');
    
    // Count by cn_email
    const emailCounts = {};
    data.phantomBookings.forEach(booking => {
      const email = booking.cn_email || 'NO EMAIL';
      if (!emailCounts[email]) {
        emailCounts[email] = [];
      }
      emailCounts[email].push(`${booking.first_name} ${booking.last_name} (${booking.phone})`);
    });
    
    // Sort by count
    const sortedEmails = Object.entries(emailCounts).sort((a, b) => b[1].length - a[1].length);
    
    sortedEmails.forEach(([email, bookings]) => {
      console.log(`\n📧 ${email}: ${bookings.length} phantom bookings`);
      bookings.forEach((booking, index) => {
        console.log(`   ${index + 1}. ${booking}`);
      });
    });
    
    console.log(`\n📊 SUMMARY: ${data.phantomCount} total phantom bookings across ${sortedEmails.length} agents`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

getPhantomAgentEmails();