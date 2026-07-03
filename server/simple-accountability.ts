/**
 * Simple Accountability System - Exactly what the user requested:
 * 1. Check Twilio for 4+ minute calls
 * 2. Check masterlead and hotlead on Supabase for resolutions
 */

import { supabase } from './supabase';
import { db } from '../shared/db';
import { dailyAccountability } from '../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function runSimpleAccountabilityCheck(agentEmail: string) {
  console.log(`🔍 Simple accountability check for ${agentEmail}`);
  
  let unresolvedCalls = [];
  let totalCallsChecked = 0;
  
  try {
    // Step 1: Check Twilio for 4+ minute calls
    const longCalls = await db
      .execute(sql`
        SELECT twilio_call_sid, call_duration, call_started_at, to_number, from_number, call_direction
        FROM twilio_call_logs 
        WHERE owner_email = ${agentEmail}
          AND call_duration >= 240 
          AND call_status = 'completed'
          AND call_started_at >= NOW() - INTERVAL '30 days'
        ORDER BY call_started_at DESC
        LIMIT 50
      `);

    totalCallsChecked = longCalls.length;
    console.log(`📞 Found ${totalCallsChecked} calls over 4 minutes for ${agentEmail}`);

    if (longCalls.length === 0) {
      return {
        unresolvedCalls: [],
        totalCallsChecked: 0,
        message: 'No calls over 4 minutes found'
      };
    }

    // Step 2: For each call, check Supabase masterlead and hotlead for resolutions
    for (const call of longCalls) {
      const phoneNumber = call.to_number || call.from_number;
      if (!phoneNumber) continue;

      // Clean phone number for search
      const cleanPhone = phoneNumber.replace(/\D/g, '').replace(/^1/, '');
      
      // Check masterlead table for resolution
      const { data: masterleadMatch } = await supabase
        .from('masterlead')
        .select('phone, first_name, last_name, disposition, agent_email')
        .eq('phone', cleanPhone)
        .eq('agent_email', agentEmail);

      // Check hotlead table for resolution  
      const { data: hotleadMatch } = await supabase
        .from('masterlead')
        .select('phone, first_name, last_name, disposition, agent_email')
        .eq('phone', cleanPhone)
        .eq('agent_email', agentEmail);

      // Determine if call has resolution
      const hasResolution = 
        (masterleadMatch && masterleadMatch.length > 0 && masterleadMatch[0].disposition) ||
        (hotleadMatch && hotleadMatch.length > 0 && hotleadMatch[0].disposition);

      if (!hasResolution) {
        // This call needs accountability
        unresolvedCalls.push({
          call_sid: call.twilio_call_sid,
          duration: call.call_duration,
          phone: phoneNumber,
          date: call.call_started_at,
          direction: call.call_direction,
          leadMatch: masterleadMatch?.[0] || hotleadMatch?.[0] || null
        });
      }
    }

    console.log(`✅ Accountability check complete: ${unresolvedCalls.length} unresolved out of ${totalCallsChecked} calls`);

    return {
      unresolvedCalls,
      totalCallsChecked,
      message: `Found ${unresolvedCalls.length} calls needing disposition out of ${totalCallsChecked} total 4+ minute calls`
    };

  } catch (error) {
    console.error('❌ Simple accountability check failed:', error);
    throw error;
  }
}