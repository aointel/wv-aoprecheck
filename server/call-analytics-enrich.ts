/**
 * Enrich taalk_call_analytics with denormalized lead_name, market, agent_name.
 * Called by webhooks and backfill when upserting so reads can use table only.
 */

import { SupabaseClient } from '@supabase/supabase-js';

function normalizePhone(p: string): string {
  const d = String(p || '').replace(/\D/g, '');
  return d.length >= 11 && d.startsWith('1') ? d.slice(-10) : d;
}

export async function enrichFromMasterleadAndCustomers(
  supabase: SupabaseClient,
  toNumber: string | null,
  agentEmail: string | null
): Promise<{ lead_name: string | null; market: string | null; agent_name: string | null }> {
  let lead_name: string | null = null;
  let market: string | null = null;
  let agent_name: string | null = null;

  if (toNumber && toNumber.replace(/\D/g, '').length >= 10) {
    const norm = normalizePhone(toNumber);
    const variants = [norm, `1${norm}`, toNumber];
    for (const phone of variants) {
      const { data: ml } = await supabase
        .from('masterlead')
        .select('first_name, last_name, taalk_market')
        .eq('phone', phone)
        .maybeSingle();
      if (ml) {
        lead_name = `${ml.first_name || ''} ${ml.last_name || ''}`.trim() || null;
        market = ml.taalk_market ?? null;
        break;
      }
    }
  }

  if (agentEmail && agentEmail.includes('@')) {
    const { data: cust } = await supabase
      .from('customers')
      .select('first_name, last_name')
      .ilike('company_email', agentEmail)
      .maybeSingle();
    if (cust) {
      agent_name = `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || null;
    }
    if (!agent_name && agentEmail === 'model-agent@aoglobelife.com') {
      agent_name = 'Model agent';
    }
  }

  return { lead_name, market, agent_name };
}
