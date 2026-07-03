import { supabaseAdmin } from './supabase';

async function createSupabaseVdpTable() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    return;
  }

  try {
    console.log('🔧 Creating vdp_calls table in Supabase...');
    
    // Use the exact SQL to create the table
    const { data, error } = await supabaseAdmin.rpc('exec', {
      sql: `
        DROP TABLE IF EXISTS vdp_calls CASCADE;
        
        CREATE TABLE vdp_calls (
          id bigserial PRIMARY KEY,
          date text,
          time text,
          event text,
          phone text,
          agent text,
          params text,
          created_at timestamptz DEFAULT now()
        );
        
        CREATE INDEX idx_vdp_calls_date ON vdp_calls(date);
        CREATE INDEX idx_vdp_calls_event ON vdp_calls(event);
        CREATE INDEX idx_vdp_calls_agent ON vdp_calls(agent);
        
        ALTER TABLE vdp_calls ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY vdp_calls_policy ON vdp_calls 
        FOR ALL USING (true) WITH CHECK (true);
      `
    });

    if (error) {
      console.error('❌ Error creating Supabase table:', error);
      
      // Try manual insertion test instead
      console.log('🧪 Testing manual insertion...');
      const testResult = await supabaseAdmin
        .from('vdp_calls')
        .insert({
          date: '2025-09-06',
          time: '21:00:00',
          event: 'CREATE_TEST',
          phone: '+15551234567',
          agent: 'CREATE_AGENT',
          params: '{"test":"create_working"}',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (testResult.error) {
        console.error('❌ Manual insertion failed:', testResult.error);
      } else {
        console.log('✅ Manual insertion successful:', testResult.data.id);
      }
    } else {
      console.log('✅ Supabase table created successfully');
    }

  } catch (error) {
    console.error('❌ Error in createSupabaseVdpTable:', error);
  }
}

createSupabaseVdpTable().then(() => {
  console.log('🎯 Supabase VDP table creation complete');
}).catch(console.error);