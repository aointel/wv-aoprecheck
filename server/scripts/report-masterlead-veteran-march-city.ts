import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../supabase.js';

type LeadRow = {
  id: number | string | null;
  taalk_lead_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  taalk_market?: string | null;
  taalk_city?: string | null;
  created_at?: string | null;
};

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function csvEscape(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function hasCity(v: unknown): boolean {
  return String(v ?? '').trim().length > 0;
}

async function fetchVeteranMarchLeads(startIso: string, endIso: string, pageSize: number): Promise<LeadRow[]> {
  if (!supabaseAdmin) throw new Error('supabaseAdmin not configured');
  const rows: LeadRow[] = [];
  let offset = 0;
  let page = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('masterlead')
      .select('id, taalk_lead_id, first_name, last_name, email, phone, city, taalk_city, state, taalk_market, created_at')
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .ilike('taalk_market', '%veteran%')
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`masterlead page ${page + 1} failed: ${error.message}`);
    }

    const batch = (data || []) as LeadRow[];
    rows.push(...batch);
    page += 1;
    offset += batch.length;
    console.log(`Fetched page ${page}: ${batch.length} rows (running total ${rows.length})`);

    if (batch.length < pageSize) break;
  }

  return rows;
}

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not configured');
    process.exit(1);
  }

  const year = Number(getArg('year') || '2026');
  const month = Number(getArg('month') || '3'); // March
  const pageSize = Number(getArg('pageSize') || '1000');
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error('Invalid --year or --month');
  }

  const startIso = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString();
  const endIso = new Date(Date.UTC(year, month, 1, 0, 0, 0)).toISOString();

  console.log(`Scanning masterlead for Veteran market in ${year}-${String(month).padStart(2, '0')}`);
  console.log(`Date range UTC: ${startIso} -> ${endIso}`);

  const leads = await fetchVeteranMarchLeads(startIso, endIso, pageSize);
  const withCity = leads.filter((r) => hasCity(r.city) || hasCity(r.taalk_city));
  const withoutCity = leads.filter((r) => !hasCity(r.city) && !hasCity(r.taalk_city));

  const pct = (n: number, d: number) => (d === 0 ? '0.00' : ((n / d) * 100).toFixed(2));

  console.log('\n=== Veteran March Lead Summary ===');
  console.log(`total_veteran_leads=${leads.length}`);
  console.log(`with_city=${withCity.length} (${pct(withCity.length, leads.length)}%)`);
  console.log(`without_city=${withoutCity.length} (${pct(withoutCity.length, leads.length)}%)`);

  const outDir = path.join(process.cwd(), 'server', 'scripts', 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `masterlead-veteran-${year}-${String(month).padStart(2, '0')}-city-comparison-${stamp}.csv`);
  const lines: string[] = [];
  lines.push('id,taalk_lead_id,created_at,first_name,last_name,email,phone,taalk_market,state,city,taalk_city,city_present');
  for (const row of leads) {
    const cityValue = hasCity(row.city) ? row.city : row.taalk_city;
    lines.push([
      csvEscape(row.id),
      csvEscape(row.taalk_lead_id),
      csvEscape(row.created_at),
      csvEscape(row.first_name),
      csvEscape(row.last_name),
      csvEscape(row.email),
      csvEscape(row.phone),
      csvEscape(row.taalk_market),
      csvEscape(row.state),
      csvEscape(cityValue),
      csvEscape(row.taalk_city),
      csvEscape(hasCity(cityValue) ? 'yes' : 'no'),
    ].join(','));
  }
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`\nWrote detailed CSV: ${outPath}`);
}

main().catch((e) => {
  console.error('❌ report failed:', e?.message || e);
  process.exit(1);
});

