/**
 * Retroactive Accountability System - Add ALL missing accountability records
 * Checks both Supabase twilio_call_logs and PostgreSQL twilio_call_logs for ALL agents
 * Adds records for 4+ minute calls AND phantom bookings (90-600 second calls marked as booked)
 */

import { createClient } from '@supabase/supabase-js';
import { neon } from '@neondatabase/serverless';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const sql = neon(process.env.DATABASE_URL);

async function retroactiveAccountabilityFix() {
  console.log('🔄 Starting comprehensive retroactive accountability fix...');
  
  let totalCallsFound = 0;
  let totalPhantomBookings = 0;
  let totalRecordsAdded = 0;

  try {
    // 1. Process Supabase twilio_call_logs for ALL agents
    console.log('📊 Checking Supabase twilio_call_logs...');
    
    const { data: supabaseCalls, error: supabaseError } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .gte('call_duration', 240) // 4+ minutes
      .eq('call_status', 'completed')
      .lt('call_started_at', new Date().toISOString().split('T')[0] + 'T23:59:59')
      .order('call_started_at', { ascending: false })
      .limit(500);

    if (supabaseError) {
      console.error('❌ Supabase error:', supabaseError);
    } else if (supabaseCalls && supabaseCalls.length > 0) {
      console.log(`📞 Found ${supabaseCalls.length} calls over 4 minutes in Supabase`);
      totalCallsFound += supabaseCalls.length;
      
      for (const call of supabaseCalls) {
        const callDate = call.call_started_at.split('T')[0];
        const agentEmail = call.agent_email;
        
        if (!agentEmail) {
          console.log(`⚠️ Skipping call ${call.twilio_call_sid} - no agent email`);
          continue;
        }

        // Check if accountability record already exists
        const existingReport = await sql`
          SELECT id FROM daily_accountability 
          WHERE agent_email = ${agentEmail} 
            AND DATE(accountability_date) = ${callDate}
            AND has_completed_report = true
        `;

        if (existingReport.length === 0) {
          // No completed report for this date - add unresolved call tracking
          console.log(`➕ Adding accountability for ${agentEmail} on ${callDate} (Supabase call ${call.twilio_call_sid})`);
          
          try {
            await sql`
              INSERT INTO daily_accountability (
                agent_email, accountability_date, has_completed_report, 
                unresolved_calls_count, call_details, created_at, updated_at
              ) VALUES (
                ${agentEmail}, ${callDate}, false, 1,
                ${JSON.stringify([{
                  call_sid: call.twilio_call_sid,
                  duration: call.call_duration,
                  direction: call.call_direction,
                  to_number: call.to_number,
                  from_number: call.from_number,
                  created_at: call.call_started_at,
                  source: 'supabase'
                }])},
                NOW(), NOW()
              )
              ON CONFLICT (agent_email, accountability_date) DO UPDATE SET
                unresolved_calls_count = daily_accountability.unresolved_calls_count + 1,
                call_details = daily_accountability.call_details || ${JSON.stringify([{
                  call_sid: call.twilio_call_sid,
                  duration: call.call_duration,
                  direction: call.call_direction,
                  to_number: call.to_number,
                  from_number: call.from_number,
                  created_at: call.call_started_at,
                  source: 'supabase'
                }])},
                updated_at = NOW()
            `;
            totalRecordsAdded++;
          } catch (insertError) {
            console.error(`❌ Failed to insert accountability record for ${agentEmail}: ${insertError.message}`);
          }
        }
      }
    }

    // 2. Check for phantom bookings in Supabase (90-600 second calls marked as booked)
    console.log('🔍 Checking for phantom bookings in Supabase...');
    
    const { data: phantomCalls, error: phantomError } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .gte('call_duration', 90)
      .lte('call_duration', 600)
      .eq('call_status', 'completed')
      .lt('call_started_at', new Date().toISOString().split('T')[0] + 'T23:59:59')
      .order('call_started_at', { ascending: false })
      .limit(500);

    if (phantomError) {
      console.error('❌ Phantom booking check error:', phantomError);
    } else if (phantomCalls && phantomCalls.length > 0) {
      for (const call of phantomCalls) {
        const agentEmail = call.agent_email;
        if (!agentEmail) continue;

        // Check if call is marked as booked
        const isBooked = call.metadata && 
          (call.metadata.disposition === 'set_appointment' || 
           call.metadata.outcome === 'booked' ||
           call.metadata.result === 'appointment');

        if (isBooked) {
          const callDate = call.call_started_at.split('T')[0];
          
          // Check for matching appointments on that date
          const appointments = await sql`
            SELECT id FROM appointments 
            WHERE agent_email = ${agentEmail} 
              AND DATE(start_time) = ${callDate}
          `;

          if (appointments.length === 0) {
            // Phantom booking detected!
            console.log(`🚨 PHANTOM BOOKING: ${agentEmail} - Call ${call.twilio_call_sid} marked booked but no appointment on ${callDate}`);
            totalPhantomBookings++;

            // Check if already tracked
            const existingInconsistency = await sql`
              SELECT id FROM call_disposition_inconsistencies 
              WHERE call_sid = ${call.twilio_call_sid}
                AND agent_email = ${agentEmail}
            `;

            if (existingInconsistency.length === 0) {
              await sql`
                INSERT INTO call_disposition_inconsistencies (
                  call_sid, agent_email, call_duration, to_number, from_number,
                  call_direction, reported_outcome, issue_type, accountability_date, 
                  resolved, created_at, updated_at
                ) VALUES (
                  ${call.twilio_call_sid}, ${agentEmail}, ${call.call_duration},
                  ${call.to_number}, ${call.from_number}, ${call.call_direction},
                  'set_appointment', 'phantom_booking', ${callDate},
                  false, NOW(), NOW()
                )
              `;
              totalRecordsAdded++;
              console.log(`➕ Added phantom booking record for ${agentEmail}`);
            }
          }
        }
      }
    }

    // 3. Process PostgreSQL twilio_call_logs for ALL agents
    console.log('📊 Checking PostgreSQL twilio_call_logs...');
    
    const pgCalls = await sql`
      SELECT twilio_call_sid, call_duration, call_started_at, owner_email,
             call_direction, to_number, from_number, metadata
      FROM twilio_call_logs 
      WHERE call_duration >= 240 
        AND call_status = 'completed'
        AND call_started_at >= NOW() - INTERVAL '30 days'
      ORDER BY call_started_at DESC
      LIMIT 500
    `;

    if (pgCalls.length > 0) {
      console.log(`📞 Found ${pgCalls.length} calls over 4 minutes in PostgreSQL`);
      totalCallsFound += pgCalls.length;

      for (const call of pgCalls) {
        const callDate = call.call_started_at.toISOString().split('T')[0];
        const agentEmail = call.owner_email;
        
        if (!agentEmail) {
          console.log(`⚠️ Skipping PG call ${call.twilio_call_sid} - no owner email`);
          continue;
        }

        // Check if accountability record already exists
        const existingReport = await sql`
          SELECT id FROM daily_accountability 
          WHERE agent_email = ${agentEmail} 
            AND DATE(accountability_date) = ${callDate}
            AND has_completed_report = true
        `;

        if (existingReport.length === 0) {
          console.log(`➕ Adding PG accountability for ${agentEmail} on ${callDate} (PG call ${call.twilio_call_sid})`);
          
          try {
            await sql`
              INSERT INTO daily_accountability (
                agent_email, accountability_date, has_completed_report, 
                unresolved_calls_count, call_details, created_at, updated_at
              ) VALUES (
                ${agentEmail}, ${callDate}, false, 1,
                ${JSON.stringify([{
                  call_sid: call.twilio_call_sid,
                  duration: call.call_duration,
                  direction: call.call_direction,
                  to_number: call.to_number,
                  from_number: call.from_number,
                  created_at: call.call_started_at.toISOString(),
                  source: 'postgresql'
                }])},
                NOW(), NOW()
              )
              ON CONFLICT (agent_email, accountability_date) DO UPDATE SET
                unresolved_calls_count = daily_accountability.unresolved_calls_count + 1,
                call_details = daily_accountability.call_details || ${JSON.stringify([{
                  call_sid: call.twilio_call_sid,
                  duration: call.call_duration,
                  direction: call.call_direction,
                  to_number: call.to_number,
                  from_number: call.from_number,
                  created_at: call.call_started_at.toISOString(),
                  source: 'postgresql'
                }])},
                updated_at = NOW()
            `;
            totalRecordsAdded++;
          } catch (insertError) {
            console.error(`❌ Failed to insert PG accountability record for ${agentEmail}: ${insertError.message}`);
          }
        }

        // Check for PG phantom bookings too
        const isBooked = call.metadata && 
          (call.metadata.disposition === 'set_appointment' || 
           call.metadata.outcome === 'booked' ||
           call.metadata.result === 'appointment');

        if (isBooked && call.call_duration >= 90 && call.call_duration <= 600) {
          const appointments = await sql`
            SELECT id FROM appointments 
            WHERE agent_email = ${agentEmail} 
              AND DATE(start_time) = ${callDate}
          `;

          if (appointments.length === 0) {
            console.log(`🚨 PG PHANTOM BOOKING: ${agentEmail} - Call ${call.twilio_call_sid} marked booked but no appointment on ${callDate}`);
            totalPhantomBookings++;

            const existingInconsistency = await sql`
              SELECT id FROM call_disposition_inconsistencies 
              WHERE call_sid = ${call.twilio_call_sid}
                AND agent_email = ${agentEmail}
            `;

            if (existingInconsistency.length === 0) {
              await sql`
                INSERT INTO call_disposition_inconsistencies (
                  call_sid, agent_email, call_duration, to_number, from_number,
                  call_direction, reported_outcome, issue_type, accountability_date, 
                  resolved, created_at, updated_at
                ) VALUES (
                  ${call.twilio_call_sid}, ${agentEmail}, ${call.call_duration},
                  ${call.to_number}, ${call.from_number}, ${call.call_direction},
                  'set_appointment', 'phantom_booking', ${callDate},
                  false, NOW(), NOW()
                )
              `;
              totalRecordsAdded++;
              console.log(`➕ Added PG phantom booking record for ${agentEmail}`);
            }
          }
        }
      }
    }

    console.log('\n✅ RETROACTIVE ACCOUNTABILITY FIX COMPLETE');
    console.log(`📊 Total calls found needing accountability: ${totalCallsFound}`);
    console.log(`🚨 Total phantom bookings detected: ${totalPhantomBookings}`);
    console.log(`➕ Total accountability records added: ${totalRecordsAdded}`);
    console.log('\n🎯 All agents now have proper accountability tracking for significant calls!');

  } catch (error) {
    console.error('❌ Retroactive accountability fix failed:', error);
    throw error;
  }
}

// Run the fix
retroactiveAccountabilityFix()
  .then(() => {
    console.log('🎉 Retroactive accountability fix completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Retroactive accountability fix failed:', error);
    process.exit(1);
  });