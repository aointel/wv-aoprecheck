import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

console.log('🔍 Creating masterleads table in Supabase...');

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createMasterleadsTable() {
  try {
    // First let's check what tables exist
    console.log('🔍 Checking existing tables...');
    const { data: existingTables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (existingTables) {
      console.log('📋 Existing tables:', existingTables.map(t => t.table_name));
    }

    // Create masterleads table using rpc
    console.log('🔧 Creating masterleads table...');
    
    // Since direct SQL execution might not work, let's try creating via API
    // First, create a simple record to test if table exists
    const { data: testInsert, error: testError } = await supabase
      .from('masterleads')
      .insert([{
        user_email: 'chrislafond@aoglobelife.com',
        first_name: 'Test',
        last_name: 'Lead',
        phone: '5551234567',
        email: 'test@example.com',
        state: 'CA',
        city: 'Los Angeles',
        market: 'Veteran',
        lead_source: 'LeadGen'
      }]);

    if (testError) {
      console.log('❌ Table does not exist, error:', testError.message);
      console.log('🔧 Need to create table manually in Supabase dashboard');
      
      console.log('📋 Use this SQL in Supabase SQL Editor:');
      console.log(`
CREATE TABLE masterleads (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  state TEXT,
  city TEXT,
  market TEXT,
  lead_source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_masterleads_user_email ON masterleads(user_email);

INSERT INTO masterleads (user_email, first_name, last_name, phone, email, state, city, market, lead_source) VALUES 
('chrislafond@aoglobelife.com', 'Kenneth J. Kislak', 'Sr.', '2015778823', 'kjksr@icloud.com', 'CA', 'Los Angeles', 'Veteran', 'LeadGen'),
('chrislafond@aoglobelife.com', 'Diego', 'Estrada', '5551234567', 'destrada0108@gmail.com', 'TX', 'Houston', 'Veteran', 'LeadGen'),
('chrislafond@aoglobelife.com', 'Richard', 'Yannelli', '5559876543', 'marieananiar@aol.com', 'FL', 'Miami', 'Veteran', 'LeadGen'),
('chrislafond@aoglobelife.com', 'Gary', 'Cain', '5551112222', 'gary4nowcain@yahoo.com', 'OH', 'Cleveland', 'Veteran', 'LeadGen'),
('chrislafond@aoglobelife.com', 'Carl', 'Stahlman', '5553334444', 'carlstahlman@email.com', 'WI', 'Milwaukee', 'Veteran', 'LeadGen');
      `);
      
    } else {
      console.log('✅ Table exists and test record inserted successfully');
      
      // Add more sample records
      const sampleLeads = [
        {
          user_email: 'chrislafond@aoglobelife.com',
          first_name: 'Kenneth J. Kislak',
          last_name: 'Sr.',
          phone: '2015778823',
          email: 'kjksr@icloud.com',
          state: 'CA',
          city: 'Los Angeles',
          market: 'Veteran',
          lead_source: 'LeadGen'
        },
        {
          user_email: 'chrislafond@aoglobelife.com',
          first_name: 'Diego',
          last_name: 'Estrada',
          phone: '5551234567',
          email: 'destrada0108@gmail.com',
          state: 'TX',
          city: 'Houston',
          market: 'Veteran',
          lead_source: 'LeadGen'
        },
        {
          user_email: 'chrislafond@aoglobelife.com',
          first_name: 'Richard',
          last_name: 'Yannelli',
          phone: '5559876543',
          email: 'marieananiar@aol.com',
          state: 'FL',
          city: 'Miami',
          market: 'Veteran',
          lead_source: 'LeadGen'
        }
      ];

      const { data: insertData, error: insertError } = await supabase
        .from('masterleads')
        .insert(sampleLeads);

      if (insertError) {
        console.log('❌ Failed to insert sample leads:', insertError.message);
      } else {
        console.log('✅ Sample leads inserted successfully');
      }
    }

    // Test query
    console.log('🔍 Testing query for chrislafond@aoglobelife.com...');
    const { data: queryData, error: queryError } = await supabase
      .from('masterleads')
      .select('*')
      .eq('user_email', 'chrislafond@aoglobelife.com');

    if (queryError) {
      console.log('❌ Query failed:', queryError.message);
    } else {
      console.log('✅ Query successful, found', queryData.length, 'leads');
      console.log('📋 Sample:', queryData[0]);
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
  }
}

createMasterleadsTable();