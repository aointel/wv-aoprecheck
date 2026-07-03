/**
 * Find leads in masterlead by name and set cn_email to the given agent.
 * Run: node scripts/assign-cn-email-by-names.cjs
 *
 * Edit NAMES and CN_EMAIL below.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const CN_EMAIL = 'lisavanzile@aoglobelife.com';

// [first_name, last_name] - last_name can be partial for ilike. Add alternate spellings for "not found".
const NAMES = [
  ['Paul', 'Ducharme'],
  ['Bill', 'Graham'],
  ['Alfred', 'Boulay'],
  ['Barbara', 'Sherwood'],
  ['Blockzo', 'tragedy'],
  ['Lisa', 'vz'],
  ['Rita', 'Fasco'],
  ['Bryan', 'Walton'],
  ['Riccardo', 'Guitteraz'],
  ['Riccardo', 'Gutierrez'],
  ['Ricardo', 'Guitteraz'],
  ['Jessie', 'Mcallian'],
  ['Wesley', 'Pavonka'],
  ['Janice', 'Pavonka'],
  ['Sylvia', 'Spear'],
  ['Sharon', 'Plante']
];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('Finding leads and setting cn_email to', CN_EMAIL, '\n');

  const updated = [];
  const updatedIds = new Set();
  const notFound = [];
  const errors = [];

  for (const [first, last] of NAMES) {
    const { data: rows, error } = await supabase
      .from('masterlead')
      .select('id, first_name, last_name, phone, cn_email')
      .ilike('first_name', first)
      .ilike('last_name', `%${last}%`);

    if (error) {
      errors.push({ name: `${first} ${last}`, error: error.message });
      continue;
    }

    if (!rows || rows.length === 0) {
      notFound.push(`${first} ${last}`);
      continue;
    }

    for (const lead of rows) {
      if (updatedIds.has(lead.id)) continue;
      const { error: upErr } = await supabase
        .from('masterlead')
        .update({
          cn_email: CN_EMAIL,
          updated_at: new Date().toISOString()
        })
        .eq('id', lead.id);

      if (upErr) {
        errors.push({ lead: `${lead.first_name} ${lead.last_name} (id ${lead.id})`, error: upErr.message });
      } else {
        updatedIds.add(lead.id);
        updated.push({ id: lead.id, name: `${lead.first_name} ${lead.last_name}`, phone: lead.phone });
        console.log('Updated:', lead.id, lead.first_name, lead.last_name, '->', CN_EMAIL);
      }
    }
  }

  console.log('\n--- Summary ---');
  console.log('Updated:', updated.length, 'lead(s)');
  if (notFound.length) console.log('Not found:', notFound.join(', '));
  if (errors.length) console.log('Errors:', errors);
}

main().catch((e) => { console.error(e); process.exit(1); });
