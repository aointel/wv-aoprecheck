import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://chjcwolkdwhpgapgvvby.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function uploadChrisLeads() {
  try {
    console.log('🔄 Starting Chris Lafond leads upload to Supabase Taalk2CN...');
    
    const csvFilePath = './attached_assets/aa58c8f1-0da0-4f9d-a42a-35cb25eeff26_1753807027198.csv';
    
    if (!fs.existsSync(csvFilePath)) {
      console.error('❌ CSV file not found:', csvFilePath);
      return;
    }
    
    // Read and parse CSV file manually
    const csvContent = fs.readFileSync(csvFilePath, 'utf8');
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    
    console.log('📋 CSV headers:', headers.slice(0, 10));
    
    const leads = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Parse CSV line with proper quote handling
      const values = [];
      let currentValue = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim()); // Add the last value
      
      // Create row object
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      // Skip rows without essential data
      if (!row.firstName || !row.phone) continue;
      
      const lead = {
        firstname: row.firstName?.trim() || '',
        lastname: row.lastName?.trim() || '',
        phone: row.phone?.trim() || '',
        email: row.Taalk_Email?.trim() || '',
        address: row.Taalk_Address?.trim() || '',
        city: row.Taalk_City?.trim() || '',
        state: row.Taalk_State?.trim() || '',
        zip: row.Taalk_Zip?.trim() || '',
        taalk_market: row.Taalk_Market?.trim() || 'Veteran',
        taalk_state: row.Taalk_State?.trim() || '',
        taalk_leadid: row.Taalk_LeadId?.trim() || '',
        taalk_groupcode: row.Taalk_GroupCode?.trim() || '',
        taalk_email: row.Taalk_Email?.trim() || '',
        CNEmail: 'chrislafond@aoglobelife.com', // Set Chris as owner
        status: 'pending',
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString()
      };
      
      leads.push(lead);
    }
    
    console.log(`📊 Parsed ${leads.length} leads from CSV`);
    
    if (leads.length === 0) {
      console.log('❌ No valid leads found in CSV');
      return;
    }
    
    console.log('Sample lead:', {
      name: `${leads[0].firstname} ${leads[0].lastname}`,
      phone: leads[0].phone,
      market: leads[0].taalk_market,
      state: leads[0].taalk_state
    });
    
    // Check if table exists and clear existing Chris leads
    console.log('🧹 Clearing existing Chris leads from Supabase...');
    const { error: deleteError } = await supabase
      .from('Taalk2CN')
      .delete()
      .eq('CNEmail', 'chrislafond@aoglobelife.com');
    
    if (deleteError && deleteError.code !== '42P01') {
      console.log('⚠️ Delete warning:', deleteError.message);
    }
    
    // Upload in batches of 100
    const batchSize = 100;
    let totalUploaded = 0;
    
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      
      console.log(`📤 Uploading batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(leads.length/batchSize)} (${batch.length} leads)...`);
      
      const { data, error } = await supabase
        .from('Taalk2CN')
        .insert(batch);
      
      if (error) {
        console.error(`❌ Error uploading batch ${Math.floor(i/batchSize) + 1}:`, error);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        continue;
      }
      
      totalUploaded += batch.length;
      console.log(`✅ Uploaded batch ${Math.floor(i/batchSize) + 1} successfully`);
    }
    
    console.log(`🎉 Upload complete! ${totalUploaded} leads uploaded to Supabase for Chris`);
    
    // Verify upload
    const { data: verifyData, error: verifyError } = await supabase
      .from('Taalk2CN')
      .select('id, firstname, lastname, phone, taalk_market')
      .eq('CNEmail', 'chrislafond@aoglobelife.com')
      .limit(5);
    
    if (!verifyError && verifyData) {
      console.log(`✅ Verification: ${verifyData.length} sample leads found for Chris in Supabase`);
      verifyData.forEach(lead => {
        console.log(`  - ${lead.firstname} ${lead.lastname} (${lead.phone}) - ${lead.taalk_market}`);
      });
    }
    
    // Get total count
    const { count, error: countError } = await supabase
      .from('Taalk2CN')
      .select('*', { count: 'exact', head: true })
      .eq('CNEmail', 'chrislafond@aoglobelife.com');
    
    if (!countError) {
      console.log(`📊 Total Chris leads in Supabase: ${count}`);
    }
    
  } catch (error) {
    console.error('❌ Upload failed:', error);
  }
}

uploadChrisLeads();