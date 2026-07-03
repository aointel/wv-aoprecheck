import { createClient } from '@supabase/supabase-js';

// Hardcoded values from server/hardcoded-config.ts
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixMissingHierarchy() {
  console.log('🔧 Fixing missing MGA/RGA hierarchy data...\n');

  // Get ALL agents from multiple sources - NO LIMIT
  console.log('📥 Fetching all agents from all sources...');
  
  // Get from live_call_boardt
  const { data: boardAgents, error: boardError } = await supabase
    .from('live_call_boardt')
    .select('agent_email')
    .not('agent_email', 'is', null)
    .limit(100000);

  // Get from agent_hierarchy - paginate to get ALL
  let hierarchyAgents = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data: batch, error: hierarchyError } = await supabase
      .from('agent_hierarchy')
      .select('agent_email')
      .not('agent_email', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (hierarchyError) {
      console.error('❌ Error fetching agent_hierarchy:', hierarchyError);
      break;
    }
    
    if (!batch || batch.length === 0) break;
    hierarchyAgents.push(...batch);
    if (batch.length < pageSize) break;
    page++;
  }

  // Get from producerlist - paginate to get ALL
  let producerAgents = [];
  page = 0;
  while (true) {
    const { data: batch, error: producerError } = await supabase
      .from('producerlist')
      .select('company_email')
      .not('company_email', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (producerError) {
      console.error('❌ Error fetching producerlist:', producerError);
      break;
    }
    
    if (!batch || batch.length === 0) break;
    producerAgents.push(...batch);
    if (batch.length < pageSize) break;
    page++;
  }

  if (boardError) {
    console.error('❌ Error fetching live_call_boardt:', boardError);
  }

  // Combine all unique emails
  const allEmailsSet = new Set();
  (boardAgents || []).forEach(a => {
    if (a.agent_email) allEmailsSet.add(String(a.agent_email).toLowerCase().trim());
  });
  (hierarchyAgents || []).forEach(a => {
    if (a.agent_email) allEmailsSet.add(String(a.agent_email).toLowerCase().trim());
  });
  (producerAgents || []).forEach(a => {
    if (a.company_email) allEmailsSet.add(String(a.company_email).toLowerCase().trim());
  });

  const allEmails = Array.from(allEmailsSet);
  console.log(`📊 Found ${allEmails.length} unique agents total:`);
  console.log(`   - ${boardAgents?.length || 0} from live_call_boardt`);
  console.log(`   - ${hierarchyAgents?.length || 0} from agent_hierarchy`);
  console.log(`   - ${producerAgents?.length || 0} from producerlist\n`);

  const isValidName = (name) => {
    if (!name) return false;
    const trimmed = String(name).trim();
    return trimmed !== '' && trimmed !== '-' && trimmed.length > 0;
  };

  let fixedCount = 0;
  let missingCount = 0;
  let skippedCount = 0;

  // Skip system
  const emailsToProcess = allEmails.filter(e => e && e !== 'system@aoglobelife.com');
  console.log(`📊 Processing ${emailsToProcess.length} agents (excluding system)...\n`);

  // Batch process for efficiency - get all hierarchy data first
  console.log('📥 Fetching all hierarchy data...');
  const batchSize = 500;
  const allHierarchy = [];
  for (let i = 0; i < emailsToProcess.length; i += batchSize) {
    const batch = emailsToProcess.slice(i, i + batchSize);
    const { data: batchData } = await supabase
      .from('agent_hierarchy')
      .select('agent_email, mga_name, rga_name, mga_associate_id, rga_associate_id')
      .in('agent_email', batch)
      .limit(100000);
    if (batchData) allHierarchy.push(...batchData);
  }

  const hierarchyMap = new Map();
  (allHierarchy || []).forEach(h => {
    if (h.agent_email) {
      hierarchyMap.set(String(h.agent_email).toLowerCase().trim(), h);
    }
  });
  console.log(`✅ Loaded ${hierarchyMap.size} existing hierarchy records\n`);

  // Batch fetch producerlist data
  console.log('📥 Fetching producerlist data...');
  const producerMap = new Map();
  for (let i = 0; i < emailsToProcess.length; i += batchSize) {
    const batch = emailsToProcess.slice(i, i + batchSize);
    const { data: producers } = await supabase
      .from('producerlist')
      .select('company_email, associate_id, agent_name, mga, rga')
      .in('company_email', batch)
      .limit(100000);
    
    (producers || []).forEach(p => {
      if (p.company_email) {
        producerMap.set(String(p.company_email).toLowerCase().trim(), p);
      }
    });
  }
  console.log(`✅ Loaded ${producerMap.size} producerlist records\n`);

  // Batch fetch customers data
  console.log('📥 Fetching customers data...');
  const customerMap = new Map();
  for (let i = 0; i < emailsToProcess.length; i += batchSize) {
    const batch = emailsToProcess.slice(i, i + batchSize);
    // Query by company_email
    const { data: customers1 } = await supabase
      .from('customers')
      .select('company_email, personal_email, associate_id, first_name, last_name, company_name, mga_team, rga_team')
      .in('company_email', batch)
      .limit(100000);
    
    (customers1 || []).forEach(c => {
      const email = String(c.company_email || c.personal_email).toLowerCase().trim();
      if (email) customerMap.set(email, c);
    });

    // Query by personal_email
    const { data: customers2 } = await supabase
      .from('customers')
      .select('company_email, personal_email, associate_id, first_name, last_name, company_name, mga_team, rga_team')
      .in('personal_email', batch)
      .limit(100000);
    
    (customers2 || []).forEach(c => {
      const email = String(c.company_email || c.personal_email).toLowerCase().trim();
      if (email) customerMap.set(email, c);
    });
  }
  console.log(`✅ Loaded ${customerMap.size} customers records\n`);

  // Now process all agents
  console.log('🔄 Processing agents and updating hierarchy...\n');
  const updates = [];
  const inserts = [];

  for (const email of emailsToProcess) {
    const hierarchy = hierarchyMap.get(email);
    let mgaName = hierarchy?.mga_name || null;
    let rgaName = hierarchy?.rga_name || null;
    let foundMga = isValidName(mgaName);
    let foundRga = isValidName(rgaName);

    // Try producerlist FIRST (most reliable source for MGA/RGA)
    const producer = producerMap.get(email);
    if (producer) {
      if (!foundMga && isValidName(producer.mga)) {
        mgaName = String(producer.mga).trim();
        foundMga = true;
      }
      if (!foundRga && isValidName(producer.rga)) {
        rgaName = String(producer.rga).trim();
        foundRga = true;
      }
    }

    // Try customers table (secondary source)
    const customer = customerMap.get(email);
    if (customer) {
      if (!foundMga && isValidName(customer.mga_team)) {
        mgaName = String(customer.mga_team).trim();
        foundMga = true;
      }
      if (!foundRga && isValidName(customer.rga_team)) {
        rgaName = String(customer.rga_team).trim();
        foundRga = true;
      }
    }

    // Also check if hierarchy has empty strings/dashes - treat as missing
    const currentMga = hierarchy?.mga_name;
    const currentRga = hierarchy?.rga_name;
    const hasValidMga = isValidName(currentMga);
    const hasValidRga = isValidName(currentRga);

    // Prepare update/insert - update if we found data AND current is missing/invalid
    if (isValidName(mgaName) || isValidName(rgaName)) {
      if (hierarchy) {
        // Update existing - be more aggressive: update if current is missing OR if we found better data
        const updateData = {};
        if (isValidName(mgaName) && (!hasValidMga || !hierarchy.mga_name)) {
          updateData.mga_name = mgaName;
        }
        if (isValidName(rgaName) && (!hasValidRga || !hierarchy.rga_name)) {
          updateData.rga_name = rgaName;
        }

        if (Object.keys(updateData).length > 0) {
          updates.push({ email, data: updateData, mgaName, rgaName });
        } else {
          skippedCount++;
        }
      } else {
        // Create new entry - need associate_id and agent_name
        const producer = producerMap.get(email);
        const customer = customerMap.get(email);
        const associateId = producer?.associate_id || customer?.associate_id || null;
        const agentName = producer?.agent_name || 
          (customer?.first_name && customer?.last_name ? `${customer.first_name} ${customer.last_name}` : null) ||
          customer?.company_name || 
          email.split('@')[0];
        
        if (!associateId) {
          // Skip if no associate_id - can't insert without it
          missingCount++;
          continue;
        }
        
        // Check if record exists with this associate_id but different email
        const existingByAssociateId = Array.from(hierarchyMap.values()).find(h => h.agent_associate_id === associateId);
        if (existingByAssociateId) {
          // Update existing record with new email and MGA/RGA
          updates.push({ 
            email: existingByAssociateId.agent_email, 
            data: {
              agent_email: email, // Update email if different
              mga_name: isValidName(mgaName) ? mgaName : (existingByAssociateId.mga_name || null),
              rga_name: isValidName(rgaName) ? rgaName : (existingByAssociateId.rga_name || null),
            },
            mgaName,
            rgaName
          });
        } else {
          inserts.push({
            agent_email: email,
            agent_associate_id: associateId,
            agent_name: agentName,
            mga_name: isValidName(mgaName) ? mgaName : null,
            rga_name: isValidName(rgaName) ? rgaName : null,
          });
        }
      }
    } else {
      missingCount++;
    }
  }

  // Batch execute updates
  console.log(`\n💾 Executing ${updates.length} updates...`);
  for (const { email, data } of updates) {
    const { error } = await supabase
      .from('agent_hierarchy')
      .update(data)
      .eq('agent_email', email);
    
    if (!error) {
      fixedCount++;
      if (fixedCount % 100 === 0) {
        console.log(`   ✅ Updated ${fixedCount}/${updates.length}...`);
      }
    }
  }

  // Batch execute inserts (100 at a time)
  console.log(`\n💾 Executing ${inserts.length} inserts...`);
  for (let i = 0; i < inserts.length; i += 100) {
    const batch = inserts.slice(i, i + 100);
    const { error } = await supabase
      .from('agent_hierarchy')
      .insert(batch);
    
    if (!error) {
      fixedCount += batch.length;
      console.log(`   ✅ Inserted ${Math.min(i + 100, inserts.length)}/${inserts.length}...`);
    } else {
      console.error(`   ❌ Error inserting batch ${i}-${i + 100}:`, error);
      // Try individual inserts for this batch
      for (const item of batch) {
        const { error: singleError } = await supabase
          .from('agent_hierarchy')
          .insert(item);
        if (!singleError) {
          fixedCount++;
        } else {
          // If duplicate associate_id, try to update existing record
          if (singleError.code === '23505') {
            const { error: updateError } = await supabase
              .from('agent_hierarchy')
              .update({
                agent_email: item.agent_email,
                mga_name: item.mga_name,
                rga_name: item.rga_name,
              })
              .eq('agent_associate_id', item.agent_associate_id);
            if (!updateError) {
              fixedCount++;
              console.log(`   ✅ Updated existing record for associate_id ${item.agent_associate_id}`);
            }
          } else {
            console.error(`   ❌ Failed to insert ${item.agent_email}:`, singleError);
          }
        }
      }
    }
  }

  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total agents processed: ${allEmails.length}`);
  console.log(`   Fixed/Updated: ${fixedCount} agents`);
  console.log(`   Skipped (no changes needed): ${skippedCount} agents`);
  console.log(`   Still missing: ${missingCount} agents`);
  console.log(`\n✅ Done!`);
}

fixMissingHierarchy().catch(console.error);
