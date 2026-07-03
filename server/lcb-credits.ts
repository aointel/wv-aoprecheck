/**
 * Shared LCB credits fetch + map build. Same logic the Live Call Board uses.
 * Use this for agents route and report so we always "run the same API" for credits.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type CustomerRow = {
  company_email?: string;
  personal_email?: string;
  [k: string]: any;
};

/** Same query as LCB: user_credits, limit 100k. */
export async function fetchUserCreditsForLcb(
  supabase: SupabaseClient
): Promise<{ data: { email: string; credits_remaining: number; credits_used?: number; credits_purchased?: number }[] }> {
  const { data, error } = await supabase
    .from('user_credits')
    .select('email, credits_remaining, credits_used, credits_purchased')
    .limit(100000);
  if (error) throw error;
  return { data: (data || []) as { email: string; credits_remaining: number; credits_used?: number; credits_purchased?: number }[] };
}

/** Same query as LCB: customers for ce/pe cross-ref (only company/personal email needed). */
export async function fetchCustomersForLcb(
  supabase: SupabaseClient
): Promise<{ rows: CustomerRow[] }> {
  const { data, error } = await supabase
    .from('customers')
    .select('company_email, personal_email')
    .limit(100000);
  if (error) throw error;
  return { rows: (data || []) as CustomerRow[] };
}

/** Same map build as LCB: key by lowercase email, add ce/pe cross-refs from customers. */
export function buildCreditsMap(
  creditsList: { email?: string; credits_remaining?: number }[],
  customerRows: CustomerRow[] = []
): Map<string, { email?: string; credits_remaining?: number }> {
  const map = new Map<string, { email?: string; credits_remaining?: number }>();
  creditsList.forEach((c) => {
    const key = (c.email || '').toString().toLowerCase().trim();
    if (!key) return;
    map.set(key, c);
  });
  customerRows.forEach((cust) => {
    const ce = (cust.company_email || '').toString().toLowerCase().trim();
    const pe = (cust.personal_email || '').toString().toLowerCase().trim();
    if (ce && map.has(ce)) {
      const row = map.get(ce)!;
      if (pe && !map.has(pe)) map.set(pe, row);
    }
    if (pe && map.has(pe)) {
      const row = map.get(pe)!;
      if (ce && !map.has(ce)) map.set(ce, row);
    }
  });
  return map;
}
