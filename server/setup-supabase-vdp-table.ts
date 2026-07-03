import { supabaseAdmin } from './supabase';

async function setupSupabaseVdpTable() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    return;
  }

  try {
    // First check if table exists by querying it
    console.log('🔍 Checking if vdp_calls table exists...');
    const { data: existingData, error: queryError } = await supabaseAdmin
      .from('vdp_calls')
      .select('*')
      .limit(1);

    if (queryError) {
      console.log('❌ Table does not exist, creating it...');
      
      // Create the table using raw SQL
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS public.vdp_calls (
          id bigserial PRIMARY KEY,
          date text,
          time text,
          event text,
          phone text,
          agent text,
          params text,
          created_at timestamp with time zone DEFAULT now()
        );

        -- Create indexes for better query performance
        CREATE INDEX IF NOT EXISTS idx_vdp_calls_date ON public.vdp_calls(date);
        CREATE INDEX IF NOT EXISTS idx_vdp_calls_event ON public.vdp_calls(event);
        CREATE INDEX IF NOT EXISTS idx_vdp_calls_phone ON public.vdp_calls(phone);
        CREATE INDEX IF NOT EXISTS idx_vdp_calls_agent ON public.vdp_calls(agent);
        CREATE INDEX IF NOT EXISTS idx_vdp_calls_created_at ON public.vdp_calls(created_at);

        -- Enable Row Level Security (RLS)
        ALTER TABLE public.vdp_calls ENABLE ROW LEVEL SECURITY;

        -- Create policy to allow all operations
        CREATE POLICY IF NOT EXISTS "Enable all operations for vdp_calls" ON public.vdp_calls
        FOR ALL USING (true) WITH CHECK (true);
      `;

      // Execute the SQL via the raw query method
      const { error: createError } = await supabaseAdmin.rpc('exec_sql', { sql: createTableSQL });
      
      if (createError) {
        console.error('❌ Error creating table:', createError);
        return;
      }
    }

    console.log('✅ vdp_calls table exists');

    // Test insertion
    console.log('🧪 Testing insertion...');
    const testData = {
      date: '2025-09-06',
      time: '20:10:00',
      event: 'SETUP_TEST',
      phone: '+15551234567',
      agent: 'SETUP_AGENT',
      params: '{"test":"setup_working"}',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from('vdp_calls')
      .insert(testData)
      .select()
      .single();

    if (error) {
      console.error('❌ Test insertion failed:', error);
    } else {
      console.log('✅ Test insertion successful:', data.id);
    }

  } catch (error) {
    console.error('❌ Error setting up Supabase VDP table:', error);
  }
}

// Run the setup
setupSupabaseVdpTable().then(() => {
  console.log('🎯 Supabase VDP table setup complete');
}).catch(console.error);