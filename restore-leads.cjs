const fs = require('fs');
const csv = require('csv-parser');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function restoreLeads() {
  console.log('🔥 EMERGENCY RESTORE: Chris\'s 422 veteran leads');
  
  const leads = [];
  const csvFile = './attached_assets/aa58c8f1-0da0-4f9d-a42a-35cb25eeff26_1753815603305.csv';
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFile)
      .pipe(csv())
      .on('data', (row) => {
        leads.push(row);
      })
      .on('end', async () => {
        console.log(`📊 Found ${leads.length} leads to restore`);
        
        let restored = 0;
        for (const lead of leads) {
          try {
            const firstName = lead.firstName || '';
            const lastName = lead.lastName || '';
            const phone = lead.phone;
            
            if (phone && firstName && lastName) {
              await pool.query(`
                INSERT INTO veteran_leads (
                  first_name, last_name, phone, email, city, state, 
                  taalk_market, taalk_lead_source, taalk_state, taalk_lead_id, 
                  taalk_group_code, taalk_email, taalk_city, assigned_at, call_attempts, status
                ) VALUES (
                  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), 0, 'pending'
                )
              `, [
                firstName, lastName, phone, 
                lead.Taalk_Email || '',
                lead.Taalk_City || '',
                lead.Taalk_State || '',
                lead.Taalk_Market || 'Veteran',
                lead.Taalk_Lead_Source || '',
                lead.Taalk_State || '',
                lead.Taalk_LeadId || '',
                lead.Taalk_GroupCode || '',
                lead.Taalk_Email || '',
                lead.Taalk_City || ''
              ]);
              restored++;
              
              if (restored % 50 === 0) {
                console.log(`✅ Restored ${restored} leads...`);
              }
            }
          } catch (error) {
            console.error(`❌ Error restoring ${lead.firstName} ${lead.lastName}:`, error.message);
          }
        }
        
        const result = await pool.query('SELECT COUNT(*) as total FROM veteran_leads');
        console.log(`🎉 RESTORE COMPLETE! ${restored} leads restored. Total: ${result.rows[0].total}`);
        
        // Verify Kenneth is there
        const kenneth = await pool.query(`SELECT * FROM veteran_leads WHERE first_name ILIKE '%Kenneth%' LIMIT 1`);
        if (kenneth.rows.length > 0) {
          console.log('✅ Kenneth J. Kislak CONFIRMED in database');
        }
        
        pool.end();
        resolve(restored);
      })
      .on('error', reject);
  });
}

restoreLeads().catch(console.error);