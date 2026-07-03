import pkg from 'pg';
const { Pool } = pkg;

// Database configuration
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

async function setupQMMGAMapping() {
  try {
    console.log('🚀 Setting up Quality Manager MGA Mapping System...');

    // 1. Create MGA teams table
    console.log('🔧 Creating MGA teams table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mga_teams_from_producerlist (
        id SERIAL PRIMARY KEY,
        mga_name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 2. Create QM assignments table
    console.log('🔧 Creating QM assignments table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qm_mga_assignments (
        id SERIAL PRIMARY KEY,
        qm_email VARCHAR(255) NOT NULL,
        mga_name VARCHAR(255) NOT NULL,
        assigned_at TIMESTAMP DEFAULT NOW(),
        assigned_by VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        UNIQUE(qm_email, mga_name)
      );
    `);

    // 3. Get MGA teams from producers table
    console.log('📊 Fetching MGA teams from producers table...');
    const mgaResult = await pool.query(`
      SELECT DISTINCT mga 
      FROM producers 
      WHERE mga IS NOT NULL 
        AND mga != ''
        AND mga != 'null'
    `);
    
    const uniqueMgaTeams = mgaResult.rows.map(row => row.mga).filter(Boolean);
    console.log(`✅ Found ${uniqueMgaTeams.length} unique MGA teams`);

    // 4. Insert MGA teams
    console.log('📝 Inserting MGA teams...');
    for (const team of uniqueMgaTeams) {
      await pool.query(`
        INSERT INTO mga_teams_from_producerlist (mga_name) 
        VALUES ($1) 
        ON CONFLICT (mga_name) DO NOTHING
      `, [team]);
    }
    console.log(`✅ Inserted ${uniqueMgaTeams.length} MGA teams`);

    // 5. Assign tomanovichqm to specific teams only (not all 217!)
    console.log('👤 Setting up tomanovichqm assignments...');
    const tomanovichAssignments = [
      'JOSEPH TOMANOVICH',
      'MARIA LAGIOS', 
      'COLLIN DICKINSON',
      'GABRIELLE GARCIA',
      'GEORGE OSHEA'
    ];

    for (const team of tomanovichAssignments) {
      await pool.query(`
        INSERT INTO qm_mga_assignments (qm_email, mga_name, assigned_by) 
        VALUES ($1, $2, $3) 
        ON CONFLICT (qm_email, mga_name) 
        DO UPDATE SET 
          is_active = true,
          assigned_at = NOW(),
          assigned_by = $3
      `, ['tomanovichqm@aoglobelife.com', team, 'system']);
    }
    console.log(`✅ Assigned tomanovichqm to ${tomanovichAssignments.length} specific teams`);

    // 6. Create helper functions
    console.log('🔧 Creating helper functions...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION get_qm_assigned_teams(qm_email_param VARCHAR)
      RETURNS TABLE(mga_name VARCHAR) AS $$
      BEGIN
        RETURN QUERY
        SELECT qma.mga_name
        FROM qm_mga_assignments qma
        WHERE qma.qm_email = qm_email_param
          AND qma.is_active = true;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await pool.query(`
      CREATE OR REPLACE FUNCTION assign_qm_to_mga(
        qm_email_param VARCHAR,
        mga_name_param VARCHAR,
        assigned_by_param VARCHAR DEFAULT NULL
      )
      RETURNS BOOLEAN AS $$
      BEGIN
        INSERT INTO qm_mga_assignments (qm_email, mga_name, assigned_by)
        VALUES (qm_email_param, mga_name_param, assigned_by_param)
        ON CONFLICT (qm_email, mga_name) 
        DO UPDATE SET 
          is_active = true,
          assigned_at = NOW(),
          assigned_by = assigned_by_param;
        
        RETURN TRUE;
      EXCEPTION
        WHEN OTHERS THEN
          RETURN FALSE;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 7. Verify the setup
    console.log('🔍 Verifying setup...');
    const verifyResult = await pool.query(`
      SELECT mga_name 
      FROM qm_mga_assignments 
      WHERE qm_email = $1 AND is_active = true
    `, ['tomanovichqm@aoglobelife.com']);

    console.log(`✅ Verification successful: tomanovichqm assigned to ${verifyResult.rows.length} teams:`);
    verifyResult.rows.forEach(team => console.log(`   - ${team.mga_name}`));

    console.log('🎉 Quality Manager MGA Mapping System setup complete!');
    console.log('📊 Summary:');
    console.log(`   - ${uniqueMgaTeams.length} MGA teams from producerlist`);
    console.log(`   - tomanovichqm assigned to ${verifyResult.rows.length} specific teams`);
    console.log('   - Ready for proper RBAC filtering');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the setup
setupQMMGAMapping();
