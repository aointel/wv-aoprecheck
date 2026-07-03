/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js');

const PAGE_SIZE = 500;
const CONCURRENCY = 10;
const UNKNOWN_EMAIL_PATTERNS = [
  'unknown@pending-lookup.aogi',
  'associate-%@pending-lookup.aogi',
];

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VERBOSE = process.env.VERBOSE === '1' || process.env.DEBUG === '1';
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isUnknownEmail(email) {
  if (!email) return true;
  const e = String(email).toLowerCase();
  return UNKNOWN_EMAIL_PATTERNS.some((p) => {
    if (p.includes('%')) {
      const [prefix, suffix] = p.toLowerCase().split('%');
      return e.startsWith(prefix) && e.endsWith(suffix);
    }
    return e === p;
  });
}

async function fetchFixableBatch(offset) {
  const { data, error } = await supabase
    .from('billing_transactions')
    .select(
      'id, transaction_id, agent_email, agent_associate_id, agent_name, source_id'
    )
    .eq('source_table', 'vdp_calls')
    .or(
      [
        'agent_email.is.null',
        "agent_email.eq.''",
        "agent_email.ilike.%unknown%",
        "agent_email.ilike.associate-%@pending-lookup.aogi",
        'agent_associate_id.is.null',
      ].join(',')
    )
    .order('id', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) throw error;
  return data || [];
}

async function getVDPCallById(id) {
  const { data, error } = await supabase
    .from('vdp_calls')
    .select('id, company_email, agent, firstName, lastName, phone, market')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (VERBOSE) {
    console.log('[DEBUG] vdp_calls', { id, hasRecord: !!data, company_email: data?.company_email, agent: data?.agent });
  }
  return data || null;
}

async function lookupByCustomerEmail(email) {
  if (!email) return null;
  const em = String(email).toLowerCase();
  const { data, error } = await supabase
    .from('customers')
    .select(
      'associate_id, first_name, last_name, company_email, personal_email'
    )
    .or(`company_email.eq.${em},personal_email.eq.${em}`)
    .maybeSingle();
  if (error) throw error;
  if (VERBOSE) {
    console.log('[DEBUG] customers by email', { email: em, found: !!data, associate_id: data?.associate_id });
  }
  return data || null;
}

async function lookupByAssociateId(associateId) {
  if (!associateId) return null;
  const assoc = String(associateId).trim();
  const { data, error } = await supabase
    .from('agent_hierarchy')
    .select('agent_email, agent_name, agent_associate_id')
    .eq('agent_associate_id', assoc)
    .maybeSingle();
  if (error) throw error;
  if (VERBOSE) {
    console.log('[DEBUG] agent_hierarchy by associate', { associateId: assoc, found: !!data, agent_email: data?.agent_email });
  }
  return data || null;
}

function combineName(first, last) {
  const parts = [first, last].filter(Boolean).map((s) => String(s).trim());
  return parts.length ? parts.join(' ') : null;
}

async function resolveAgentForConnect(sourceId) {
  const call = await getVDPCallById(sourceId);
  if (!call) return null;

  // Try customers by company_email first
  let resolvedEmail = call.company_email?.toLowerCase() || null;
  let resolvedAssociate = null;
  let resolvedName = combineName(call.firstName, call.lastName);

  if (resolvedEmail) {
    const c = await lookupByCustomerEmail(resolvedEmail);
    if (c) {
      resolvedEmail =
        (c.company_email || c.personal_email || resolvedEmail)?.toLowerCase() ||
        resolvedEmail;
      resolvedAssociate = c.associate_id ?? resolvedAssociate;
      if (!resolvedName) {
        const n = combineName(c.first_name, c.last_name);
        if (n) resolvedName = n;
      }
    } else if (VERBOSE) {
      console.log('[DEBUG] no customers match company_email; will try agent_hierarchy');
    }
  }

  // Try agent_hierarchy by numeric agent id if still missing associate or email
  const numericAgent =
    call.agent && /^\d+$/.test(String(call.agent)) ? String(call.agent) : null;
  if (numericAgent) {
    const h = await lookupByAssociateId(numericAgent);
    if (h) {
      if (!resolvedEmail && h.agent_email) {
        resolvedEmail = h.agent_email.toLowerCase();
      }
      if (!resolvedName && h.agent_name) {
        resolvedName = h.agent_name;
      }
      if (!resolvedAssociate && h.agent_associate_id) {
        resolvedAssociate = Number(h.agent_associate_id);
      }
    } else if (VERBOSE) {
      console.log('[DEBUG] agent_hierarchy not found for numeric agent', { numericAgent });
    }
  } else if (VERBOSE) {
    console.log('[DEBUG] vdp_calls.agent not numeric or empty; skipping agent_hierarchy path', { agent: call.agent });
  }

  if (!resolvedEmail && !resolvedAssociate) {
    if (VERBOSE) {
      console.log('[DEBUG] unresolved agent for connect', { sourceId, company_email: call.company_email, agent: call.agent });
    }
    return null;
  }

  if (!resolvedName) {
    resolvedName = resolvedEmail ? resolvedEmail.split('@')[0] : 'agent';
  }

  if (VERBOSE) {
    console.log('[DEBUG] resolved agent', { sourceId, resolvedEmail, resolvedAssociate, resolvedName });
  }
  return {
    agent_email: resolvedEmail,
    agent_associate_id: resolvedAssociate,
    agent_name: resolvedName,
  };
}

async function processRow(row) {
  const sourceId = row.source_id;
  if (!sourceId && !row.transaction_id?.startsWith('connect-')) return 0;

  if (row.agent_email && !isUnknownEmail(row.agent_email) && row.agent_associate_id) {
    if (VERBOSE) {
      console.log('[SKIP] already good', { id: row.id, sourceId, agent_email: row.agent_email, agent_associate_id: row.agent_associate_id });
    }
    return 0;
  }

  if (VERBOSE) {
    console.log('[PROCESS] row', { id: row.id, sourceId, current_email: row.agent_email, current_assoc: row.agent_associate_id });
  }
  const resolved = await resolveAgentForConnect(sourceId);
  if (!resolved) return 0;

  const { error } = await supabase
    .from('billing_transactions')
    .update({
      agent_email: resolved.agent_email || row.agent_email,
      agent_associate_id: resolved.agent_associate_id ?? row.agent_associate_id,
      agent_name: resolved.agent_name || row.agent_name,
    })
    .eq('id', row.id);
  if (error) {
    console.error(`Update failed for billing_transactions.id=${row.id}`, error.message);
    return 0;
  }
  if (VERBOSE) {
    console.log('[UPDATED]', { id: row.id, new_email: resolved.agent_email, new_assoc: resolved.agent_associate_id });
  }
  return 1;
}

async function run() {
  console.log('Starting CONNECTS billing backfill...');
  let offset = 0;
  let totalFixed = 0;
  let batchNum = 1;

  while (true) {
    let rows = [];
    try {
      rows = await fetchFixableBatch(offset);
    } catch (e) {
      console.error('Fetch batch failed', e.message);
      await sleep(1000);
      continue;
    }

    if (!rows.length) break;

    console.log(`Batch ${batchNum}: processing ${rows.length} rows (offset ${offset})`);

    let idx = 0;
    while (idx < rows.length) {
      const slice = rows.slice(idx, idx + CONCURRENCY);
      const results = await Promise.all(
        slice.map(async (row) => {
          try {
            return await processRow(row);
          } catch (e) {
            console.error(`Row ${row.id} failed`, e.message);
            return 0;
          }
        })
      );
      totalFixed += results.reduce((a, b) => a + b, 0);
      idx += CONCURRENCY;
    }

    console.log(`Batch ${batchNum} fixed so far: ${totalFixed}`);
    offset += PAGE_SIZE;
    batchNum += 1;

    await sleep(250);
  }

  console.log(`Done. Total CONNECT rows fixed: ${totalFixed}`);
}

run().catch((e) => {
  console.error('Fatal error', e);
  process.exit(1);
});


