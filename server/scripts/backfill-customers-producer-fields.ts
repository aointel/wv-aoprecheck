import { supabaseAdmin } from '../supabase';

type CustomerRow = {
  id: string;
  company_email: string | null;
  personal_email: string | null;
  associate_id: number | null;
  mga: string | null;
  rga: string | null;
};

type ProducerRow = {
  company_email: string | null;
  personal_email: string | null;
  associate_id: number | null;
  mga: string | null;
  rga: string | null;
};

type HierarchyRow = {
  agent_email: string | null;
  agent_associate_id: number | null;
  mga_name: string | null;
  rga_name: string | null;
};

type SourceFields = {
  associate_id: number | null;
  mga: string | null;
  rga: string | null;
};

function normalizeEmail(v: unknown): string {
  const e = String(v ?? '').toLowerCase().trim();
  return e.includes('@') ? e : '';
}

function cleanText(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (!s || s === '0' || s.toLowerCase() === 'null') return null;
  return s;
}

async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabaseAdmin!
      .from(table)
      .select(select)
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`${table} fetch failed at offset ${offset}: ${error.message}`);
    const rows = (data || []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
    if (offset > 200000) break;
  }
  return out;
}

function putIfBetter(map: Map<string, SourceFields>, email: string, row: SourceFields) {
  if (!email) return;
  const prev = map.get(email);
  if (!prev) {
    map.set(email, row);
    return;
  }
  const prevScore = (prev.associate_id ? 2 : 0) + (prev.mga ? 1 : 0) + (prev.rga ? 1 : 0);
  const nextScore = (row.associate_id ? 2 : 0) + (row.mga ? 1 : 0) + (row.rga ? 1 : 0);
  if (nextScore >= prevScore) map.set(email, row);
}

async function main() {
  if (!supabaseAdmin) throw new Error('Supabase admin unavailable');

  const customers = await fetchAll<CustomerRow>(
    'customers',
    'id,company_email,personal_email,associate_id,mga,rga',
  );
  const producerlist = await fetchAll<ProducerRow>(
    'producerlist',
    'company_email,personal_email,associate_id,mga,rga',
  );
  const hierarchy = await fetchAll<HierarchyRow>(
    'agent_hierarchy',
    'agent_email,agent_associate_id,mga_name,rga_name',
  );

  const sourceByEmail = new Map<string, SourceFields>();

  for (const row of producerlist) {
    const src: SourceFields = {
      associate_id: row.associate_id ?? null,
      mga: cleanText(row.mga),
      rga: cleanText(row.rga),
    };
    putIfBetter(sourceByEmail, normalizeEmail(row.company_email), src);
    putIfBetter(sourceByEmail, normalizeEmail(row.personal_email), src);
  }

  for (const row of hierarchy) {
    const email = normalizeEmail(row.agent_email);
    if (!email) continue;
    const src: SourceFields = {
      associate_id: row.agent_associate_id ?? null,
      mga: cleanText(row.mga_name),
      rga: cleanText(row.rga_name),
    };
    putIfBetter(sourceByEmail, email, src);
  }

  let touched = 0;
  let updatedAssociate = 0;
  let updatedMga = 0;
  let updatedRga = 0;
  let errors = 0;

  for (const c of customers) {
    const company = normalizeEmail(c.company_email);
    const personal = normalizeEmail(c.personal_email);
    const src = sourceByEmail.get(company) || sourceByEmail.get(personal);
    if (!src) continue;

    const patch: Record<string, unknown> = {};
    if ((c.associate_id == null || Number(c.associate_id) <= 0) && src.associate_id && src.associate_id > 0) {
      patch.associate_id = src.associate_id;
      updatedAssociate++;
    }
    if (!cleanText(c.mga) && src.mga) {
      patch.mga = src.mga;
      updatedMga++;
    }
    if (!cleanText(c.rga) && src.rga) {
      patch.rga = src.rga;
      updatedRga++;
    }

    if (Object.keys(patch).length === 0) continue;

    const { error } = await supabaseAdmin!.from('customers').update(patch).eq('id', c.id);
    if (error) {
      errors++;
      continue;
    }
    touched++;
  }

  console.log(
    JSON.stringify(
      {
        totalCustomers: customers.length,
        sourceEmails: sourceByEmail.size,
        rowsUpdated: touched,
        fieldsUpdated: {
          associate_id: updatedAssociate,
          mga: updatedMga,
          rga: updatedRga,
        },
        errors,
        untouchedFields: ['market', 'states'],
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

