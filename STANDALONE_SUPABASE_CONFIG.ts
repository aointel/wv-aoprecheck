/**
 * Standalone Supabase Configuration
 * 
 * Copy this file to your new server and update with your Supabase credentials
 * Then update the import in missed-call-billing-from-csv.ts to point to this file
 */

import { createClient } from '@supabase/supabase-js';

// REQUIRED: Set these environment variables
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || ''; // MUST be service role key

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables');
  process.exit(1);
}

// Server-side admin client with service role key for writes
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

console.log('✅ Supabase admin client initialized');


