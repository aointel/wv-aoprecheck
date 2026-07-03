const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function syncCarringtonAgents() {
  console.log('\n🔄 Syncing Carrington Hanna agents to agent_hierarchy...\n');

  // Step 1: Use the provided associate_id
  const carringtonAssociateId = 91167;
  
  // Get Carrington's info from customers table
  const { data: carringtonData, error: carringtonError } = await supabase
    .from('customers')
    .select('associate_id, company_email, first_name, last_name')
    .eq('associate_id', carringtonAssociateId)
    .maybeSingle();

  if (carringtonError) {
    console.error('❌ Error finding Carrington Hanna:', carringtonError);
    return;
  }

  if (!carringtonData) {
    console.log(`❌ Could not find associate_id ${carringtonAssociateId} in customers table`);
    return;
  }

  const carringtonName = `${carringtonData.first_name || ''} ${carringtonData.last_name || ''}`.trim().toUpperCase() || 'CARRINGTON HANNA';
  console.log(`✅ Found Carrington Hanna:`);
  console.log(`   Name: ${carringtonName}`);
  console.log(`   Email: ${carringtonData.company_email || 'N/A'}`);
  console.log(`   Associate ID: ${carringtonAssociateId}\n`);

  // Step 2: Ensure Carrington is in mga_rga_directory
  const { data: existingMga, error: mgaCheckError } = await supabase
    .from('mga_rga_directory')
    .select('*')
    .eq('associate_id', carringtonAssociateId)
    .maybeSingle();

  if (mgaCheckError) {
    console.error('❌ Error checking mga_rga_directory:', mgaCheckError);
  } else if (!existingMga) {
    console.log('📝 Adding Carrington Hanna to mga_rga_directory...');
    const { error: insertError } = await supabase
      .from('mga_rga_directory')
      .insert({
        associate_id: carringtonAssociateId,
        name: carringtonName,
        email: carringtonData.company_email,
        role: 'MGA'
      });

    if (insertError) {
      console.error('❌ Error inserting into mga_rga_directory:', insertError);
    } else {
      console.log('✅ Added Carrington Hanna to mga_rga_directory\n');
    }
  } else {
    console.log(`✅ Carrington Hanna already in mga_rga_directory as ${existingMga.role}\n`);
  }

  // Step 3: Get all agents from producerlist with Carrington as MGA
  const { data: agents, error: agentsError } = await supabase
    .from('producerlist')
    .select('associate_id, agent_name, company_email, mga, rga')
    .eq('mga', 'CARRINGTON HANNA')
    .not('company_email', 'is', null);

  if (agentsError) {
    console.error('❌ Error fetching agents:', agentsError);
    return;
  }

  console.log(`📊 Found ${agents?.length || 0} agents with CARRINGTON HANNA as MGA\n`);

  if (!agents || agents.length === 0) {
    console.log('❌ No agents found!');
    return;
  }

  // Step 4: Get RGA associate IDs for ENO IFTIU
  const { data: enoRga, error: rgaError } = await supabase
    .from('mga_rga_directory')
    .select('associate_id')
    .ilike('name', '%ENO%IFTIU%')
    .maybeSingle();

  const enoRgaAssociateId = enoRga?.associate_id || null;
  console.log(`📋 ENO IFTIU RGA Associate ID: ${enoRgaAssociateId || 'NOT FOUND'}\n`);

  // Step 5: Sync each agent to agent_hierarchy
  let successCount = 0;
  let errorCount = 0;
  let updateCount = 0;
  let insertCount = 0;

  console.log('📝 Syncing agents to agent_hierarchy...\n');

  for (const agent of agents) {
    const record = {
      agent_email: agent.company_email.toLowerCase(),
      agent_name: agent.agent_name,
      agent_associate_id: agent.associate_id,
      mga_name: 'CARRINGTON HANNA',
      mga_associate_id: carringtonAssociateId,
      rga_name: agent.rga && agent.rga !== '0' ? agent.rga : null,
      rga_associate_id: agent.rga === 'ENO IFTIU' ? enoRgaAssociateId : null
    };

    // Check if exists
    const { data: existing, error: checkError } = await supabase
      .from('agent_hierarchy')
      .select('id')
      .eq('agent_associate_id', agent.associate_id)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error(`❌ Error checking ${agent.agent_name}:`, checkError);
      errorCount++;
      continue;
    }

    if (existing) {
      // Update
      const { error: updateError } = await supabase
        .from('agent_hierarchy')
        .update(record)
        .eq('agent_associate_id', agent.associate_id);

      if (updateError) {
        console.error(`❌ Error updating ${agent.agent_name}:`, updateError);
        errorCount++;
      } else {
        updateCount++;
        if (updateCount % 10 === 0) {
          console.log(`   Updated ${updateCount} agents...`);
        }
      }
    } else {
      // Insert
      const { error: insertError } = await supabase
        .from('agent_hierarchy')
        .insert(record);

      if (insertError) {
        console.error(`❌ Error inserting ${agent.agent_name}:`, insertError);
        errorCount++;
      } else {
        insertCount++;
        if (insertCount % 10 === 0) {
          console.log(`   Inserted ${insertCount} agents...`);
        }
      }
    }
  }

  console.log(`\n✅ Sync complete!`);
  console.log(`   Inserted: ${insertCount}`);
  console.log(`   Updated: ${updateCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total: ${agents.length}\n`);

  // Step 6: Verify
  const { data: verified, error: verifyError } = await supabase
    .from('agent_hierarchy')
    .select('agent_name, agent_email, mga_name, mga_associate_id')
    .eq('mga_associate_id', carringtonAssociateId)
    .limit(5);

  if (verifyError) {
    console.error('❌ Error verifying:', verifyError);
  } else {
    console.log(`✅ Verification: Found ${verified?.length || 0} agents with Carrington as MGA`);
    if (verified && verified.length > 0) {
      console.log(`   Sample: ${verified[0].agent_name} (${verified[0].agent_email})`);
    }
  }
}

syncCarringtonAgents().catch(console.error);










