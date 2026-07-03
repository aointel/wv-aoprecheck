#!/usr/bin/env node

// Create call_tracker table manually
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import 'dotenv/config';

async function createCallTrackerTable() {
  const sql = postgres(process.env.DATABASE_URL);
  const db = drizzle(sql);

  try {
    console.log('🚀 Creating bulletproof call_tracker table...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS call_tracker (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL UNIQUE,
        agent_email TEXT NOT NULL,
        lead_phone TEXT NOT NULL,
        lead_name TEXT NOT NULL,
        call_progress TEXT NOT NULL DEFAULT 'not_initiated',
        taalk_call_id TEXT,
        twilio_call_sid TEXT,
        zoom_room_id TEXT,
        initiated_at TIMESTAMP,
        connected_at TIMESTAMP,
        in_progress_at TIMESTAMP,
        completed_at TIMESTAMP,
        call_outcome TEXT,
        verification_result TEXT,
        appointment_booked BOOLEAN DEFAULT FALSE,
        last_error TEXT,
        retry_count INTEGER DEFAULT 0,
        system_flags JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    
    console.log('✅ call_tracker table created successfully!');
    
    // Create index for performance
    await sql`CREATE INDEX IF NOT EXISTS idx_call_tracker_session_id ON call_tracker(session_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_call_tracker_agent_email ON call_tracker(agent_email);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_call_tracker_progress ON call_tracker(call_progress);`;
    
    console.log('✅ Indexes created for optimal performance');
    
  } catch (error) {
    console.error('❌ Error creating table:', error);
  } finally {
    await sql.end();
  }
}

createCallTrackerTable();