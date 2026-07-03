import fs from 'fs';
import csv from 'csv-parser';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function importLeads() {
  try {
    console.log('🔥 Starting import of Chris\'s 422 veteran leads...');
    
    const leads = [];
    const csvFile = './attached_assets/aa58c8f1-0da0-4f9d-a42a-35cb25eeff26_1753815603305.csv';
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(csvFile)
        .pipe(csv())
        .on('data', (row) => {
          leads.push(row);
        })
        .on('end', async () => {
          console.log(`📊 Found ${leads.length} leads in CSV file`);
          
          let imported = 0;
          for (const lead of leads) {
            try {
              const firstName = lead.firstName || lead.first_name || '';
              const lastName = lead.lastName || lead.last_name || '';
              const phone = lead.phone;
              
              if (phone && firstName && lastName) {
                await pool.query(`
                  INSERT INTO veteran_leads (
                    first_name, last_name, phone, email, city, state, zip_code, address,
                    taalk_market, taalk_lead_source, taalk_state, taalk_leadid, taalk_groupcode,
                    taalk_email, taalk_city, taalk_zip, taalk_address, assigned_at, call_attempts, status
                  ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), 0, 'pending'
                  )
                  ON CONFLICT (phone) DO UPDATE SET
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    taalk_leadid = EXCLUDED.taalk_leadid
                `, [
                  firstName, lastName, phone, 
                  lead.Taalk_Email || lead.email || '',
                  lead.Taalk_City || lead.city || '',
                  lead.Taalk_State || lead.state || '',
                  lead.Taalk_Zip || lead.zip_code || '',
                  lead.Taalk_Address || lead.address || '',
                  lead.Taalk_Market || 'Veteran',
                  lead.Taalk_Lead_Source || '',
                  lead.Taalk_State || lead.state || '',
                  lead.Taalk_LeadId || '',
                  lead.Taalk_GroupCode || '',
                  lead.Taalk_Email || lead.email || '',
                  lead.Taalk_City || lead.city || '',
                  lead.Taalk_Zip || lead.zip_code || '',
                  lead.Taalk_Address || lead.address || ''
                ]);
                imported++;
                
                if (imported % 50 === 0) {
                  console.log(`✅ Imported ${imported} leads...`);
                }
              }
            } catch (error) {
              console.error(`❌ Error importing ${firstName} ${lastName}:`, error.message);
            }
          }
          
          const result = await pool.query('SELECT COUNT(*) as total FROM veteran_leads');
          console.log(`🎉 IMPORT COMPLETE! ${imported} leads imported. Total in database: ${result.rows[0].total}`);
          
          // Check for Kenneth J. Kislak specifically
          const kenneth = await pool.query(`SELECT * FROM veteran_leads WHERE first_name ILIKE '%Kenneth%' AND last_name ILIKE '%Kislak%' LIMIT 1`);
          if (kenneth.rows.length > 0) {
            console.log('✅ Kenneth J. Kislak found:', kenneth.rows[0].first_name, kenneth.rows[0].last_name, kenneth.rows[0].phone);
          } else {
            console.log('❌ Kenneth J. Kislak NOT found in database');
          }
          
          pool.end();
          resolve(imported);
        })
        .on('error', reject);
    });
  } catch (error) {
    console.error('❌ Import failed:', error);
    pool.end();
  }
}

importLeads();