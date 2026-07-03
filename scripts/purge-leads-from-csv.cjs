/**
 * PURGE LEADS FROM MASTERLEAD
 * 
 * This script reads LeadIDs from a CSV file and deletes matching records
 * from the masterlead table using taalk_lead_id.
 * 
 * Usage:
 *   node scripts/purge-leads-from-csv.cjs server/All_Lead_logs_20251117174529702.csv
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from multiple possible locations
const envPaths = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '.env.local'),
  path.join(__dirname, '..', '.env.production'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    break;
  }
}

// Try to load from hardcoded-config.ts
let SUPABASE_URL = process.argv[3] || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
let SUPABASE_SERVICE_KEY = process.argv[4] || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// If not found, try to read from hardcoded-config.ts directly
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  const hardcodedConfigPath = path.join(__dirname, '..', 'server', 'hardcoded-config.ts');
  
  if (fs.existsSync(hardcodedConfigPath)) {
    try {
      const configContent = fs.readFileSync(hardcodedConfigPath, 'utf-8');
      
      // Extract SUPABASE_URL (simple regex match)
      const urlMatch = configContent.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/);
      if (urlMatch && !SUPABASE_URL) {
        SUPABASE_URL = urlMatch[1];
      }
      
      // Extract SUPABASE_SERVICE_KEY (simple regex match)
      const keyMatch = configContent.match(/SUPABASE_SERVICE_KEY:\s*['"]([^'"]+)['"]/);
      if (keyMatch && !SUPABASE_SERVICE_KEY) {
        SUPABASE_SERVICE_KEY = keyMatch[1];
      }
    } catch (e) {
      // Ignore if can't parse
    }
  }
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials.');
  console.error('   Options:');
  console.error('   1. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file');
  console.error('   2. Pass as arguments: node script.js <csv-file> <supabase-url> <service-key>');
  console.error('   3. Export as environment variables before running');
  console.error('   Example: VITE_SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." node script.js file.csv');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function purgeLeadsFromCSV(csvFilePath) {
  try {
    console.log(`📖 Reading CSV file: ${csvFilePath}`);
    
    // Read CSV file
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const lines = csvContent.trim().split('\n');
    
    // Skip header row and extract LeadIDs
    const leadIds = lines.slice(1)
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => String(line.trim())); // Convert to string for taalk_lead_id comparison
    
    console.log(`📊 Found ${leadIds.length} LeadIDs in CSV file`);
    
    if (leadIds.length === 0) {
      console.log('⚠️ No LeadIDs found in CSV file');
      return;
    }
    
    // Show first 10 and last 10 for verification
    console.log(`\n📋 First 10 LeadIDs:`, leadIds.slice(0, 10));
    console.log(`📋 Last 10 LeadIDs:`, leadIds.slice(-10));
    
    // Check how many exist in masterlead before deletion (batch the check to avoid "Header Too Large" error)
    console.log(`\n🔍 Checking how many leads exist in masterlead (in batches)...`);
    const CHECK_BATCH_SIZE = 500;
    const existingLeadIds = new Set();
    
    for (let i = 0; i < leadIds.length; i += CHECK_BATCH_SIZE) {
      const batch = leadIds.slice(i, i + CHECK_BATCH_SIZE);
      
      const { data: batchLeads, error: checkError } = await supabase
        .from('masterlead')
        .select('taalk_lead_id')
        .in('taalk_lead_id', batch);
      
      if (checkError) {
        console.error(`❌ Error checking batch ${Math.floor(i / CHECK_BATCH_SIZE) + 1}:`, checkError);
        continue;
      }
      
      if (batchLeads) {
        batchLeads.forEach(lead => existingLeadIds.add(lead.taalk_lead_id));
      }
      
      console.log(`✅ Checked batch ${Math.floor(i / CHECK_BATCH_SIZE) + 1}: Found ${batchLeads?.length || 0} leads (Total found so far: ${existingLeadIds.size})`);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    const existingCount = existingLeadIds.size;
    console.log(`\n✅ Found ${existingCount} matching leads in masterlead table`);
    console.log(`⚠️ ${leadIds.length - existingCount} LeadIDs from CSV do not exist in masterlead`);
    
    if (existingCount === 0) {
      console.log('ℹ️ No leads to delete');
      return;
    }
    
    // Ask for confirmation (in production, you might want to add a --yes flag)
    console.log(`\n⚠️  WARNING: This will delete ${existingCount} leads from masterlead table`);
    console.log(`⚠️  This action cannot be undone!`);
    
    // For safety, we'll delete in batches
    const BATCH_SIZE = 100;
    let deletedCount = 0;
    let failedCount = 0;
    
    console.log(`\n🗑️  Starting deletion in batches of ${BATCH_SIZE}...`);
    
    for (let i = 0; i < leadIds.length; i += BATCH_SIZE) {
      const batch = leadIds.slice(i, i + BATCH_SIZE);
      
      // Only delete leads that exist in masterlead
      const batchToDelete = batch.filter(id => existingLeadIds.has(id));
      
      if (batchToDelete.length === 0) {
        console.log(`⏭️  Batch ${Math.floor(i / BATCH_SIZE) + 1}: No leads to delete in this batch`);
        continue;
      }
      
      const { data, error } = await supabase
        .from('masterlead')
        .delete()
        .in('taalk_lead_id', batchToDelete);
      
      if (error) {
        console.error(`❌ Error deleting batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
        failedCount += batchToDelete.length;
      } else {
        deletedCount += batchToDelete.length;
        console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: Deleted ${batchToDelete.length} leads (Total: ${deletedCount}/${existingCount})`);
      }
      
      // Small delay between batches to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total LeadIDs in CSV: ${leadIds.length}`);
    console.log(`   Leads found in masterlead: ${existingCount}`);
    console.log(`   Successfully deleted: ${deletedCount}`);
    console.log(`   Failed to delete: ${failedCount}`);
    console.log(`   Not found in masterlead: ${leadIds.length - existingCount}`);
    
    if (deletedCount === existingCount) {
      console.log(`\n✅ All matching leads have been successfully purged!`);
    } else {
      console.log(`\n⚠️  Some leads could not be deleted. Please review the errors above.`);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Main execution
const csvFilePath = process.argv[2];

if (!csvFilePath) {
  console.error('❌ Usage: node scripts/purge-leads-from-csv.cjs <path-to-csv-file>');
  console.error('   Example: node scripts/purge-leads-from-csv.cjs server/All_Lead_logs_20251117174529702.csv');
  process.exit(1);
}

const fullPath = path.isAbsolute(csvFilePath) 
  ? csvFilePath 
  : path.join(__dirname, '..', csvFilePath);

if (!fs.existsSync(fullPath)) {
  console.error(`❌ CSV file not found: ${fullPath}`);
  process.exit(1);
}

purgeLeadsFromCSV(fullPath)
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

