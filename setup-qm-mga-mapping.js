import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupQMMGAMapping() {
  try {
    console.log('🚀 Setting up Quality Manager MGA Mapping System...');

    // 1. First, let's get all distinct MGA teams from producerlist
    console.log('📊 Fetching MGA teams from producerlist...');
    const { data: mgaTeams, error: mgaError } = await supabase
      .from('producerlist')
      .select('mga')
      .not('mga', 'is', null)
      .not('mga', 'eq', '')
      .not('mga', 'eq', 'null');

    if (mgaError) {
      console.error('❌ Error fetching MGA teams:', mgaError);
      return;
    }

    // Get unique MGA teams
    const uniqueMgaTeams = [...new Set(mgaTeams.map(item => item.mga))].filter(Boolean);
    console.log(`✅ Found ${uniqueMgaTeams.length} unique MGA teams`);

    // 2. Create the MGA teams table
    console.log('🔧 Creating MGA teams table...');
    const { error: createTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS mga_teams_from_producerlist (
          id SERIAL PRIMARY KEY,
          mga_name VARCHAR(255) NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (createTableError) {
      console.error('❌ Error creating MGA teams table:', createTableError);
    } else {
      console.log('✅ MGA teams table created');
    }

    // 3. Insert MGA teams
    console.log('📝 Inserting MGA teams...');
    const mgaTeamInserts = uniqueMgaTeams.map(team => ({
      mga_name: team
    }));

    const { error: insertMgaError } = await supabase
      .from('mga_teams_from_producerlist')
      .upsert(mgaTeamInserts, { onConflict: 'mga_name' });

    if (insertMgaError) {
      console.error('❌ Error inserting MGA teams:', insertMgaError);
    } else {
      console.log(`✅ Inserted ${mgaTeamInserts.length} MGA teams`);
    }

    // 4. Create QM assignments table
    console.log('🔧 Creating QM assignments table...');
    const { error: createQmTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS qm_mga_assignments (
          id SERIAL PRIMARY KEY,
          qm_email VARCHAR(255) NOT NULL,
          mga_name VARCHAR(255) NOT NULL,
          assigned_at TIMESTAMP DEFAULT NOW(),
          assigned_by VARCHAR(255),
          is_active BOOLEAN DEFAULT true,
          UNIQUE(qm_email, mga_name)
        );
      `
    });

    if (createQmTableError) {
      console.error('❌ Error creating QM assignments table:', createQmTableError);
    } else {
      console.log('✅ QM assignments table created');
    }

    // 5. Assign tomanovichqm to specific teams only (not all 223!)
    console.log('👤 Setting up tomanovichqm assignments...');
    const tomanovichAssignments = [
      'JOSEPH TOMANOVICH',
      'MARIA LAGIOS', 
      'COLLIN DICKINSON',
      'GABRIELLE GARCIA',
      'GEORGE OSHEA'
    ];

    const qmAssignments = tomanovichAssignments.map(team => ({
      qm_email: 'tomanovichqm@aoglobelife.com',
      mga_name: team,
      assigned_by: 'system',
      is_active: true
    }));

    const { error: insertQmError } = await supabase
      .from('qm_mga_assignments')
      .upsert(qmAssignments, { onConflict: 'qm_email,mga_name' });

    if (insertQmError) {
      console.error('❌ Error inserting QM assignments:', insertQmError);
    } else {
      console.log(`✅ Assigned tomanovichqm to ${qmAssignments.length} specific teams`);
    }

    // 6. Create helper functions
    console.log('🔧 Creating helper functions...');
    const { error: functionsError } = await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });

    if (functionsError) {
      console.error('❌ Error creating functions:', functionsError);
    } else {
      console.log('✅ Helper functions created');
    }

    // 7. Verify the setup
    console.log('🔍 Verifying setup...');
    const { data: qmTeams, error: verifyError } = await supabase
      .from('qm_mga_assignments')
      .select('*')
      .eq('qm_email', 'tomanovichqm@aoglobelife.com')
      .eq('is_active', true);

    if (verifyError) {
      console.error('❌ Error verifying setup:', verifyError);
    } else {
      console.log(`✅ Verification successful: tomanovichqm assigned to ${qmTeams.length} teams:`);
      qmTeams.forEach(team => console.log(`   - ${team.mga_name}`));
    }

    console.log('🎉 Quality Manager MGA Mapping System setup complete!');
    console.log('📊 Summary:');
    console.log(`   - ${uniqueMgaTeams.length} MGA teams from producerlist`);
    console.log(`   - tomanovichqm assigned to ${qmTeams?.length || 0} specific teams`);
    console.log('   - Ready for proper RBAC filtering');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

// Run the setup
setupQMMGAMapping();
