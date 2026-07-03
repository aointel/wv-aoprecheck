/**
 * Check Neon DB schema and run missing migrations
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  
  // Full column list for hppro_presentations
  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name='hppro_presentations' 
    ORDER BY ordinal_position
  `);
  console.log('hppro_presentations columns:', cols.rows.map(r => r.column_name).join(', '));
  
  // Add missing columns
  const missing = [
    `alter table hppro_presentations add column if not exists raw_payload jsonb`,
    `alter table hppro_presentations add column if not exists agent_number text`,
    `alter table hppro_presentations add column if not exists agent_user_id int`,
    `alter table hppro_presentations add column if not exists synced_at timestamptz`,
    `alter table hppro_presentations add column if not exists state_id int`,
    `alter table hppro_presentations add column if not exists total_alp numeric`,
    `alter table hppro_presentations add column if not exists total_ahp numeric`,
    `alter table hppro_presentations add column if not exists is_senior boolean`,
    `alter table hppro_presentations add column if not exists plan_options jsonb`,
    `alter table hppro_presentations add column if not exists premium_plan jsonb`,
    `alter table hppro_presentations add column if not exists what_happened text`,
    `alter table hppro_presentations add column if not exists is_sale boolean default false`,
    `alter table hppro_presentations add column if not exists group_id int`,
    `alter table hppro_presentations add column if not exists general_questions jsonb`,
    `alter table hppro_presentations add column if not exists medical_answers jsonb`,
    `alter table hppro_presentations add column if not exists presentation_type_id int`,
    `alter table hppro_presentations add column if not exists step_completed int`,
    `alter table hppro_presentations add column if not exists start_time text`,
    `alter table hppro_presentations add column if not exists end_time text`,
    `alter table hppro_presentations add column if not exists presentation_guid uuid`,
    `create unique index if not exists hppro_pres_guid_idx on hppro_presentations(presentation_guid) where presentation_guid is not null`,
    // hppro_eapp_pending
    `create table if not exists hppro_eapp_pending (
      id bigserial primary key,
      agent_email text not null,
      presentation_guid text,
      inject_payload jsonb,
      what_happened text,
      consumed_at timestamptz,
      created_at timestamptz default now(),
      unique (agent_email, presentation_guid)
    )`,
    // aoi_applications
    `create table if not exists aoi_applications (
      id bigserial primary key,
      agent_email text not null,
      presentation_guid text,
      wizard_state jsonb not null default '{}',
      step text,
      completed_at timestamptz,
      synced_at timestamptz,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )`,
    `create unique index if not exists aoi_apps_uq on aoi_applications(agent_email, coalesce(presentation_guid,''))`,
  ];
  
  for (const stmt of missing) {
    try {
      await client.query(stmt);
      console.log('✓', stmt.substring(0, 60));
    } catch(e) {
      if (e.message.includes('already exists')) {
        console.log('skip (exists):', stmt.substring(0, 50));
      } else {
        console.log('✗', e.message, '|', stmt.substring(0, 60));
      }
    }
  }
  
  // Verify
  const cols2 = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='hppro_presentations' ORDER BY ordinal_position`);
  console.log('\nFinal columns:', cols2.rows.map(r => r.column_name).join(', '));
  
  // Check hppro_eapp_pending
  const pend = await client.query(`SELECT COUNT(*) FROM hppro_eapp_pending`);
  console.log('hppro_eapp_pending rows:', pend.rows[0].count);
  
  client.release();
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
