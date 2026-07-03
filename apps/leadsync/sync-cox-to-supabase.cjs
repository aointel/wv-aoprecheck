/**
 * Pull coxsteven's 50 pending leads from Neon, stamp them in Supabase so the dialer sees them.
 */
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const NEON_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const pool = new Pool({ connectionString: NEON_URL, max: 3 });
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const client = await pool.connect();
  try {
    // Get pending leads for coxsteven from Neon
    const { rows } = await client.query(`
      SELECT id, phone, taalk_lead_id, cnresolution, state, taalk_market
      FROM masterlead
      WHERE cn_email = 'coxsteven@aoglobelife.com'
        AND cnresolution = 'pending'
      LIMIT 60
    `);
    console.log('Pending leads in Neon for coxsteven:', rows.length);
    if (rows.length === 0) { console.log('Nothing to sync.'); return; }

    const ids = rows.map(r => r.id);
    const phones = rows.map(r => r.phone).filter(Boolean);
    const taalkIds = rows.map(r => r.taalk_lead_id).filter(Boolean);

    console.log('Sample rows:', rows.slice(0, 3));

    // Check if these IDs exist in Supabase
    const { data: sbRows, error } = await sb
      .from('masterlead')
      .select('id, cn_email, cnresolution, phone')
      .in('id', ids.slice(0, 100));

    if (error) { console.error('Supabase error:', error.message); return; }
    console.log('Found in Supabase by ID:', sbRows?.length);

    const sbIds = (sbRows || []).map(r => r.id);
    const notInSb = ids.filter(id => !sbIds.includes(id));
    console.log('NOT in Supabase by ID:', notInSb.length);

    if (sbIds.length > 0) {
      // Stamp cn_email on Supabase records
      const { data: updated, error: updErr } = await sb
        .from('masterlead')
        .update({ cn_email: 'coxsteven@aoglobelife.com', cnresolution: 'pending' })
        .in('id', sbIds);
      console.log('Stamped cn_email in Supabase:', sbIds.length, updErr?.message || 'ok');
    }

    // For IDs not found in Supabase — try matching by phone
    if (notInSb.length > 0 && phones.length > 0) {
      const neonMissing = rows.filter(r => notInSb.includes(r.id));
      const missingPhones = neonMissing.map(r => r.phone).filter(Boolean);
      if (missingPhones.length > 0) {
        const { data: byPhone, error: pErr } = await sb
          .from('masterlead')
          .select('id, cn_email, phone')
          .in('phone', missingPhones)
          .limit(100);
        console.log('Found by phone in Supabase:', byPhone?.length, pErr?.message || '');
        if (byPhone && byPhone.length > 0) {
          const phoneIds = byPhone.map(r => r.id);
          const { error: pUpdErr } = await sb
            .from('masterlead')
            .update({ cn_email: 'coxsteven@aoglobelife.com', cnresolution: 'pending' })
            .in('id', phoneIds);
          console.log('Stamped by phone match:', phoneIds.length, pUpdErr?.message || 'ok');
        }
      }
    }

  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(console.error);
