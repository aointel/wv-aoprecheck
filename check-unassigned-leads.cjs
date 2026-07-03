const fetch = require('node-fetch');

async function checkUnassignedLeads() {
  console.log('🔍 CHECKING UNASSIGNED LEADS IN DATABASE\n');
  
  try {
    const SUPABASE_URL = 'https://ycztjetxwpfgtrzeytt.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';
    
    // Count total unassigned pending/null/called leads
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/masterlead?select=id&cn_email=is.null&dnc=eq.false&or=(cnresolution.is.null,cnresolution.eq.pending,cnresolution.eq.called,cnresolution.eq.)`,
      {
        method: 'HEAD',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'count=exact'
        }
      }
    );
    
    const count = response.headers.get('content-range')?.split('/')[1] || '0';
    console.log(`📊 UNASSIGNED CALLABLE LEADS: ${count}`);
    console.log(`   (pending, null, called, blank - NOT assigned to any agent)\n`);
    
    // Count by market
    const markets = ['Veteran', 'Globe Market'];
    for (const market of markets) {
      const marketResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/masterlead?select=id&cn_email=is.null&dnc=eq.false&taalk_market=eq.${encodeURIComponent(market)}&or=(cnresolution.is.null,cnresolution.eq.pending,cnresolution.eq.called,cnresolution.eq.)`,
        {
          method: 'HEAD',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'count=exact'
          }
        }
      );
      
      const marketCount = marketResponse.headers.get('content-range')?.split('/')[1] || '0';
      console.log(`   ${market}: ${marketCount} unassigned leads`);
    }
    
    console.log('\n✅ Done\n');
    
  } catch (error) {
    console.error('❌ ERROR:', error);
  }
}

checkUnassignedLeads()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

