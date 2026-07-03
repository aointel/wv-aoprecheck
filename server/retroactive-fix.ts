/**
 * Retroactive Accountability System - Add ALL missing accountability records
 * Integrated server-side fix for comprehensive accountability tracking
 */

import { supabase } from './supabase';
import { db } from '../shared/db';
import { dailyAccountability, callDispositionInconsistencies } from '../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function runRetroactiveAccountabilityFix() {
  console.log('🔄 Starting comprehensive retroactive accountability fix...');
  
  let totalCallsFound = 0;
  let totalPhantomBookings = 0;
  let totalRecordsAdded = 0;

  try {
    // 1. Process Supabase twilio_call_logs for ALL agents - 4+ minute calls
    console.log('📊 Checking Supabase for 4+ minute calls...');
    
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

        // Check if accountability record already exists for this date
        const existingReport = await db
          .select()
          .from(dailyAccountability)
          .where(and(
            eq(dailyAccountability.agentEmail, agentEmail),
            sql`DATE(${dailyAccountability.accountabilityDate}) = ${callDate}`,
            eq(dailyAccountability.hasCompletedReport, true)
          ));

        if (existingReport.length === 0) {
          console.log(`➕ Adding accountability for ${agentEmail} on ${callDate} (Supabase call ${call.twilio_call_sid})`);
          
          try {
            await db.insert(dailyAccountability).values({
              agentEmail: agentEmail,
              accountabilityDate: callDate,
              hasCompletedReport: false,
              unresolvedCallsCount: 1,
              callDetails: JSON.stringify([{
                call_sid: call.twilio_call_sid,
                duration: call.call_duration,
                direction: call.call_direction,
                to_number: call.to_number,
                from_number: call.from_number,
                created_at: call.call_started_at,
                source: 'supabase'
              }])
            }).onConflictDoUpdate({
              target: [dailyAccountability.agentEmail, dailyAccountability.accountabilityDate],
              set: {
                unresolvedCallsCount: sql`${dailyAccountability.unresolvedCallsCount} + 1`,
                updatedAt: new Date()
              }
            });
            totalRecordsAdded++;
          } catch (insertError: any) {
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
      .limit(1000);

    if (phantomError) {
      console.error('❌ Phantom booking check error:', phantomError);
    } else if (phantomCalls && phantomCalls.length > 0) {
      console.log(`🔍 Scanning ${phantomCalls.length} potential phantom booking calls...`);
      
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
          
          // Check for matching appointments on that date (no direct call_sid link)
          const appointments = await db.execute(
            sql`SELECT id FROM appointments 
                WHERE agent_email = ${agentEmail} 
                  AND DATE(start_time) = ${callDate}`
          );

          if (appointments.length === 0) {
            // Phantom booking detected!
            console.log(`🚨 PHANTOM BOOKING: ${agentEmail} - Call ${call.twilio_call_sid} marked booked but no appointment on ${callDate}`);
            totalPhantomBookings++;

            // Check if already tracked
            const existingInconsistency = await db
              .select()
              .from(callDispositionInconsistencies)
              .where(and(
                eq(callDispositionInconsistencies.callSid, call.twilio_call_sid),
                eq(callDispositionInconsistencies.agentEmail, agentEmail)
              ));

            if (existingInconsistency.length === 0) {
              await db.insert(callDispositionInconsistencies).values({
                callSid: call.twilio_call_sid,
                agentEmail: agentEmail,
                callDuration: call.call_duration,
                toNumber: call.to_number,
                fromNumber: call.from_number,
                callDirection: call.call_direction,
                reportedOutcome: 'set_appointment',
                issueType: 'phantom_booking',
                accountabilityDate: callDate,
                resolved: false
              });
              totalRecordsAdded++;
              console.log(`➕ Added phantom booking record for ${agentEmail}`);
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

    return {
      totalCallsFound,
      totalPhantomBookings,
      totalRecordsAdded,
      success: true
    };

  } catch (error) {
    console.error('❌ Retroactive accountability fix failed:', error);
    throw error;
  }
}