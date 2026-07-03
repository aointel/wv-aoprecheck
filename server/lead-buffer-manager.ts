import type { SupabaseClient } from '@supabase/supabase-js';
import { countCallableLeads } from './timezone-helper';

const LEAD_CAP = 300;

export type CustomerProfile = {
  email: string;
  states: string[];
  market: string[];
};

export async function ensureAgentLeadBuffer(
  supabaseAdmin: SupabaseClient,
  customer: CustomerProfile
) {
  const agentEmail = customer.email;

  const currentCallable = await countCallableLeads(supabaseAdmin, agentEmail);

  console.log(`📊 ensureAgentLeadBuffer: ${agentEmail} has ${currentCallable} callable leads`);

  // If agent already has the cap, no need to assign more
  if (currentCallable >= LEAD_CAP) {
    console.log(`✅ ${agentEmail} already has ${currentCallable} leads (>= ${LEAD_CAP}), skipping assignment`);
    return [];
  }

  // Calculate how many leads are needed to reach cap
  const maxToTopOff = LEAD_CAP - currentCallable;
  const needed = Math.min(LEAD_CAP, maxToTopOff); // Request up to cap leads at a time

  if (needed <= 0) {
    console.log(`⚠️ ${agentEmail} needs ${needed} leads (already at or above ${LEAD_CAP})`);
    return [];
  }

  console.warn(
    `LEADSYNC DISABLED: lead-buffer-manager skipped old bulk assignment for ${agentEmail} (current: ${currentCallable}, old target: ${LEAD_CAP}, would have requested: ${needed})`,
  );
  return [];
}


