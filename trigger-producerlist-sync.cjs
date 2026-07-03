const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function syncProducerList() {
  console.log('\n🔄 Syncing producerlist to agent_hierarchy...\n');

  // Get all agents from producerlist
  const { data: producers, error: producersError } = await supabase
    .from('producerlist')
    .select('associate_id, agent_name, company_email, mga, rga, aoi_market, ao_market_2, designated_market')
    .not('company_email', 'is', null)
    .not('company_email', 'eq', '')
    .limit(10000);

  if (producersError) {
    console.error('❌ Failed to fetch producerlist:', producersError);
    return;
  }

  console.log(`📊 Found ${producers?.length || 0} agents in producerlist`);

  // Get MGA/RGA directory
  const { data: directory } = await supabase
    .from('mga_rga_directory')
    .select('name, associate_id');

  const lookup = new Map();
  if (directory) {
    directory.forEach(d => {
      const nameUpper = d.name?.toUpperCase().trim();
      if (nameUpper && d.associate_id) {
        lookup.set(nameUpper, d.associate_id);
      }
    });
  }

  console.log(`📋 Loaded ${lookup.size} MGA/RGA entries\n`);

  let synced = 0;
  let errors = 0;

  for (const producer of producers || []) {
    if (!producer.company_email || !producer.associate_id) continue;

    const mgaName = producer.mga && producer.mga !== '0' ? producer.mga.toUpperCase().trim() : null;
    const rgaName = producer.rga && producer.rga !== '0' ? producer.rga.toUpperCase().trim() : null;

    const payload = {
      agent_associate_id: producer.associate_id,
      agent_name: producer.agent_name || null,
      agent_email: producer.company_email.toLowerCase().trim(),
      mga_name: mgaName,
      mga_associate_id: mgaName ? (lookup.get(mgaName) || null) : null,
      rga_name: rgaName,
      rga_associate_id: rgaName ? (lookup.get(rgaName) || null) : null,
      aoi_market: producer.aoi_market || null,
      ao_market_2: producer.ao_market_2 || null,
      designated_market: producer.designated_market || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('agent_hierarchy')
      .upsert(payload, { onConflict: 'agent_associate_id' });

    if (error) {
      errors++;
    } else {
      synced++;
      if (synced % 100 === 0) {
        console.log(`   Synced ${synced}/${producers.length}...`);
      }
    }
  }

  console.log(`\n✅ Sync complete: ${synced} synced, ${errors} errors\n`);

  // Verify Carrington's agents
  const { data: carringtonAgents } = await supabase
    .from('agent_hierarchy')
    .select('agent_name, agent_email')
    .eq('mga_associate_id', 91167)
    .limit(10);

  console.log(`✅ Found ${carringtonAgents?.length || 0} agents with Carrington as MGA`);
  if (carringtonAgents && carringtonAgents.length > 0) {
    console.log(`   Sample: ${carringtonAgents[0].agent_name} (${carringtonAgents[0].agent_email})`);
  }
}

syncProducerList().catch(console.error);










