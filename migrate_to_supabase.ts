import { db } from './server/db';
import { createClient } from '@supabase/supabase-js';
import { recruitCandidates } from './shared/schema';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDE4MjIxMiwiZXhwIjoyMDU1NzU4MjEyfQ.Q0DH5iZaRnhJ3d2-XTPWZh0yYW2S6pVSAv2F1HlUeZU';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrate() {
  console.log('🔄 Starting migration from local PostgreSQL to Supabase...');
  
  const localCandidates = await db.select().from(recruitCandidates);
  console.log(`📊 Found ${localCandidates.length} candidates in local DB`);
  
  const toInsert = localCandidates.map(c => ({
    first_name: c.firstName,
    last_name: c.lastName,
    phone: c.phone,
    email: c.email || '',
    city: c.city,
    state: c.state,
    zip_code: c.zipCode,
    status: c.status,
    position: c.position,
    experience: c.experience,
    rating: c.rating,
    notes: c.notes,
    agent_id: c.agentId,
    agent_email: c.agentEmail,
    appointment_date: c.appointmentDate,
    appointment_notes: c.appointmentNotes,
    created_at: c.createdAt?.toISOString(),
    updated_at: c.updatedAt?.toISOString(),
    current_stage_id: c.currentStageId,
    stage_entered_at: c.stageEnteredAt?.toISOString(),
    source: c.source,
    archived: c.archived,
    ai_summary: c.aiSummary
  }));
  
  console.log('📦 Inserting candidates to Supabase...');
  const { data, error } = await supabase
    .from('recruit_candidates')
    .upsert(toInsert, { onConflict: 'phone,agent_email' });
  
  if (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
  
  console.log(`✅ Successfully migrated ${toInsert.length} candidates to Supabase`);
  console.log('🎉 Migration complete!');
  process.exit(0);
}

migrate();
