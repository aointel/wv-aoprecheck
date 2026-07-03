/**
 * Create get_masterlead_by_phone_last10 RPC for 609 inbound lead lookup by normalized phone.
 * Run: npx tsx server/scripts/setup-masterlead-by-phone-last10.ts
 * Or run database/get-masterlead-by-phone-last10.sql in Supabase SQL Editor.
 */

import * as fs from 'fs';
import * as path from 'path';
import { supabaseAdmin } from '../supabase';

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin not configured');
    process.exit(1);
  }
  const sqlPath = path.join(__dirname, '../../database/get-masterlead-by-phone-last10.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const { error } = await supabaseAdmin.rpc('exec_sql', { sql });
  if (error) {
    console.error('❌ Failed. Run database/get-masterlead-by-phone-last10.sql in Supabase SQL Editor:', error);
    process.exit(1);
  }
  console.log('✅ get_masterlead_by_phone_last10 function created');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
