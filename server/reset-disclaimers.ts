/**
 * Reset Call Connector Pro (and optionally Recruit) disclaimer flags in Supabase.
 * Run: npx tsx server/reset-disclaimers.ts [ccpro|recruit|all]
 * Default: ccpro
 */

import { supabaseAdmin } from './supabase';

const scope = (process.argv[2] || 'ccpro') as 'ccpro' | 'recruit' | 'all';

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  const resetCCPro = scope === 'ccpro' || scope === 'all';
  const resetRecruit = scope === 'recruit' || scope === 'all';

  if (resetCCPro) {
    const { data, error } = await supabaseAdmin
      .from('agent_profiles')
      .update({
        call_connector_pro_disclaimer_accepted_at: null,
        updated_at: new Date().toISOString(),
      })
      .not('call_connector_pro_disclaimer_accepted_at', 'is', null)
      .select('id');
    if (error) {
      console.error('❌ CCPro reset failed:', error.message);
    } else {
      console.log(`✅ Call Connector Pro disclaimer reset: ${data?.length ?? 0} rows updated`);
    }
  }

  if (resetRecruit) {
    try {
      const { data, error } = await supabaseAdmin
        .from('agent_profiles')
        .update({
          call_connector_pro_recruit_disclaimer_accepted_at: null,
          updated_at: new Date().toISOString(),
        })
        .not('call_connector_pro_recruit_disclaimer_accepted_at', 'is', null)
        .select('id');
      if (error) {
        console.error('❌ Recruit reset failed:', error.message);
      } else {
        console.log(`✅ Recruit disclaimer reset: ${data?.length ?? 0} rows updated`);
      }
    } catch (e: any) {
      console.error('❌ Recruit reset failed:', e?.message ?? e);
    }
  }
}

main();
