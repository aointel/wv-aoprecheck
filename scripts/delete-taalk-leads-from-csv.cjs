/**
 * DELETE LEADS FROM TALK SYSTEM
 * 
 * This script reads LeadIDs from a CSV file and deletes matching records
 * from the Taalk system using the Taalk API.
 * 
 * Usage:
 *   node scripts/delete-taalk-leads-from-csv.cjs "C:\Users\mmand\OneDrive\Documents\vn125leads.csv"
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

// Taalk API Configuration
const TAALK_API_KEY = process.env.TAALK_API_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
const TAALK_API_BASE = "https://api.taalk.ai/api";
const TAALK_DB = "michaelmandella";

// Supabase config (to verify which leads were actually deleted from masterlead)
let SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
let SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

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
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Delete a lead from Taalk API
 * Note: Taalk API may use different endpoints - we'll try common patterns
 */
async function deleteLeadFromTaalk(taalkLeadId) {
  try {
    // Try DELETE /api/leads/{leadId}?db=michaelmandella
    const deleteUrl = `${TAALK_API_BASE}/leads/${taalkLeadId}?db=${TAALK_DB}`;
    
    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${TAALK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      return { success: true, status: response.status };
    } else if (response.status === 404) {
      // Lead doesn't exist in Taalk - that's okay
      return { success: true, status: 404, message: 'Lead not found in Taalk (already deleted or never existed)' };
    } else {
      const errorText = await response.text();
      return { success: false, status: response.status, error: errorText };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Alternative: Try to mark lead as deleted/resolved in Taalk
 * Some systems use a "soft delete" approach
 */
async function markLeadAsDeletedInTaalk(taalkLeadId) {
  try {
    // Try PUT/PATCH to update lead status
    const updateUrl = `${TAALK_API_BASE}/leads/${taalkLeadId}?db=${TAALK_DB}`;
    
    const response = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${TAALK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'deleted',
        deleted: true,
        resolved: true
      })
    });

    if (response.ok) {
      return { success: true, status: response.status };
    } else if (response.status === 404) {
      return { success: true, status: 404, message: 'Lead not found in Taalk' };
    } else {
      const errorText = await response.text();
      return { success: false, status: response.status, error: errorText };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function deleteLeadsFromTaalk(csvFilePath) {
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
    
    console.log(`\n⚠️  WARNING: This will attempt to delete ${leadIds.length} leads from Taalk system`);
    console.log(`⚠️  This action cannot be undone!`);
    console.log(`\n📝 Note: If a lead doesn't exist in Taalk, it will be skipped (404 response is OK)`);
    
    const leadsToDelete = leadIds;
    
    // Delete in batches
    const BATCH_SIZE = 50; // Smaller batches for API calls
    let deletedCount = 0;
    let notFoundCount = 0;
    let failedCount = 0;
    const failedIds = [];
    
    console.log(`\n🗑️  Starting Taalk deletion in batches of ${BATCH_SIZE}...`);
    
    for (let i = 0; i < leadsToDelete.length; i += BATCH_SIZE) {
      const batch = leadsToDelete.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      
      console.log(`\n📦 Processing batch ${batchNum}/${Math.ceil(leadIds.length / BATCH_SIZE)} (${batch.length} leads)...`);
      
      // Process batch sequentially with delays to avoid rate limiting
      const results = [];
      for (const leadId of batch) {
        // Try DELETE first
        let result = await deleteLeadFromTaalk(leadId);
        
        // If DELETE doesn't work (404 or method not allowed), try PATCH to mark as deleted
        if (!result.success && result.status !== 404) {
          // Wait a bit before retry
          await new Promise(resolve => setTimeout(resolve, 200));
          result = await markLeadAsDeletedInTaalk(leadId);
        }
        
        results.push({ status: 'fulfilled', value: { leadId, result } });
        
        // Rate limit: delay between each request
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Count results
      for (const settled of results) {
        if (settled.status === 'fulfilled') {
          const { leadId, result } = settled.value;
          if (result.success) {
            if (result.status === 404) {
              notFoundCount++;
            } else {
              deletedCount++;
            }
          } else {
            // Check if it's a rate limit error
            if (result.error && result.error.includes('Too many requests')) {
              console.log(`   ⚠️  Rate limited for ${leadId}, waiting 5 seconds...`);
              await new Promise(resolve => setTimeout(resolve, 5000));
              // Retry once after rate limit
              const retryResult = await deleteLeadFromTaalk(leadId);
              if (retryResult.success) {
                deletedCount++;
              } else {
                failedCount++;
                failedIds.push({ leadId, error: retryResult.error || retryResult.message });
              }
            } else {
              failedCount++;
              failedIds.push({ leadId, error: result.error || result.message });
              console.log(`   ❌ Failed to delete ${leadId}: ${result.error || result.message}`);
            }
          }
        } else {
          failedCount++;
          failedIds.push({ leadId: 'unknown', error: settled.reason?.message || 'Unknown error' });
        }
      }
      
      console.log(`   ✅ Batch ${batchNum} complete: ${deletedCount} deleted, ${notFoundCount} not found, ${failedCount} failed`);
      
      // Longer delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < leadsToDelete.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between batches
      }
    }
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total LeadIDs in CSV: ${leadIds.length}`);
    console.log(`   Successfully deleted from Taalk: ${deletedCount}`);
    console.log(`   Not found in Taalk (404 - OK): ${notFoundCount}`);
    console.log(`   Failed to delete: ${failedCount}`);
    
    if (failedCount > 0) {
      console.log(`\n❌ Failed LeadIDs (first 20):`);
      failedIds.slice(0, 20).forEach(({ leadId, error }) => {
        console.log(`   - ${leadId}: ${error}`);
      });
      if (failedIds.length > 20) {
        console.log(`   ... and ${failedIds.length - 20} more`);
      }
    }
    
    if (deletedCount + notFoundCount === leadsToDelete.length) {
      console.log(`\n✅ All leads processed successfully!`);
      console.log(`   (${deletedCount} deleted, ${notFoundCount} were not in Taalk system)`);
    } else {
      console.log(`\n⚠️  Some leads could not be processed. Please review the errors above.`);
      console.log(`   Processed: ${deletedCount + notFoundCount} / ${leadsToDelete.length}`);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Main execution
const csvFilePath = process.argv[2];

if (!csvFilePath) {
  console.error('❌ Usage: node scripts/delete-taalk-leads-from-csv.cjs <path-to-csv-file>');
  console.error('   Example: node scripts/delete-taalk-leads-from-csv.cjs "C:\\Users\\mmand\\OneDrive\\Documents\\vn125leads.csv"');
  process.exit(1);
}

const fullPath = path.isAbsolute(csvFilePath) 
  ? csvFilePath 
  : path.join(__dirname, '..', csvFilePath);

if (!fs.existsSync(fullPath)) {
  console.error(`❌ CSV file not found: ${fullPath}`);
  process.exit(1);
}

deleteLeadsFromTaalk(fullPath)
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
