const { Client } = require('pg');

(async () => {
  const client = new Client({ 
    connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' 
  });
  
  await client.connect();
  
  const result = await client.query(`
    SELECT email as agent_email, lead_number as lead_phone, call_duration, last_contacted 
    FROM masterlead 
    WHERE taalk_lead_id = '17535244' 
    ORDER BY last_contacted DESC 
    LIMIT 5
  `);
  
  console.log('Recent calls for lead 17535244:');
  console.table(result.rows);
  
  if (result.rows.length > 0) {
    const agentEmail = result.rows[0].agent_email;
    console.log(`\nAgent who called: ${agentEmail}`);
    
    // Get producer info
    const fetch = require('node-fetch');
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      'https://ycztjetxwpfgtrzeyytt.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0',
      { global: { fetch } }
    );
    
    const { data: producer } = await supabase
      .from('producers')
      .select('email, agent_name, associate_id')
      .eq('email', agentEmail)
      .single();
    
    console.log('\nProducer info:');
    console.log(`  Email: ${producer?.email || 'NOT FOUND'}`);
    console.log(`  Name: ${producer?.agent_name || 'NOT FOUND'}`);
    console.log(`  Associate ID: ${producer?.associate_id || 'NOT FOUND'}`);
    console.log('\n✅ CORRECT WEBHOOK SHOULD HAVE BEEN:');
    console.log(`  Lead ID: 17535244`);
    console.log(`  Associate ID: ${producer?.associate_id || '999 (NOT FOUND)'}`);
  }
  
  await client.end();
})();

