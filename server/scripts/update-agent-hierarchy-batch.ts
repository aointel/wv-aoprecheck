/**
 * Batch update agent_hierarchy from customers and CSV file
 * Processes updates in batches to avoid timeouts and memory issues
 */

import { supabaseAdmin } from '../supabase';
import * as fs from 'fs';
import * as path from 'path';

const BATCH_SIZE = 100; // Process 100 records at a time
const CSV_FILE_PATH = path.join(process.cwd(), 'Producer List 1.2.26.csv');

interface CSVProducer {
  'Associate ID': string;
  'Executive Producer': string; // MGA
  'Chief Executive Producer': string; // RGA
  'Company Email': string;
  'Personal Email': string;
  'Phone': string;
  'Agent': string; // Agent name
}

async function updateAgentHierarchyBatch() {
  console.log('🚀 Starting batch update of agent_hierarchy...\n');

  try {
    // Step 1: Update existing records from customers table (primary source)
    console.log('📋 Step 1: Updating existing records from customers table...');
    await updateFromCustomers();
    
    // Step 2: Update existing records with MGA/RGA data from producerlist
    console.log('\n📋 Step 2: Updating MGA/RGA data from producerlist...');
    await updateFromProducerlist();
    
    // Step 3: Add missing agents from customers table
    console.log('\n📋 Step 3: Adding missing agents from customers table...');
    await addMissingFromCustomers();
    
    // Step 4: Add missing agents from producerlist
    console.log('\n📋 Step 4: Adding missing agents from producerlist...');
    await addMissingFromProducerlist();
    
    // Step 5: Update MGA/RGA associate_ids
    console.log('\n📋 Step 5: Refreshing MGA/RGA associate_ids...');
    await refreshMgaRgaAssociateIds();
    
    // Summary
    console.log('\n✅ Batch update completed!');
    await printSummary();
    
  } catch (error) {
    console.error('❌ Error during batch update:', error);
    throw error;
  }
}

async function updateFromCustomers() {
  // Get all customers with associate_id
  const { data: customers, error: fetchError } = await supabaseAdmin
    .from('customers')
    .select('associate_id, first_name, last_name, company_email, personal_email')
    .not('associate_id', 'is', null)
    .or('company_email.not.is.null,personal_email.not.is.null');
  
  if (fetchError) {
    console.error('❌ Error fetching customers:', fetchError);
    return;
  }
  
  if (!customers || customers.length === 0) {
    console.log('⚠️ No customers found');
    return;
  }
  
  console.log(`📊 Found ${customers.length} customers to process`);
  
  // Process in batches
  let updated = 0;
  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);
    console.log(`  Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(customers.length / BATCH_SIZE)} (${batch.length} records)...`);
    
    for (const customer of batch) {
      const agentName = customer.first_name && customer.last_name 
        ? `${customer.first_name} ${customer.last_name}`.trim()
        : null;
      const agentEmail = customer.company_email || customer.personal_email;
      
      if (!agentEmail) continue;
      
      // Update agent_hierarchy
      const { error: updateError } = await supabaseAdmin
        .from('agent_hierarchy')
        .update({
          agent_name: agentName || undefined,
          agent_email: agentEmail.toLowerCase().trim(),
          updated_at: new Date().toISOString()
        })
        .or(`agent_associate_id.eq.${customer.associate_id},agent_email.eq.${agentEmail.toLowerCase().trim()}`);
      
      if (updateError) {
        console.warn(`  ⚠️ Error updating customer ${customer.associate_id}:`, updateError.message);
      } else {
        updated++;
      }
    }
  }
  
  console.log(`✅ Updated ${updated} records from customers table`);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function loadProducersFromCSV(): CSVProducer[] {
  console.log(`📄 Reading CSV file: ${CSV_FILE_PATH}`);
  
  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`❌ CSV file not found: ${CSV_FILE_PATH}`);
    return [];
  }
  
  const csvContent = fs.readFileSync(CSV_FILE_PATH, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    console.error('❌ CSV file is empty or has no data rows');
    return [];
  }
  
  // Parse header
  const header = parseCSVLine(lines[0]);
  const producers: CSVProducer[] = [];
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    if (values.length < header.length) continue;
    
    const producer: any = {};
    header.forEach((col, index) => {
      producer[col] = values[index] || '';
    });
    
    // Only include records with Associate ID
    if (producer['Associate ID'] && producer['Associate ID'] !== '0' && producer['Associate ID'].trim() !== '') {
      producers.push(producer as CSVProducer);
    }
  }
  
  console.log(`✅ Loaded ${producers.length} producers from CSV`);
  return producers;
}

async function updateFromProducerlist() {
  // Load producers from CSV file
  const producers = loadProducersFromCSV();
  
  if (producers.length === 0) {
    console.log('⚠️ No producers found in CSV');
    return;
  }
  
  console.log(`📊 Found ${producers.length} producers to process from CSV`);
  
  // Create a map of agent names to associate IDs for MGA/RGA lookup
  const nameToAssociateIdMap = new Map<string, string>();
  producers.forEach(p => {
    const associateId = p['Associate ID'].trim();
    const agentName = p['Agent']?.trim();
    if (associateId && agentName) {
      nameToAssociateIdMap.set(agentName.toLowerCase(), associateId);
    }
  });
  
  // Process in batches
  let updated = 0;
  for (let i = 0; i < producers.length; i += BATCH_SIZE) {
    const batch = producers.slice(i, i + BATCH_SIZE);
    console.log(`  Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(producers.length / BATCH_SIZE)} (${batch.length} records)...`);
    
    for (const producer of batch) {
      const associateId = producer['Associate ID'].trim();
      const agentName = producer['Agent']?.trim();
      const agentEmail = producer['Company Email']?.toLowerCase().trim();
      const mgaName = producer['Executive Producer']?.trim();
      const rgaName = producer['Chief Executive Producer']?.trim();
      
      if (!associateId || associateId === '0' || !agentEmail) continue;
      
      // Look up MGA/RGA associate_ids from the CSV map
      let mgaAssociateId = null;
      let rgaAssociateId = null;
      
      if (mgaName && mgaName !== '0') {
        mgaAssociateId = nameToAssociateIdMap.get(mgaName.toLowerCase()) || null;
      }
      
      if (rgaName && rgaName !== '0') {
        rgaAssociateId = nameToAssociateIdMap.get(rgaName.toLowerCase()) || null;
      }
      
      // Update agent_hierarchy
      const updateData: any = {
        agent_name: agentName || undefined,
        agent_email: agentEmail,
        mga_name: mgaName && mgaName !== '0' ? mgaName : undefined,
        rga_name: rgaName && rgaName !== '0' ? rgaName : undefined,
        updated_at: new Date().toISOString()
      };
      
      if (mgaAssociateId) updateData.mga_associate_id = parseInt(mgaAssociateId);
      if (rgaAssociateId) updateData.rga_associate_id = parseInt(rgaAssociateId);
      
      const { error: updateError } = await supabaseAdmin
        .from('agent_hierarchy')
        .update(updateData)
        .or(`agent_associate_id.eq.${associateId},agent_email.eq.${agentEmail}`);
      
      if (updateError) {
        console.warn(`  ⚠️ Error updating producer ${associateId}:`, updateError.message);
      } else {
        updated++;
      }
    }
  }
  
  console.log(`✅ Updated ${updated} records from CSV`);
}

async function addMissingFromCustomers() {
  // Get all customers with associate_id
  const { data: customers, error: fetchError } = await supabaseAdmin
    .from('customers')
    .select('associate_id, first_name, last_name, company_email, personal_email')
    .not('associate_id', 'is', null)
    .or('company_email.not.is.null,personal_email.not.is.null');
  
  if (fetchError) {
    console.error('❌ Error fetching customers:', fetchError);
    return;
  }
  
  if (!customers || customers.length === 0) {
    console.log('⚠️ No customers found');
    return;
  }
  
  // Filter to only @aoglobelife.com emails
  const validCustomers = customers.filter(c => {
    const email = (c.company_email || c.personal_email)?.toLowerCase().trim();
    return email && email.includes('@aoglobelife.com');
  });
  
  console.log(`📊 Found ${validCustomers.length} valid customers to check`);
  
  // Get existing agent_hierarchy records
  const { data: existingAgents } = await supabaseAdmin
    .from('agent_hierarchy')
    .select('agent_associate_id, agent_email');
  
  const existingAssociateIds = new Set(existingAgents?.map(a => a.agent_associate_id) || []);
  const existingEmails = new Set(existingAgents?.map(a => a.agent_email?.toLowerCase().trim()) || []);
  
  // Filter to only missing agents
  const missingCustomers = validCustomers.filter(c => {
    const email = (c.company_email || c.personal_email)?.toLowerCase().trim();
    return !existingAssociateIds.has(c.associate_id) && !existingEmails.has(email);
  });
  
  console.log(`📊 Found ${missingCustomers.length} missing agents to add`);
  
  if (missingCustomers.length === 0) {
    console.log('✅ No missing agents to add');
    return;
  }
  
  // Process in batches
  let added = 0;
  for (let i = 0; i < missingCustomers.length; i += BATCH_SIZE) {
    const batch = missingCustomers.slice(i, i + BATCH_SIZE);
    console.log(`  Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(missingCustomers.length / BATCH_SIZE)} (${batch.length} records)...`);
    
    const insertData = batch.map(customer => {
      const agentName = customer.first_name && customer.last_name 
        ? `${customer.first_name} ${customer.last_name}`.trim()
        : 'Unknown';
      const agentEmail = (customer.company_email || customer.personal_email)?.toLowerCase().trim();
      
      return {
        agent_associate_id: customer.associate_id,
        agent_name: agentName,
        agent_email: agentEmail,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });
    
    // Use upsert to handle duplicates gracefully
    const { error: insertError } = await supabaseAdmin
      .from('agent_hierarchy')
      .upsert(insertData, { onConflict: 'agent_associate_id' });
    
    if (insertError) {
      console.warn(`  ⚠️ Error upserting batch:`, insertError.message);
    } else {
      added += batch.length;
    }
  }
  
  console.log(`✅ Added ${added} new agents from customers table`);
}

async function addMissingFromProducerlist() {
  // Load producers from CSV file
  const producers = loadProducersFromCSV();
  
  if (producers.length === 0) {
    console.log('⚠️ No producers found in CSV');
    return;
  }
  
  // Filter to only @aoglobelife.com emails
  const validProducers = producers.filter(p => {
    const email = p['Company Email']?.toLowerCase().trim();
    return email && email.includes('@aoglobelife.com');
  });
  
  console.log(`📊 Found ${validProducers.length} valid producers to check`);
  
  // Get existing agent_hierarchy records
  const { data: existingAgents } = await supabaseAdmin
    .from('agent_hierarchy')
    .select('agent_associate_id, agent_email');
  
  const existingAssociateIds = new Set(existingAgents?.map(a => a.agent_associate_id?.toString()) || []);
  const existingEmails = new Set(existingAgents?.map(a => a.agent_email?.toLowerCase().trim()) || []);
  
  // Create a map of agent names to associate IDs for MGA/RGA lookup
  const nameToAssociateIdMap = new Map<string, string>();
  producers.forEach(p => {
    const associateId = p['Associate ID'].trim();
    const agentName = p['Agent']?.trim();
    if (associateId && agentName) {
      nameToAssociateIdMap.set(agentName.toLowerCase(), associateId);
    }
  });
  
  // Filter to only missing agents
  const missingProducers = validProducers.filter(p => {
    const associateId = p['Associate ID'].trim();
    const email = p['Company Email']?.toLowerCase().trim();
    return !existingAssociateIds.has(associateId) && !existingEmails.has(email);
  });
  
  console.log(`📊 Found ${missingProducers.length} missing agents to add`);
  
  if (missingProducers.length === 0) {
    console.log('✅ No missing agents to add');
    return;
  }
  
  // Process in batches
  let added = 0;
  for (let i = 0; i < missingProducers.length; i += BATCH_SIZE) {
    const batch = missingProducers.slice(i, i + BATCH_SIZE);
    console.log(`  Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(missingProducers.length / BATCH_SIZE)} (${batch.length} records)...`);
    
    const insertData = batch.map(producer => {
      const associateId = producer['Associate ID'].trim();
      const agentName = producer['Agent']?.trim() || 'Unknown';
      const agentEmail = producer['Company Email']?.toLowerCase().trim();
      const mgaName = producer['Executive Producer']?.trim();
      const rgaName = producer['Chief Executive Producer']?.trim();
      
      // Look up MGA/RGA associate_ids from the CSV map
      let mgaAssociateId = null;
      let rgaAssociateId = null;
      
      if (mgaName && mgaName !== '0') {
        mgaAssociateId = nameToAssociateIdMap.get(mgaName.toLowerCase()) || null;
      }
      
      if (rgaName && rgaName !== '0') {
        rgaAssociateId = nameToAssociateIdMap.get(rgaName.toLowerCase()) || null;
      }
      
      return {
        agent_associate_id: parseInt(associateId),
        agent_name: agentName,
        agent_email: agentEmail,
        mga_name: mgaName && mgaName !== '0' ? mgaName : null,
        rga_name: rgaName && rgaName !== '0' ? rgaName : null,
        mga_associate_id: mgaAssociateId ? parseInt(mgaAssociateId) : null,
        rga_associate_id: rgaAssociateId ? parseInt(rgaAssociateId) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });
    
    // Use upsert to handle duplicates gracefully
    const { error: insertError } = await supabaseAdmin
      .from('agent_hierarchy')
      .upsert(insertData, { onConflict: 'agent_associate_id' });
    
    if (insertError) {
      console.warn(`  ⚠️ Error upserting batch:`, insertError.message);
    } else {
      added += batch.length;
    }
  }
  
  console.log(`✅ Added ${added} new agents from CSV`);
}

async function refreshMgaRgaAssociateIds() {
  // Load producers from CSV to create lookup map
  const producers = loadProducersFromCSV();
  
  if (producers.length === 0) {
    console.log('⚠️ No producers found in CSV');
    return;
  }
  
  // Create a map of agent names to associate IDs for MGA/RGA lookup
  const nameToAssociateIdMap = new Map<string, string>();
  producers.forEach(p => {
    const associateId = p['Associate ID'].trim();
    const agentName = p['Agent']?.trim();
    if (associateId && agentName) {
      nameToAssociateIdMap.set(agentName.toLowerCase(), associateId);
    }
  });
  
  // Get all agent_hierarchy records with MGA/RGA names
  const { data: agents, error: fetchError } = await supabaseAdmin
    .from('agent_hierarchy')
    .select('id, mga_name, rga_name')
    .or('mga_name.not.is.null,rga_name.not.is.null');
  
  if (fetchError) {
    console.error('❌ Error fetching agents:', fetchError);
    return;
  }
  
  if (!agents || agents.length === 0) {
    console.log('⚠️ No agents with MGA/RGA data found');
    return;
  }
  
  console.log(`📊 Found ${agents.length} agents to refresh MGA/RGA associate_ids`);
  
  // Process in batches
  let updated = 0;
  for (let i = 0; i < agents.length; i += BATCH_SIZE) {
    const batch = agents.slice(i, i + BATCH_SIZE);
    console.log(`  Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(agents.length / BATCH_SIZE)} (${batch.length} records)...`);
    
    for (const agent of batch) {
      let mgaAssociateId = null;
      let rgaAssociateId = null;
      
      if (agent.mga_name) {
        const mgaNameLower = agent.mga_name.toLowerCase().trim();
        // Look up from CSV map
        mgaAssociateId = nameToAssociateIdMap.get(mgaNameLower) || null;
      }
      
      if (agent.rga_name) {
        const rgaNameLower = agent.rga_name.toLowerCase().trim();
        // Look up from CSV map
        rgaAssociateId = nameToAssociateIdMap.get(rgaNameLower) || null;
      }
      
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      if (mgaAssociateId !== null) updateData.mga_associate_id = parseInt(mgaAssociateId);
      if (rgaAssociateId !== null) updateData.rga_associate_id = parseInt(rgaAssociateId);
      
      const { error: updateError } = await supabaseAdmin
        .from('agent_hierarchy')
        .update(updateData)
        .eq('id', agent.id);
      
      if (updateError) {
        console.warn(`  ⚠️ Error updating agent ${agent.id}:`, updateError.message);
      } else {
        updated++;
      }
    }
  }
  
  console.log(`✅ Refreshed MGA/RGA associate_ids for ${updated} agents`);
}

async function printSummary() {
  const { data: stats } = await supabaseAdmin
    .from('agent_hierarchy')
    .select('*', { count: 'exact', head: false });
  
  const total = stats?.length || 0;
  
  const { count: withMga } = await supabaseAdmin
    .from('agent_hierarchy')
    .select('*', { count: 'exact', head: true })
    .not('mga_name', 'is', null);
  
  const { count: withRga } = await supabaseAdmin
    .from('agent_hierarchy')
    .select('*', { count: 'exact', head: true })
    .not('rga_name', 'is', null);
  
  const { count: withBoth } = await supabaseAdmin
    .from('agent_hierarchy')
    .select('*', { count: 'exact', head: true })
    .not('mga_name', 'is', null)
    .not('rga_name', 'is', null);
  
  console.log('\n📊 Summary:');
  console.log(`  Total agents: ${total}`);
  console.log(`  Agents with MGA: ${withMga || 0}`);
  console.log(`  Agents with RGA: ${withRga || 0}`);
  console.log(`  Agents with both MGA and RGA: ${withBoth || 0}`);
}

// Run if executed directly
updateAgentHierarchyBatch()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

export { updateAgentHierarchyBatch };
