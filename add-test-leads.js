import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function addTestLeads() {
  try {
    console.log('🔥 Adding test leads for Call Connector Pro...');
    
    const testLeads = [
      {
        firstname: 'John',
        lastname: 'Smith',
        phone: '+15551234567',
        taalk_state: 'TX',
        taalk_market: 'Veteran',
        taalk_leadid: 'TEST001',
        taalk_groupcode: 'GRP001',
        user_email: 'cnsysop@aoglobelife.com'
      },
      {
        firstname: 'Sarah',
        lastname: 'Johnson',
        phone: '+15551234568',
        taalk_state: 'CA',
        taalk_market: 'Veteran',
        taalk_leadid: 'TEST002',
        taalk_groupcode: 'GRP001',
        user_email: 'cnsysop@aoglobelife.com'
      },
      {
        firstname: 'Michael',
        lastname: 'Davis',
        phone: '+15551234569',
        taalk_state: 'FL',
        taalk_market: 'Veteran',
        taalk_leadid: 'TEST003',
        taalk_groupcode: 'GRP001',
        user_email: 'cnsysop@aoglobelife.com'
      },
      {
        firstname: 'Lisa',
        lastname: 'Wilson',
        phone: '+15551234570',
        taalk_state: 'NY',
        taalk_market: 'Veteran',
        taalk_leadid: 'TEST004',
        taalk_groupcode: 'GRP001',
        user_email: 'cnsysop@aoglobelife.com'
      },
      {
        firstname: 'Robert',
        lastname: 'Brown',
        phone: '+15551234571',
        taalk_state: 'TX',
        taalk_market: 'Veteran',
        taalk_leadid: 'TEST005',
        taalk_groupcode: 'GRP001',
        user_email: 'cnsysop@aoglobelife.com'
      }
    ];
    
    let imported = 0;
    for (const lead of testLeads) {
      try {
        await pool.query(`
          INSERT INTO "Taalk2CN" (
            firstname, lastname, phone, taalk_state, taalk_market,
            taalk_leadid, taalk_groupcode, user_email
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8
          )
        `, [
          lead.firstname, lead.lastname, lead.phone,
          lead.taalk_state, lead.taalk_market,
          lead.taalk_leadid, lead.taalk_groupcode, lead.user_email
        ]);
        imported++;
        console.log(`✅ Added test lead: ${lead.firstname} ${lead.lastname} (${lead.phone})`);
      } catch (error) {
        console.error(`❌ Error adding ${lead.firstname} ${lead.lastname}:`, error.message);
      }
    }
    
    console.log(`🎉 Added ${imported} test leads for Call Connector Pro!`);
    
    // Verify the leads were added
    const result = await pool.query(`
      SELECT COUNT(*) as total FROM "Taalk2CN" WHERE user_email = 'cnsysop@aoglobelife.com'
    `);
    console.log(`📊 Total leads for cnsysop@aoglobelife.com: ${result.rows[0].total}`);
    
    pool.end();
  } catch (error) {
    console.error('❌ Failed to add test leads:', error);
    pool.end();
  }
}

addTestLeads(); 