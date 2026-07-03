// Insert test usage data for current week
const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function insertTestData() {
  console.log('🔧 Inserting test usage data for current week...\n');
  
  try {
    const sql = neon(DATABASE_URL);
    
    // Calculate current week (Sunday to Saturday)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    console.log(`📅 Current week: ${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}\n`);
    
    // Insert test record for cnsysop
    console.log('📝 Inserting test data for cnsysop@aoglobelife.com...');
    
    const result = await sql`
      INSERT INTO weekly_usage_stats (
        agent_email,
        agent_name,
        week_start_date,
        week_end_date,
        total_logins,
        unique_login_days,
        total_online_minutes,
        vdp_connects_received,
        vdp_total_minutes,
        total_dials_made,
        total_call_minutes,
        appointments_scheduled,
        sales_made,
        total_alp
      ) VALUES (
        'cnsysop@aoglobelife.com',
        'Michael Mandella',
        ${weekStart.toISOString().split('T')[0]},
        ${weekEnd.toISOString().split('T')[0]},
        5,
        3,
        120,
        10,
        45,
        25,
        30,
        3,
        2,
        1200.00
      )
      ON CONFLICT (agent_email, week_start_date) 
      DO UPDATE SET
        total_logins = EXCLUDED.total_logins,
        unique_login_days = EXCLUDED.unique_login_days,
        total_online_minutes = EXCLUDED.total_online_minutes,
        vdp_connects_received = EXCLUDED.vdp_connects_received,
        vdp_total_minutes = EXCLUDED.vdp_total_minutes,
        total_dials_made = EXCLUDED.total_dials_made,
        total_call_minutes = EXCLUDED.total_call_minutes,
        appointments_scheduled = EXCLUDED.appointments_scheduled,
        sales_made = EXCLUDED.sales_made,
        total_alp = EXCLUDED.total_alp,
        updated_at = NOW()
      RETURNING *;
    `;
    
    console.log('✅ Test data inserted:\n');
    console.table(result);
    
    // Verify it's there
    const verify = await sql`
      SELECT * FROM weekly_usage_stats
      WHERE week_start_date = ${weekStart.toISOString().split('T')[0]}
      ORDER BY agent_email;
    `;
    
    console.log(`\n📊 Current week records: ${verify.length}`);
    console.log('\n✅ Usage report should now show data!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

insertTestData();






