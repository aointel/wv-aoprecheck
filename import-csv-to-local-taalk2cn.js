import fs from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

// Local PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function importCSVToLocal() {
  try {
    console.log('🔄 Importing Chris Lafond leads to local Taalk2CN table...');
    
    const csvFilePath = './attached_assets/aa58c8f1-0da0-4f9d-a42a-35cb25eeff26_1753807027198.csv';
    
    // Read and parse CSV file
    const csvContent = fs.readFileSync(csvFilePath, 'utf8');
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    
    console.log('📋 CSV headers found:', headers.slice(0, 10));
    
    // Clear existing Chris leads
    console.log('🧹 Clearing existing Chris leads from local database...');
    await pool.query('DELETE FROM "Taalk2CN" WHERE "CNEmail" = $1', ['chrislafond@aoglobelife.com']);
    
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
      values.push(currentValue.trim());
      
      // Create row object
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      // Skip rows without essential data
      if (!row.firstName || !row.phone) continue;
      
      leads.push({
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
        CNEmail: 'chrislafond@aoglobelife.com'
      });
    }
    
    console.log(`📊 Parsed ${leads.length} leads from CSV`);
    console.log('Sample lead:', `${leads[0].firstname} ${leads[0].lastname} (${leads[0].phone}) - ${leads[0].taalk_market}`);
    
    // Insert leads in batches
    const batchSize = 50;
    let totalInserted = 0;
    
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      
      console.log(`📤 Inserting batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(leads.length/batchSize)} (${batch.length} leads)...`);
      
      for (const lead of batch) {
        const query = `
          INSERT INTO "Taalk2CN" (
            user_email, firstname, lastname, phone, address, city, state, zip,
            taalk_market, taalk_state, taalk_leadid, taalk_groupcode, taalk_email, "CNEmail", status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `;
        
        const values = [
          'chrislafond@aoglobelife.com', lead.firstname, lead.lastname, lead.phone, lead.address,
          lead.city, lead.state, lead.zip, lead.taalk_market, lead.taalk_state,
          lead.taalk_leadid, lead.taalk_groupcode, lead.taalk_email, lead.CNEmail, 'pending'
        ];
        
        try {
          await pool.query(query, values);
          totalInserted++;
        } catch (error) {
          console.error(`❌ Error inserting lead ${lead.firstname} ${lead.lastname}:`, error.message);
        }
      }
      
      console.log(`✅ Batch ${Math.floor(i/batchSize) + 1} completed`);
    }
    
    console.log(`🎉 Import complete! ${totalInserted} leads imported for Chris`);
    
    // Verify import
    const result = await pool.query('SELECT COUNT(*) as count FROM "Taalk2CN" WHERE "CNEmail" = $1', ['chrislafond@aoglobelife.com']);
    console.log(`✅ Verification: ${result.rows[0].count} leads now in local database for Chris`);
    
    // Show sample leads
    const sample = await pool.query('SELECT firstname, lastname, phone, taalk_market FROM "Taalk2CN" WHERE "CNEmail" = $1 LIMIT 5', ['chrislafond@aoglobelife.com']);
    console.log('📋 Sample leads in database:');
    sample.rows.forEach(lead => {
      console.log(`  - ${lead.firstname} ${lead.lastname} (${lead.phone}) - ${lead.taalk_market}`);
    });
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await pool.end();
  }
}

importCSVToLocal();