/**
 * Weekly Usage Tracker
 * Tracks agent activity: logins, online time, VDP connects, dials made
 */

import { db } from './db';
import { sql } from 'drizzle-orm';
import { supabaseAdmin } from './supabase';
import { mapEmailToRealEmail, ensureRealEmailInWeeklyStats } from './email-mapper';

export class UsageTracker {
  
  /**
   * Track a login event
   */
  static async trackLogin(agentEmail: string, sessionId: string, ipAddress?: string) {
    try {
      // Log activity to Supabase
      if (supabaseAdmin) {
        await supabaseAdmin
          .from('agent_activity_log')
          .insert({
            agent_email: agentEmail.toLowerCase(),
            activity_type: 'login',
            session_id: sessionId,
            timestamp: new Date().toISOString()
          });
      }
      
      // Update weekly stats in Supabase
      if (supabaseAdmin) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        // Map to real email
        const realEmail = await mapEmailToRealEmail(agentEmail);
        const weekStartStr = weekStart.toISOString().split('T')[0];
        
        // Delete numeric email record if it exists and is different
        if (realEmail !== agentEmail.toLowerCase().trim()) {
          await supabaseAdmin
            .from('weekly_usage_stats')
            .delete()
            .eq('agent_email', agentEmail.toLowerCase().trim())
            .eq('week_start_date', weekStartStr);
        }
        
        // Increment atomically using PostgreSQL RPC function
        let incrementError: any = null;
        try {
          const rpcResult = await supabaseAdmin.rpc('increment_login_stats', {
            p_agent_email: realEmail,
            p_week_start_date: weekStartStr
          });
          incrementError = rpcResult?.error || null;
          if (incrementError?.code === 'PGRST202') {
            // Function doesn't exist in Supabase - skip silently, use fallback below
            incrementError = null;
          }
        } catch (rpcError) {
          // If RPC doesn't exist, fall back to read-then-update
          console.warn('⚠️ RPC increment_login_stats not available, using fallback:', rpcError);
          
          // Get unique login days from Supabase (using real email)
          const { data: logins } = await supabaseAdmin
            .from('agent_activity_log')
            .select('timestamp')
            .eq('agent_email', realEmail)
            .eq('activity_type', 'login')
            .gte('timestamp', weekStart.toISOString());
          
          const uniqueDays = new Set(logins?.map(l => new Date(l.timestamp).toDateString()) || []).size;
          
          // Get current stats or create new
          const { data: currentStats } = await supabaseAdmin
            .from('weekly_usage_stats')
            .select('total_logins')
            .eq('agent_email', realEmail)
            .eq('week_start_date', weekStartStr)
            .maybeSingle();
          
          // Upsert weekly stats with real email
          const { error: upsertError } = await supabaseAdmin
            .from('weekly_usage_stats')
            .upsert({
              agent_email: realEmail,
              week_start_date: weekStartStr,
              week_end_date: weekEnd.toISOString().split('T')[0],
              total_logins: (currentStats?.total_logins || 0) + 1,
              unique_login_days: uniqueDays,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'agent_email,week_start_date'
            });
          
          incrementError = upsertError || null;
        }
        
        if (incrementError) {
          console.error('❌ Error incrementing login stats:', incrementError);
        }
      }
      
      console.log(`✅ Tracked login for ${agentEmail}`);
    } catch (error) {
      console.error('❌ Error tracking login:', error);
    }
  }
  
  /**
   * Track heartbeat (for calculating online time)
   */
  static async trackHeartbeat(agentEmail: string, sessionId: string) {
    try {
      console.log(`💓 Tracking heartbeat for ${agentEmail}, session: ${sessionId}`);
      
      // Insert heartbeat into Supabase agent_activity_log table
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from('agent_activity_log')
          .insert({
            agent_email: agentEmail.toLowerCase(),
            activity_type: 'heartbeat',
            session_id: sessionId,
            timestamp: new Date().toISOString() // Supabase uses timestamp column
          })
          .select('id')
          .single();
        
        if (error) {
          console.error('❌ Supabase heartbeat insert failed:', error);
          console.error('❌ Error details:', JSON.stringify(error, null, 2));
          throw error;
        }
        
        console.log(`✅ Heartbeat inserted into Supabase agent_activity_log:`, data?.id || 'no id returned');
      } else {
        console.error('❌ supabaseAdmin not available!');
        throw new Error('Supabase admin client not configured');
      }
      
      // Ensure weekly stats record exists in Supabase (create if it doesn't)
      if (supabaseAdmin) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        const { data: statsData, error: statsError } = await supabaseAdmin
          .from('weekly_usage_stats')
          .upsert({
            agent_email: agentEmail.toLowerCase(),
            week_start_date: weekStart.toISOString().split('T')[0],
            week_end_date: weekEnd.toISOString().split('T')[0],
            last_activity_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'agent_email,week_start_date'
          })
          .select('id')
          .single();
        
        if (statsError) {
          console.error('❌ Error upserting weekly stats:', statsError);
        } else {
          console.log(`✅ Weekly stats updated in Supabase:`, statsData?.id || 'no id returned');
        }
      }
      
      console.log(`💓 Heartbeat logged successfully for ${agentEmail}`);
    } catch (error) {
      console.error('❌ Error tracking heartbeat:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('❌ Stack trace:', error.stack);
      }
      // Re-throw so the API endpoint can see it failed
      throw error;
    }
  }
  
  /**
   * Track VDP connect received
   */
  static async trackVDPConnect(agentEmail: string, callDuration?: number) {
    try {
      // Log activity to Supabase agent_activity_log
      if (supabaseAdmin) {
        await supabaseAdmin
          .from('agent_activity_log')
          .insert({
            agent_email: agentEmail.toLowerCase(),
            activity_type: 'vdp_connect',
            session_id: `vdp-${Date.now()}`,
            timestamp: new Date().toISOString(),
            activity_data: callDuration ? { duration_minutes: Math.round(callDuration) } : null
          });
      }
      
      if (supabaseAdmin) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        // Map to real email
        const realEmail = await mapEmailToRealEmail(agentEmail);
        const weekStartStr = weekStart.toISOString().split('T')[0];
        
        // Delete numeric email record if it exists and is different
        if (realEmail !== agentEmail.toLowerCase().trim()) {
          await supabaseAdmin
            .from('weekly_usage_stats')
            .delete()
            .eq('agent_email', agentEmail.toLowerCase().trim())
            .eq('week_start_date', weekStartStr);
        }
        
        // First ensure record exists with real email
        await supabaseAdmin
          .from('weekly_usage_stats')
          .upsert({
            agent_email: realEmail,
            week_start_date: weekStartStr,
            week_end_date: weekEnd.toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'agent_email,week_start_date'
          });
        
        // Then increment atomically using PostgreSQL RPC function
        let incrementError: any = null;
        try {
          const rpcResult = await supabaseAdmin.rpc('increment_vdp_stats', {
            p_agent_email: realEmail,
            p_week_start_date: weekStartStr,
            p_vdp_connects: 1,
            p_vdp_minutes: Math.round(callDuration || 0)
          });
          incrementError = rpcResult?.error || null;
        } catch (rpcError) {
          // If RPC doesn't exist, fall back to read-then-update
          console.warn('⚠️ RPC increment_vdp_stats not available, using fallback:', rpcError);
          const { data: current } = await supabaseAdmin
            .from('weekly_usage_stats')
            .select('vdp_connects_received, vdp_total_minutes')
            .eq('agent_email', realEmail)
            .eq('week_start_date', weekStartStr)
            .maybeSingle();
          
          const { error: updateError, data: updateData } = await supabaseAdmin
            .from('weekly_usage_stats')
            .update({
              vdp_connects_received: (current?.vdp_connects_received || 0) + 1,
              vdp_total_minutes: (current?.vdp_total_minutes || 0) + Math.round(callDuration || 0),
              updated_at: new Date().toISOString()
            })
            .eq('agent_email', realEmail)
            .eq('week_start_date', weekStartStr)
            .select();
          
          if (updateError) {
            console.error('❌ Fallback update failed:', updateError);
            incrementError = updateError || null;
          }
          
          // Verify the update worked
          if (!updateData || updateData.length === 0) {
            console.warn('⚠️ Update returned no data - record may not exist');
          } else {
            console.log(`✅ Fallback update succeeded: VDP connects = ${updateData[0]?.vdp_connects_received}`);
          }
          
          incrementError = null;
        }
        
        if (incrementError) {
          console.error('❌ Error incrementing VDP stats:', incrementError);
        }
      }
      
      console.log(`✅ Tracked VDP connect for ${agentEmail} (${callDuration || 0} min)`);
    } catch (error) {
      console.error('❌ Error tracking VDP connect:', error);
    }
  }
  
  /**
   * Track outbound dial made
   */
  static async trackDialMade(agentEmail: string, callDuration?: number) {
    try {
      // Log activity to Supabase agent_activity_log
      if (supabaseAdmin) {
        await supabaseAdmin
          .from('agent_activity_log')
          .insert({
            agent_email: agentEmail.toLowerCase(),
            activity_type: 'dial_made',
            session_id: `dial-${Date.now()}`,
            timestamp: new Date().toISOString(),
            activity_data: callDuration ? { duration_minutes: Math.round(callDuration) } : null
          });
      }
      
      if (supabaseAdmin) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        // Map to real email
        const realEmail = await mapEmailToRealEmail(agentEmail);
        const weekStartStr = weekStart.toISOString().split('T')[0];
        
        // Delete numeric email record if it exists and is different
        if (realEmail !== agentEmail.toLowerCase().trim()) {
          await supabaseAdmin
            .from('weekly_usage_stats')
            .delete()
            .eq('agent_email', agentEmail.toLowerCase().trim())
            .eq('week_start_date', weekStartStr);
        }
        
        // First ensure record exists with real email
        await supabaseAdmin
          .from('weekly_usage_stats')
          .upsert({
            agent_email: realEmail,
            week_start_date: weekStartStr,
            week_end_date: weekEnd.toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'agent_email,week_start_date'
          });
        
        // Then increment atomically using PostgreSQL RPC function
        let incrementError: any = null;
        try {
          const rpcResult = await supabaseAdmin.rpc('increment_dial_stats', {
            p_agent_email: realEmail,
            p_week_start_date: weekStartStr,
            p_dials: 1,
            p_call_minutes: Math.round(callDuration || 0)
          });
          incrementError = rpcResult?.error || null;
        } catch (rpcError) {
          // If RPC doesn't exist, fall back to read-then-update
          console.warn('⚠️ RPC increment_dial_stats not available, using fallback:', rpcError);
          const { data: current } = await supabaseAdmin
            .from('weekly_usage_stats')
            .select('total_dials_made, total_call_minutes')
            .eq('agent_email', realEmail)
            .eq('week_start_date', weekStartStr)
            .maybeSingle();
          
          const { error: updateError, data: updateData } = await supabaseAdmin
            .from('weekly_usage_stats')
            .update({
              total_dials_made: (current?.total_dials_made || 0) + 1,
              total_call_minutes: (current?.total_call_minutes || 0) + Math.round(callDuration || 0),
              updated_at: new Date().toISOString()
            })
            .eq('agent_email', realEmail)
            .eq('week_start_date', weekStartStr)
            .select();
          
          if (updateError) {
            console.error('❌ Fallback update failed:', updateError);
            incrementError = updateError || null;
          }
          
          // Verify the update worked
          if (!updateData || updateData.length === 0) {
            console.warn('⚠️ Update returned no data - record may not exist');
          } else {
            console.log(`✅ Fallback update succeeded: Dials = ${updateData[0]?.total_dials_made}`);
          }
          
          incrementError = null;
        }
        
        if (incrementError) {
          console.error('❌ Error incrementing dial stats:', incrementError);
        }
      }
      
      console.log(`✅ Tracked dial for ${agentEmail} (${callDuration || 0} min)`);
    } catch (error) {
      console.error('❌ Error tracking dial:', error);
    }
  }
  
  /**
   * Track appointment scheduled
   */
  static async trackAppointment(agentEmail: string) {
    try {
      // Log activity to Supabase agent_activity_log
      if (supabaseAdmin) {
        await supabaseAdmin
          .from('agent_activity_log')
          .insert({
            agent_email: agentEmail.toLowerCase(),
            activity_type: 'appointment_scheduled',
            session_id: `appt-${Date.now()}`,
            timestamp: new Date().toISOString()
          });
      }
      
      if (supabaseAdmin) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        // Map to real email
        const realEmail = await mapEmailToRealEmail(agentEmail);
        const weekStartStr = weekStart.toISOString().split('T')[0];
        
        // Delete numeric email record if it exists and is different
        if (realEmail !== agentEmail.toLowerCase().trim()) {
          await supabaseAdmin
            .from('weekly_usage_stats')
            .delete()
            .eq('agent_email', agentEmail.toLowerCase().trim())
            .eq('week_start_date', weekStartStr);
        }
        
        // First ensure record exists with real email
        await supabaseAdmin
          .from('weekly_usage_stats')
          .upsert({
            agent_email: realEmail,
            week_start_date: weekStartStr,
            week_end_date: weekEnd.toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'agent_email,week_start_date'
          });
        
        // Then increment atomically using PostgreSQL RPC function
        let incrementError: any = null;
        try {
          const rpcResult = await supabaseAdmin.rpc('increment_appointment_stats', {
            p_agent_email: realEmail,
            p_week_start_date: weekStartStr
          });
          incrementError = rpcResult?.error || null;
        } catch (rpcError) {
          // If RPC doesn't exist, fall back to read-then-update
          console.warn('⚠️ RPC increment_appointment_stats not available, using fallback:', rpcError);
          const { data: current } = await supabaseAdmin
            .from('weekly_usage_stats')
            .select('appointments_scheduled')
            .eq('agent_email', realEmail)
            .eq('week_start_date', weekStartStr)
            .maybeSingle();
          
          const { error: updateError, data: updateData } = await supabaseAdmin
            .from('weekly_usage_stats')
            .update({
              appointments_scheduled: (current?.appointments_scheduled || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('agent_email', realEmail)
            .eq('week_start_date', weekStartStr)
            .select();
          
          if (updateError) {
            console.error('❌ Fallback update failed:', updateError);
            incrementError = updateError || null;
          }
          
          // Verify the update worked
          if (!updateData || updateData.length === 0) {
            console.warn('⚠️ Update returned no data - record may not exist');
          } else {
            console.log(`✅ Fallback update succeeded: Appointments = ${updateData[0]?.appointments_scheduled}`);
          }
          
          incrementError = null;
        }
        
        if (incrementError) {
          console.error('❌ Error incrementing appointment stats:', incrementError);
        }
      }
      
      console.log(`✅ Tracked appointment for ${agentEmail}`);
    } catch (error) {
      console.error('❌ Error tracking appointment:', error);
    }
  }
  
  /**
   * Track sale made
   */
  static async trackSale(agentEmail: string, alpAmount: number) {
    try {
      // Log activity to Supabase agent_activity_log
      if (supabaseAdmin) {
        await supabaseAdmin
          .from('agent_activity_log')
          .insert({
            agent_email: agentEmail.toLowerCase(),
            activity_type: 'sale_made',
            session_id: `sale-${Date.now()}`,
            timestamp: new Date().toISOString(),
            activity_data: { alp_amount: alpAmount }
          });
      }
      
      if (supabaseAdmin) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        // Map to real email
        const realEmail = await mapEmailToRealEmail(agentEmail);
        const weekStartStr = weekStart.toISOString().split('T')[0];
        
        // First ensure record exists with real email
        await supabaseAdmin
          .from('weekly_usage_stats')
          .upsert({
            agent_email: realEmail,
            week_start_date: weekStartStr,
            week_end_date: weekEnd.toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'agent_email,week_start_date'
          });
        
        // Delete numeric email record if it exists and is different
        if (realEmail !== agentEmail.toLowerCase().trim()) {
          await supabaseAdmin
            .from('weekly_usage_stats')
            .delete()
            .eq('agent_email', agentEmail.toLowerCase().trim())
            .eq('week_start_date', weekStartStr);
        }
        
        // Then increment atomically using PostgreSQL RPC function
        let incrementError: any = null;
        try {
          const rpcResult = await supabaseAdmin.rpc('increment_sale_stats', {
            p_agent_email: realEmail,
            p_week_start_date: weekStartStr,
            p_alp_amount: alpAmount
          });
          incrementError = rpcResult?.error || null;
        } catch (rpcError) {
          // If RPC doesn't exist, fall back to read-then-update
          console.warn('⚠️ RPC increment_sale_stats not available, using fallback:', rpcError);
          const { data: current } = await supabaseAdmin
            .from('weekly_usage_stats')
            .select('sales_made, total_alp')
            .eq('agent_email', realEmail)
            .eq('week_start_date', weekStartStr)
            .maybeSingle();
          
          const { error: updateError, data: updateData } = await supabaseAdmin
            .from('weekly_usage_stats')
            .update({
              sales_made: (current?.sales_made || 0) + 1,
              total_alp: (current?.total_alp || 0) + alpAmount,
              updated_at: new Date().toISOString()
            })
            .eq('agent_email', realEmail)
            .eq('week_start_date', weekStartStr)
            .select();
          
          if (updateError) {
            console.error('❌ Fallback update failed:', updateError);
            incrementError = updateError || null;
          }
          
          // Verify the update worked
          if (!updateData || updateData.length === 0) {
            console.warn('⚠️ Update returned no data - record may not exist');
          } else {
            console.log(`✅ Fallback update succeeded: Sales = ${updateData[0]?.sales_made}, ALP = $${updateData[0]?.total_alp}`);
          }
          
          incrementError = null;
        }
        
        if (incrementError) {
          console.error('❌ Error incrementing sale stats:', incrementError);
        }
      }
      
      console.log(`✅ Tracked sale for ${agentEmail} ($${alpAmount} ALP)`);
    } catch (error) {
      console.error('❌ Error tracking sale:', error);
    }
  }
  
  /**
   * Calculate online time for current week
   * Based on heartbeat logs (heartbeat every 60 seconds when active)
   */
  static async calculateOnlineTime(agentEmail: string): Promise<number> {
    try {
      const result = await db.execute(sql`
        WITH current_week AS (
          SELECT (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)) as week_start
        ),
        heartbeats AS (
          SELECT timestamp
          FROM agent_activity_log
          WHERE agent_email = ${agentEmail}
            AND activity_type IN ('heartbeat', 'login', 'page_view')
            AND timestamp >= (SELECT week_start FROM current_week)
          ORDER BY timestamp
        ),
        time_gaps AS (
          SELECT 
            timestamp,
            LAG(timestamp) OVER (ORDER BY timestamp) as prev_timestamp,
            EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (ORDER BY timestamp)))/60 as gap_minutes
          FROM heartbeats
        )
        SELECT 
          SUM(CASE 
            WHEN gap_minutes IS NULL THEN 1
            WHEN gap_minutes <= 2 THEN gap_minutes
            ELSE 1
          END) as total_minutes
        FROM time_gaps
      `);
      
      const totalMinutes = result.rows[0]?.total_minutes || 0;
      
      // Update weekly stats with calculated time
      await db.execute(sql`
        WITH current_week AS (
          SELECT (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER))::DATE as week_start
        )
        UPDATE weekly_usage_stats
        SET 
          total_online_minutes = ${Math.round(totalMinutes)},
          updated_at = NOW()
        WHERE agent_email = ${agentEmail}
          AND week_start_date = (SELECT week_start FROM current_week)
      `);
      
      return Math.round(totalMinutes);
    } catch (error) {
      console.error('❌ Error calculating online time:', error);
      return 0;
    }
  }
  
  /**
   * Get weekly stats for an agent
   */
  static async getWeeklyStats(agentEmail: string) {
    try {
      const result = await db.execute(sql`
        SELECT *
        FROM weekly_usage_stats
        WHERE agent_email = ${agentEmail}
          AND week_start_date = (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER))::DATE
      `);
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error getting weekly stats:', error);
      return null;
    }
  }
  
  /**
   * Track VDP available start (when VDP toggle turns ON)
   */
  static async trackVDPAvailableStart(agentEmail: string, sessionId: string) {
    try {
      // Log activity
      await db.execute(sql`
        INSERT INTO agent_activity_log (agent_email, activity_type, session_id, timestamp)
        VALUES (${agentEmail}, 'vdp_available_start', ${sessionId}, NOW())
      `);
      
      console.log(`✅ Tracked VDP available start for ${agentEmail}`);
    } catch (error) {
      console.error('❌ Error tracking VDP available start:', error);
    }
  }

  /**
   * Track VDP available end (when VDP toggle turns OFF)
   * Calculates duration from last start event and updates weekly stats
   */
  static async trackVDPAvailableEnd(agentEmail: string, sessionId: string) {
    try {
      // Find the most recent vdp_available_start event for this agent/session
      const startResult = await db.execute(sql`
        SELECT id, timestamp
        FROM agent_activity_log
        WHERE agent_email = ${agentEmail}
          AND activity_type = 'vdp_available_start'
          AND session_id = ${sessionId}
          AND timestamp >= NOW() - INTERVAL '24 hours'
        ORDER BY timestamp DESC
        LIMIT 1
      `);

      const startEvent = startResult.rows[0];
      let durationMinutes = 0;

      if (startEvent) {
        // Calculate duration in minutes
        const durationResult = await db.execute(sql`
          SELECT EXTRACT(EPOCH FROM (NOW() - ${startEvent.timestamp}::timestamptz)) / 60 as duration_minutes
        `);
        durationMinutes = Math.round(durationResult.rows[0]?.duration_minutes || 0);
      }

      // Log end activity
      await db.execute(sql`
        INSERT INTO agent_activity_log (agent_email, activity_type, session_id, timestamp, activity_data)
        VALUES (${agentEmail}, 'vdp_available_end', ${sessionId}, NOW(), ${JSON.stringify({ duration_minutes: durationMinutes })}::jsonb)
      `);

      // Update weekly stats if we have a valid duration
      if (durationMinutes > 0) {
        await db.execute(sql`
          WITH current_week AS (
            SELECT 
              (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER))::DATE as week_start,
              ((CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)) + INTERVAL '6 days')::DATE as week_end
          )
          INSERT INTO weekly_usage_stats (
            agent_email,
            week_start_date,
            week_end_date,
            vdp_available_minutes,
            updated_at
          )
          SELECT 
            ${agentEmail},
            week_start,
            week_end,
            ${durationMinutes},
            NOW()
          FROM current_week
          ON CONFLICT (agent_email, week_start_date) 
          DO UPDATE SET 
            vdp_available_minutes = weekly_usage_stats.vdp_available_minutes + ${durationMinutes},
            updated_at = NOW()
        `);
      }

      console.log(`✅ Tracked VDP available end for ${agentEmail} (${durationMinutes} min)`);
    } catch (error) {
      console.error('❌ Error tracking VDP available end:', error);
    }
  }

  /**
   * Track Call Connector Pro call start
   */
  static async trackCCProCallStart(agentEmail: string, sessionId: string, callId?: string) {
    try {
      // Log activity with callId in activity_data
      await db.execute(sql`
        INSERT INTO agent_activity_log (agent_email, activity_type, session_id, timestamp, activity_data)
        VALUES (
          ${agentEmail}, 
          'ccpro_call_start', 
          ${sessionId}, 
          NOW(),
          ${callId ? JSON.stringify({ call_id: callId }) : null}::jsonb
        )
      `);
      
      console.log(`✅ Tracked CCPro call start for ${agentEmail}${callId ? ` (callId: ${callId})` : ''}`);
    } catch (error) {
      console.error('❌ Error tracking CCPro call start:', error);
    }
  }

  /**
   * Track Call Connector Pro call end
   * Calculates duration from last start event and updates weekly stats
   */
  static async trackCCProCallEnd(agentEmail: string, sessionId: string, callId?: string, duration?: number) {
    try {
      let durationMinutes = 0;

      if (duration !== undefined && duration > 0) {
        // Use provided duration (in seconds, convert to minutes)
        durationMinutes = Math.round(duration / 60);
      } else {
        // Find the most recent ccpro_call_start event
        let query = sql`
          SELECT id, timestamp, activity_data
          FROM agent_activity_log
          WHERE agent_email = ${agentEmail}
            AND activity_type = 'ccpro_call_start'
            AND timestamp >= NOW() - INTERVAL '24 hours'
        `;

        if (callId) {
          query = sql`
            SELECT id, timestamp, activity_data
            FROM agent_activity_log
            WHERE agent_email = ${agentEmail}
              AND activity_type = 'ccpro_call_start'
              AND activity_data->>'call_id' = ${callId}
              AND timestamp >= NOW() - INTERVAL '24 hours'
            ORDER BY timestamp DESC
            LIMIT 1
          `;
        } else {
          query = sql`
            SELECT id, timestamp, activity_data
            FROM agent_activity_log
            WHERE agent_email = ${agentEmail}
              AND activity_type = 'ccpro_call_start'
              AND session_id = ${sessionId}
              AND timestamp >= NOW() - INTERVAL '24 hours'
            ORDER BY timestamp DESC
            LIMIT 1
          `;
        }

        const startResult = await db.execute(query);
        const startEvent = startResult.rows[0];

        if (startEvent) {
          // Calculate duration in minutes
          const durationResult = await db.execute(sql`
            SELECT EXTRACT(EPOCH FROM (NOW() - ${startEvent.timestamp}::timestamptz)) / 60 as duration_minutes
          `);
          durationMinutes = Math.round(durationResult.rows[0]?.duration_minutes || 0);
        }
      }

      // Log end activity
      await db.execute(sql`
        INSERT INTO agent_activity_log (agent_email, activity_type, session_id, timestamp, activity_data)
        VALUES (
          ${agentEmail}, 
          'ccpro_call_end', 
          ${sessionId}, 
          NOW(),
          ${JSON.stringify({ 
            call_id: callId || null,
            duration_minutes: durationMinutes 
          })}::jsonb
        )
      `);

      // Update weekly stats in Supabase if we have a valid duration - increment atomically
      if (durationMinutes > 0 && supabaseAdmin) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        // First ensure record exists
        await supabaseAdmin
          .from('weekly_usage_stats')
          .upsert({
            agent_email: agentEmail.toLowerCase(),
            week_start_date: weekStart.toISOString().split('T')[0],
            week_end_date: weekEnd.toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'agent_email,week_start_date'
          });
        
        // Then increment atomically using PostgreSQL RPC function
        let incrementError: any = null;
        try {
          const rpcResult = await supabaseAdmin.rpc('increment_ccpro_stats', {
            p_agent_email: agentEmail.toLowerCase(),
            p_week_start_date: weekStart.toISOString().split('T')[0],
            p_ccpro_minutes: durationMinutes,
            p_dials: 1
          });
          incrementError = rpcResult?.error || null;
        } catch (rpcError) {
          // If RPC doesn't exist, fall back to read-then-update
          console.warn('⚠️ RPC increment_ccpro_stats not available, using fallback:', rpcError);
          const { data: current } = await supabaseAdmin
            .from('weekly_usage_stats')
            .select('ccpro_call_minutes, total_dials_made, total_call_minutes')
            .eq('agent_email', agentEmail.toLowerCase())
            .eq('week_start_date', weekStart.toISOString().split('T')[0])
            .single();
          
          const { error: updateError } = await supabaseAdmin
            .from('weekly_usage_stats')
            .update({
              ccpro_call_minutes: (current?.ccpro_call_minutes || 0) + durationMinutes,
              total_dials_made: (current?.total_dials_made || 0) + 1,
              total_call_minutes: (current?.total_call_minutes || 0) + durationMinutes,
              updated_at: new Date().toISOString()
            })
            .eq('agent_email', agentEmail.toLowerCase())
            .eq('week_start_date', weekStart.toISOString().split('T')[0]);
          
          incrementError = updateError || null;
        }
        
        if (incrementError) {
          console.error('❌ Error incrementing CCPro stats:', incrementError);
        }
      }

      console.log(`✅ Tracked CCPro call end for ${agentEmail} (${durationMinutes} min)${callId ? ` (callId: ${callId})` : ''}`);
    } catch (error) {
      console.error('❌ Error tracking CCPro call end:', error);
    }
  }

  /**
   * Calculate VDP available time for current week from activity logs
   */
  static async calculateVDPAvailableTime(agentEmail: string): Promise<number> {
    try {
      const result = await db.execute(sql`
        WITH current_week AS (
          SELECT (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)) as week_start
        ),
        vdp_events AS (
          SELECT 
            activity_type,
            timestamp,
            LAG(timestamp) OVER (ORDER BY timestamp) as prev_timestamp
          FROM agent_activity_log
          WHERE agent_email = ${agentEmail}
            AND activity_type IN ('vdp_available_start', 'vdp_available_end')
            AND timestamp >= (SELECT week_start FROM current_week)
          ORDER BY timestamp
        ),
        paired_events AS (
          SELECT 
            timestamp,
            prev_timestamp,
            activity_type,
            CASE 
              WHEN activity_type = 'vdp_available_end' AND prev_timestamp IS NOT NULL THEN
                EXTRACT(EPOCH FROM (timestamp - prev_timestamp)) / 60
              ELSE 0
            END as duration_minutes
          FROM vdp_events
        )
        SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes
        FROM paired_events
        WHERE duration_minutes > 0
      `);

      const totalMinutes = Math.round(result.rows[0]?.total_minutes || 0);

      // Update weekly stats
      await db.execute(sql`
        WITH current_week AS (
          SELECT (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER))::DATE as week_start
        )
        UPDATE weekly_usage_stats
        SET 
          vdp_available_minutes = ${totalMinutes},
          updated_at = NOW()
        WHERE agent_email = ${agentEmail}
          AND week_start_date = (SELECT week_start FROM current_week)
      `);

      return totalMinutes;
    } catch (error) {
      console.error('❌ Error calculating VDP available time:', error);
      return 0;
    }
  }

  /**
   * Calculate Call Connector Pro call time for current week from activity logs
   */
  static async calculateCCProCallTime(agentEmail: string): Promise<number> {
    try {
      const result = await db.execute(sql`
        WITH current_week AS (
          SELECT (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)) as week_start
        ),
        call_events AS (
          SELECT 
            activity_type,
            timestamp,
            activity_data->>'call_id' as call_id,
            LAG(timestamp) OVER (PARTITION BY activity_data->>'call_id' ORDER BY timestamp) as prev_timestamp,
            LAG(activity_type) OVER (PARTITION BY activity_data->>'call_id' ORDER BY timestamp) as prev_type
          FROM agent_activity_log
          WHERE agent_email = ${agentEmail}
            AND activity_type IN ('ccpro_call_start', 'ccpro_call_end')
            AND timestamp >= (SELECT week_start FROM current_week)
          ORDER BY timestamp
        ),
        paired_calls AS (
          SELECT 
            timestamp,
            prev_timestamp,
            activity_type,
            CASE 
              WHEN activity_type = 'ccpro_call_end' 
                   AND prev_type = 'ccpro_call_start' 
                   AND prev_timestamp IS NOT NULL THEN
                EXTRACT(EPOCH FROM (timestamp - prev_timestamp)) / 60
              ELSE 0
            END as duration_minutes
          FROM call_events
        )
        SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes
        FROM paired_calls
        WHERE duration_minutes > 0
      `);

      const totalMinutes = Math.round(result.rows[0]?.total_minutes || 0);

      // Update weekly stats
      await db.execute(sql`
        WITH current_week AS (
          SELECT (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER))::DATE as week_start
        )
        UPDATE weekly_usage_stats
        SET 
          ccpro_call_minutes = ${totalMinutes},
          updated_at = NOW()
        WHERE agent_email = ${agentEmail}
          AND week_start_date = (SELECT week_start FROM current_week)
      `);

      return totalMinutes;
    } catch (error) {
      console.error('❌ Error calculating CCPro call time:', error);
      return 0;
    }
  }

  /**
   * Get all agents' weekly stats (for admin view)
   * Calculates online time on-the-fly from heartbeat logs
   */
  static async getAllWeeklyStats() {
    try {
      console.log('📊 UsageTracker: Starting getAllWeeklyStats from Supabase...');
      
      // Get data from Supabase weekly_usage_stats table
      if (!supabaseAdmin) {
        console.error('❌ supabaseAdmin not available!');
        return [];
      }
      
      // Calculate current week start (Sunday)
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      
      // CRITICAL: Get ALL agents from agent_profiles first (source of truth)
      console.log('📋 Fetching ALL agents from agent_profiles...');
      const { data: allAgentProfiles, error: profilesError } = await supabaseAdmin
        .from('agent_profiles')
        .select('email, firstName, lastName, mgaAssociateId, rgaAssociateId')
        .not('email', 'is', null)
        .limit(10000);
      
      // Build profile map - continue even if agent_profiles fails
      const profileMap = new Map();
      if (profilesError) {
        console.error('❌ Error fetching agent_profiles:', profilesError);
        console.warn('⚠️ Continuing without agent_profiles - will use data from weekly_usage_stats only');
      } else {
        const allAgents = allAgentProfiles || [];
        console.log(`📋 Found ${allAgents.length} total agents in agent_profiles`);
        allAgents.forEach(p => {
          if (p.email) {
            profileMap.set(String(p.email).toLowerCase().trim(), p);
          }
        });
      }
      
      // Get weekly stats from Supabase for current week
      const weekStartStr = weekStart.toISOString().split('T')[0];
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekEndStr = weekEnd.toISOString().split('T')[0];
      
      console.log(`📅 Querying weekly_usage_stats for week: ${weekStartStr} to ${weekEndStr}`);
      
      // Get ALL records for current week - NO LIMIT, get everything
      // CRITICAL: Query by exact week_start_date match first, then fallback to range
      let weeklyStats: any[] = [];
      let statsError: any = null;
      
      // Try exact match first (most common case)
      const { data: exactWeekStats, error: exactError } = await supabaseAdmin
        .from('weekly_usage_stats')
        .select('*')
        .eq('week_start_date', weekStartStr);
      
      if (!exactError && exactWeekStats) {
        weeklyStats = exactWeekStats;
        console.log(`📊 Found ${weeklyStats.length} records with exact week match: ${weekStartStr}`);
      } else {
        // Fallback to range query
        const { data: rangeStats, error: rangeError } = await supabaseAdmin
          .from('weekly_usage_stats')
          .select('*')
          .gte('week_start_date', weekStartStr)
          .lte('week_start_date', weekEndStr);
        
        if (!rangeError && rangeStats) {
          weeklyStats = rangeStats;
          console.log(`📊 Found ${weeklyStats.length} records with range query: ${weekStartStr} to ${weekEndStr}`);
        } else {
          statsError = rangeError || exactError;
        }
      }
      
      if (statsError) {
        console.error('❌ Error fetching weekly_usage_stats from Supabase:', statsError);
        console.error('❌ Error details:', JSON.stringify(statsError, null, 2));
        // Continue anyway - we'll show agents with zero stats
      }
      
      const rows = weeklyStats || [];
      console.log(`📊 UsageTracker: Found ${rows.length} records in weekly_usage_stats for week ${weekStartStr}`);
      
      if (rows.length === 0) {
        console.warn(`⚠️ NO RECORDS FOUND for week ${weekStartStr}! Checking most recent week...`);
        // Get the most recent week with ANY data
        const { data: recentStats } = await supabaseAdmin
          .from('weekly_usage_stats')
          .select('*')
          .order('week_start_date', { ascending: false })
          .limit(1000);
        
        if (recentStats && recentStats.length > 0) {
          const recentWeek = recentStats[0].week_start_date;
          console.log(`📊 Most recent week in database: ${recentWeek} with ${recentStats.length} records`);
          console.log(`📊 Current week being queried: ${weekStartStr}`);
          if (recentWeek !== weekStartStr) {
            console.warn(`⚠️ Week mismatch! Using most recent week ${recentWeek} instead`);
            // Use the most recent week's data
            rows.push(...recentStats.filter(r => r.week_start_date === recentWeek));
            console.log(`📊 Now have ${rows.length} rows from week ${recentWeek}`);
          }
        }
      }
      
      if (rows.length > 0) {
        console.log(`📊 First 10 agent emails from database:`, rows.slice(0, 10).map(r => r.agent_email));
        console.log('📊 Sample weekly_usage_stats records:');
        rows.slice(0, 5).forEach(row => {
          console.log(`  - ${row.agent_email}: vdp_total=${row.vdp_total_minutes}, vdp_available=${row.vdp_available_minutes}, logins=${row.total_logins}`);
        });
      } else {
        console.error('❌ CRITICAL: Still no rows after fallback!');
      }
      
      // Get heartbeats from Supabase to calculate online time
      const { data: heartbeats, error: heartbeatError } = await supabaseAdmin
        .from('agent_activity_log')
        .select('agent_email, timestamp')
        .eq('activity_type', 'heartbeat')
        .gte('timestamp', weekStart.toISOString());
      
      // Calculate online time from heartbeats
      const onlineTimeByAgent: Record<string, number> = {};
      if (!heartbeatError && heartbeats && heartbeats.length > 0) {
        const heartbeatsByAgent: Record<string, Date[]> = {};
        heartbeats.forEach(hb => {
          const email = hb.agent_email.toLowerCase();
          if (!heartbeatsByAgent[email]) {
            heartbeatsByAgent[email] = [];
          }
          heartbeatsByAgent[email].push(new Date(hb.timestamp));
        });
        
        Object.keys(heartbeatsByAgent).forEach(email => {
          const times = heartbeatsByAgent[email].sort((a, b) => a.getTime() - b.getTime());
          let totalMinutes = 0;
          
          for (let i = 1; i < times.length; i++) {
            const gapMinutes = (times[i].getTime() - times[i-1].getTime()) / (1000 * 60);
            if (gapMinutes <= 2) {
              totalMinutes += gapMinutes;
            } else {
              totalMinutes += 1;
            }
          }
          if (times.length > 0) totalMinutes += 1;
          
          onlineTimeByAgent[email] = Math.round(totalMinutes);
        });
        
        console.log(`📊 Calculated online time from ${heartbeats.length} Supabase heartbeats for ${Object.keys(onlineTimeByAgent).length} agents`);
      }
      
      // Get VDP connects from actual vdp_calls table (source of truth)
      const vdpConnectsByAgent: Record<string, { count: number, minutes: number }> = {};
      try {
        console.log('📊 Querying vdp_calls table for CONNECT events from week:', weekStart.toISOString());
        const { data: vdpCalls, error: vdpCallsError } = await supabaseAdmin
          .from('vdp_calls')
          .select('company_email, event, duration, time')
          .eq('event', 'CONNECT')
          .gte('time', weekStart.toISOString());
        
        if (vdpCallsError) {
          console.error('❌ Error querying vdp_calls table:', vdpCallsError);
          console.error('❌ VDP query error details:', JSON.stringify(vdpCallsError, null, 2));
        } else {
          console.log(`📊 vdp_calls query result: ${vdpCalls?.length || 0} CONNECT events found`);
          if (vdpCalls && vdpCalls.length > 0) {
            console.log('📊 Sample VDP call:', JSON.stringify(vdpCalls[0], null, 2));
            vdpCalls.forEach(call => {
              const email = call.company_email?.toLowerCase();
              if (!email) {
                console.warn('⚠️ VDP call missing company_email:', { event: call.event, time: call.time });
                return;
              }
              if (!vdpConnectsByAgent[email]) {
                vdpConnectsByAgent[email] = { count: 0, minutes: 0 };
              }
              vdpConnectsByAgent[email].count += 1;
              if (call.duration) {
                const durationMinutes = Math.round(parseFloat(String(call.duration)) / 60);
                vdpConnectsByAgent[email].minutes += durationMinutes;
              } else {
                vdpConnectsByAgent[email].minutes += 1; // Default 1 minute if no duration
              }
            });
            console.log(`📊 VDP connects aggregated for ${Object.keys(vdpConnectsByAgent).length} agents`);
            // Log top 5 agents with VDP connects
            const topAgents = Object.entries(vdpConnectsByAgent)
              .sort((a, b) => b[1].count - a[1].count)
              .slice(0, 5);
            topAgents.forEach(([email, data]) => {
              console.log(`  📊 ${email}: ${data.count} connects, ${data.minutes} minutes`);
            });
          } else {
            console.warn('⚠️ No VDP CONNECT events found in vdp_calls table for this week');
          }
        }
      } catch (vdpError) {
        console.error('❌ Exception querying vdp_calls table:', vdpError);
        console.error('❌ Exception stack:', vdpError instanceof Error ? vdpError.stack : 'No stack');
      }
      
      // Get VDP available time AND on-call time from agent_availability_tracking
      // SEPARATE: total_available_time = waiting for calls, total_calling_time = actively on calls
      const vdpAvailableTimeByAgent: Record<string, number> = {}; // Waiting for calls
      const vdpCallTimeByAgent: Record<string, number> = {}; // Actively on calls
      try {
        console.log('📊 Querying agent_availability_tracking for VDP available time AND call time...');
        
        // Get availability data from agent_availability_tracking table
        // This tracks when agents are online/available waiting for calls AND when they're on calls
        // Note: Table uses agent_id (associate ID) but also has agent_email
        const weekStartStr = weekStart.toISOString().split('T')[0];
        const weekEndStr = weekEnd.toISOString().split('T')[0];
        console.log(`📊 Querying agent_availability_tracking from ${weekStartStr} to ${weekEndStr} for VDP time`);
        
        const { data: availabilityData, error: availabilityError } = await supabaseAdmin
          .from('agent_availability_tracking')
          .select('agent_email, agent_id, total_available_time, total_calling_time, tracking_date, current_status')
          .gte('tracking_date', weekStartStr)
          .lte('tracking_date', weekEndStr);
        
        if (availabilityError) {
          console.error('❌ Error querying agent_availability_tracking:', availabilityError);
          console.error('❌ Availability query error details:', JSON.stringify(availabilityError, null, 2));
        } else if (availabilityData && availabilityData.length > 0) {
          console.log(`📊 Found ${availabilityData.length} availability records from agent_availability_tracking`);
          console.log('📊 Sample availability record:', JSON.stringify(availabilityData[0], null, 2));
          
          // Sum up available time AND call time for each agent across the week
          availabilityData.forEach(record => {
            const email = record.agent_email?.toLowerCase();
            if (!email) {
              console.warn('⚠️ Availability record missing agent_email:', { agent_id: record.agent_id, tracking_date: record.tracking_date });
              return;
            }
            
            // Track available time (waiting for calls) - in seconds, convert to minutes
            if (!vdpAvailableTimeByAgent[email]) {
              vdpAvailableTimeByAgent[email] = 0;
            }
            const availableMinutes = Math.round((record.total_available_time || 0) / 60);
            vdpAvailableTimeByAgent[email] += availableMinutes;
            
            // Track call time (actively on calls) - in seconds, convert to minutes
            if (!vdpCallTimeByAgent[email]) {
              vdpCallTimeByAgent[email] = 0;
            }
            const callMinutes = Math.round((record.total_calling_time || 0) / 60);
            vdpCallTimeByAgent[email] += callMinutes;
          });
          
          console.log(`📊 VDP available time aggregated for ${Object.keys(vdpAvailableTimeByAgent).length} agents (waiting for calls)`);
          console.log(`📊 VDP call time aggregated for ${Object.keys(vdpCallTimeByAgent).length} agents (actively on calls)`);
          // Log top 5 agents
          const topAvailableAgents = Object.entries(vdpAvailableTimeByAgent)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
          topAvailableAgents.forEach(([email, minutes]) => {
            const callMinutes = vdpCallTimeByAgent[email] || 0;
            console.log(`  📊 ${email}: ${minutes} min available (waiting), ${callMinutes} min on calls`);
          });
        } else {
          console.warn('⚠️ No availability data found in agent_availability_tracking for this week');
        }
        
        // Also check Taalk VDP poller for current online/calling status and add real-time session time
        try {
          const { taalkVDPPoller } = await import('./taalk-vdp-poller');
          const vdpAgents = taalkVDPPoller.getAgents();
          console.log(`📊 Taalk VDP poller has ${vdpAgents.length} agents tracked`);
          
          // Get current online agents (waiting) and calling agents (on calls)
          const currentlyOnline: string[] = [];
          const currentlyCalling: string[] = [];
          vdpAgents.forEach(agent => {
            const email = agent.email.toLowerCase();
            
            if (agent.status === 'online') {
              // Agent is available/waiting for calls
              currentlyOnline.push(email);
              
              // Calculate time from onlineStartTime to now
              if (agent.onlineStartTime) {
                const currentMinutes = Math.round((new Date().getTime() - agent.onlineStartTime.getTime()) / (1000 * 60));
                if (!vdpAvailableTimeByAgent[email]) {
                  vdpAvailableTimeByAgent[email] = 0;
                }
                vdpAvailableTimeByAgent[email] += currentMinutes;
                console.log(`📊 ${email} currently ONLINE (waiting), adding ${currentMinutes} minutes from current session`);
              } else {
                console.warn(`⚠️ ${email} is online but has no onlineStartTime`);
              }
            } else if (agent.status === 'calling') {
              // Agent is actively on a call
              currentlyCalling.push(email);
              
              // Calculate time from call start to now
              if (agent.currentCall?.startTime) {
                const currentMinutes = Math.round((new Date().getTime() - agent.currentCall.startTime.getTime()) / (1000 * 60));
                if (!vdpCallTimeByAgent[email]) {
                  vdpCallTimeByAgent[email] = 0;
                }
                vdpCallTimeByAgent[email] += currentMinutes;
                console.log(`📊 ${email} currently ON CALL, adding ${currentMinutes} minutes from current call`);
              }
            }
          });
          
          if (currentlyOnline.length > 0) {
            console.log(`📊 Currently ONLINE (waiting) agents: ${currentlyOnline.join(', ')}`);
          }
          if (currentlyCalling.length > 0) {
            console.log(`📊 Currently ON CALL agents: ${currentlyCalling.join(', ')}`);
          }
          if (currentlyOnline.length === 0 && currentlyCalling.length === 0) {
            console.log('📊 No agents currently online or on calls according to Taalk VDP poller');
          }
        } catch (pollerError) {
          console.error('❌ Could not get current VDP status from poller:', pollerError);
          console.error('❌ Poller error stack:', pollerError instanceof Error ? pollerError.stack : 'No stack');
        }
      } catch (vdpError) {
        console.error('❌ Exception getting VDP available time:', vdpError);
      }
      
      // Helper function to check if email is actually an associate ID
      const isAssociateIdEmail = (email: string): boolean => {
        const emailStr = String(email).toLowerCase().trim();
        const beforeAt = emailStr.split('@')[0];
        // Check if it's numeric (associate ID)
        return /^\d+$/.test(beforeAt);
      };

      // Helper function to lookup real email from associate ID
      const lookupEmailFromAssociateId = async (associateIdEmail: string): Promise<{ email: string | null; name: string | null }> => {
        const beforeAt = associateIdEmail.split('@')[0];
        const associateId = parseInt(beforeAt);
        
        if (isNaN(associateId)) {
          return { email: null, name: null };
        }

        try {
          // Try customers table first (PRIMARY SOURCE)
          const { data: customer } = await supabaseAdmin
            .from('customers')
            .select('company_email, personal_email, first_name, last_name')
            .eq('associate_id', associateId)
            .maybeSingle();

          if (customer?.company_email) {
            return {
              email: customer.company_email.toLowerCase().trim(),
              name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || null
            };
          }

          if (customer?.personal_email) {
            return {
              email: customer.personal_email.toLowerCase().trim(),
              name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || null
            };
          }

          // Try producerlist as fallback
          const { data: producer } = await supabaseAdmin
            .from('producerlist')
            .select('company_email, first_name, last_name')
            .eq('associate_id', associateId)
            .maybeSingle();

          if (producer?.company_email) {
            return {
              email: producer.company_email.toLowerCase().trim(),
              name: `${producer.first_name || ''} ${producer.last_name || ''}`.trim() || null
            };
          }
        } catch (error) {
          console.error(`❌ Error looking up associate_id ${associateId}:`, error);
        }

        return { email: null, name: null };
      };

      // Build email lookup map for associate IDs
      const emailLookupMap = new Map<string, { email: string; name: string | null }>();
      const associateIdEmails = rows
        .map(r => r.agent_email)
        .filter(email => email && isAssociateIdEmail(email)) as string[];

      if (associateIdEmails.length > 0) {
        console.log(`📊 Found ${associateIdEmails.length} associate ID emails, looking up real emails...`);
        for (const associateIdEmail of associateIdEmails) {
          const lookup = await lookupEmailFromAssociateId(associateIdEmail);
          if (lookup.email) {
            emailLookupMap.set(associateIdEmail.toLowerCase().trim(), lookup);
            console.log(`📊 Mapped ${associateIdEmail} -> ${lookup.email}${lookup.name ? ` (${lookup.name})` : ''}`);
          } else {
            console.warn(`⚠️ Could not find real email for associate ID: ${associateIdEmail}`);
          }
        }
      }

      // Create a map of weekly_usage_stats by email for quick lookup
      // CRITICAL: Normalize emails consistently (lowercase + trim) and resolve associate IDs
      const weeklyStatsMap = new Map();
      rows.forEach(row => {
        if (row.agent_email) {
          let email = String(row.agent_email).toLowerCase().trim();
          const originalEmail = email;
          
          // If it's an associate ID email, look up the real email
          if (isAssociateIdEmail(email)) {
            const lookup = emailLookupMap.get(email);
            if (lookup?.email) {
              email = lookup.email;
              // Update agent_name if we found a name
              if (lookup.name && !row.agent_name) {
                row.agent_name = lookup.name;
              }
              console.log(`📊 Resolved ${originalEmail} -> ${email}${lookup.name ? ` (${lookup.name})` : ''}`);
            }
          }
          
          weeklyStatsMap.set(email, row);
          // Log agents with VDP data
          if ((row.vdp_total_minutes && row.vdp_total_minutes > 0) || (row.vdp_available_minutes && row.vdp_available_minutes > 0)) {
            console.log(`📊 Mapped ${email}: vdp_total=${row.vdp_total_minutes}, vdp_available=${row.vdp_available_minutes}, vdp_call=${row.vdp_call_minutes}`);
          }
        }
      });
      console.log(`📊 Built weeklyStatsMap with ${weeklyStatsMap.size} agents from database`);
      const agentsWithVdpData = Array.from(weeklyStatsMap.entries()).filter(([_, row]) => 
        (row.vdp_total_minutes && row.vdp_total_minutes > 0) || 
        (row.vdp_available_minutes && row.vdp_available_minutes > 0)
      );
      console.log(`📊 Agents with VDP data in map: ${agentsWithVdpData.length}`);
      if (agentsWithVdpData.length > 0) {
        console.log(`📊 Sample agents with VDP data:`, agentsWithVdpData.slice(0, 5).map(([email, row]) => `${email} (vdp_total=${row.vdp_total_minutes})`));
      }

      // Get all unique agent emails - PRIORITIZE agents from weekly_usage_stats (they have actual data)
      const allAgentEmails = new Set<string>();
      
      // CRITICAL: Add ALL agents from weekly_usage_stats FIRST (they have actual data)
      // Use resolved emails (real emails, not associate IDs)
      if (rows.length > 0) {
        rows.forEach(row => {
          if (row.agent_email) {
            let email = String(row.agent_email).toLowerCase().trim();
            // If it's an associate ID, use the resolved email
            if (isAssociateIdEmail(email)) {
              const lookup = emailLookupMap.get(email);
              if (lookup?.email) {
                email = lookup.email;
              }
            }
            allAgentEmails.add(email);
          }
        });
        console.log(`📊 Added ${rows.length} agents from weekly_usage_stats (with email resolution)`);
      } else {
        console.warn('⚠️ No rows from weekly_usage_stats - will only show agents from agent_profiles');
      }
      
      // Then add ALL agents from agent_profiles (to include agents without stats yet)
      if (!profilesError && allAgentProfiles && allAgentProfiles.length > 0) {
        allAgentProfiles.forEach(agent => {
          if (agent.email) {
            allAgentEmails.add(String(agent.email).toLowerCase().trim());
          }
        });
        console.log(`📊 Total unique agents after adding agent_profiles: ${allAgentEmails.size}`);
      } else {
        if (profilesError) {
          console.warn('⚠️ agent_profiles query failed, but continuing with weekly_usage_stats data');
        } else {
          console.warn('⚠️ No agents from agent_profiles, but continuing with weekly_usage_stats data');
        }
      }
      
      // Add agents with VDP activity (from other sources)
      Object.keys(vdpAvailableTimeByAgent).forEach(email => {
        allAgentEmails.add(String(email).toLowerCase().trim());
      });
      Object.keys(vdpCallTimeByAgent).forEach(email => {
        allAgentEmails.add(String(email).toLowerCase().trim());
      });
      Object.keys(vdpConnectsByAgent).forEach(email => {
        allAgentEmails.add(String(email).toLowerCase().trim());
      });
      
      console.log(`📊 Final total unique agents: ${allAgentEmails.size}`);
      console.log(`📊 First 20 agent emails in final set:`, Array.from(allAgentEmails).slice(0, 20));
      
      // CRITICAL: If allAgentEmails is empty but we have rows, use rows directly
      if (allAgentEmails.size === 0 && rows.length > 0) {
        console.warn('⚠️ allAgentEmails is empty but we have rows - adding all rows to agent emails set');
        rows.forEach(row => {
          if (row.agent_email) {
            allAgentEmails.add(String(row.agent_email).toLowerCase().trim());
          }
        });
        console.log(`📊 After adding rows, allAgentEmails size: ${allAgentEmails.size}`);
      }
      
      // Helper to resolve associate ID emails in a row
      const resolveRowEmail = (row: any) => {
        let displayEmail = row.agent_email;
        let displayName = row.agent_name;
        
        if (isAssociateIdEmail(row.agent_email)) {
          const lookup = emailLookupMap.get(String(row.agent_email).toLowerCase().trim());
          if (lookup?.email) {
            displayEmail = lookup.email;
            if (lookup.name) {
              displayName = lookup.name;
            }
          }
        }
        
        return { displayEmail, displayName };
      };

      // CRITICAL FIX: If we have rows but allAgentEmails is still empty, just return rows directly
      if (rows.length > 0 && allAgentEmails.size === 0) {
        console.error('❌ CRITICAL: Have rows but allAgentEmails is still empty - returning rows directly!');
        return rows.map(row => {
          const { displayEmail, displayName } = resolveRowEmail(row);
          return {
            agent_email: displayEmail,
            agent_name: displayName || displayEmail,
            week_start_date: row.week_start_date,
            week_end_date: row.week_end_date,
            total_logins: Number(row.total_logins) || 0,
            unique_login_days: Number(row.unique_login_days) || 0,
            total_online_minutes: Number(row.total_online_minutes) || 0,
            vdp_connects_received: Number(row.vdp_connects_received) || 0,
            vdp_available_minutes: Number(row.vdp_available_minutes) || 0,
            vdp_call_minutes: Number(row.vdp_call_minutes) || 0,
            vdp_total_minutes: Number(row.vdp_total_minutes) || 0,
            total_dials_made: Number(row.total_dials_made) || 0,
            total_call_minutes: (Number(row.total_call_minutes) || 0) + (Number(row.ccpro_call_minutes) || 0),
            appointments_scheduled: Number(row.appointments_scheduled) || 0,
            sales_made: Number(row.sales_made) || 0,
            total_alp: Number(row.total_alp || 0),
            last_activity_at: row.last_activity_at || null,
            firstName: null,
            lastName: null,
            mgaAssociateId: null,
            rgaAssociateId: null
          };
        });
      }

      // SIMPLIFIED: If we have rows, return them directly - no complex mapping
      if (rows.length > 0 && allAgentEmails.size === 0) {
        console.log('📊 SIMPLIFIED: Returning rows directly from database (no mapping needed)');
        return rows.map(row => {
          const { displayEmail, displayName } = resolveRowEmail(row);
          return {
            agent_email: displayEmail,
            agent_name: displayName || displayEmail,
            week_start_date: row.week_start_date,
            week_end_date: row.week_end_date,
            total_logins: Number(row.total_logins) || 0,
            unique_login_days: Number(row.unique_login_days) || 0,
            total_online_minutes: Number(row.total_online_minutes) || 0,
            vdp_connects_received: Number(row.vdp_connects_received) || 0,
            vdp_available_minutes: Number(row.vdp_available_minutes) || 0,
            vdp_call_minutes: Number(row.vdp_call_minutes) || 0,
            vdp_total_minutes: Number(row.vdp_total_minutes) || 0,
            total_dials_made: Number(row.total_dials_made) || 0,
            total_call_minutes: (Number(row.total_call_minutes) || 0) + (Number(row.ccpro_call_minutes) || 0),
            appointments_scheduled: Number(row.appointments_scheduled) || 0,
            sales_made: Number(row.sales_made) || 0,
            total_alp: Number(row.total_alp || 0),
            last_activity_at: row.last_activity_at || null,
            firstName: null,
            lastName: null,
            mgaAssociateId: null,
            rgaAssociateId: null
          };
        });
      }
      
      // Combine stats with profiles and online time - include ALL agents
      // CRITICAL: Use database values from weekly_usage_stats as PRIMARY source
      // Only supplement with calculated values when database values are null/undefined
      const result = Array.from(allAgentEmails).map(email => {
        const normalizedEmail = String(email).toLowerCase().trim();
        const weeklyStat = weeklyStatsMap.get(normalizedEmail);
        const profile = profileMap.get(normalizedEmail);
        
        // Debug: Check if agent should have data but doesn't
        if (!weeklyStat && rows.some(r => String(r.agent_email || '').toLowerCase().trim() === normalizedEmail)) {
          console.warn(`⚠️ Agent ${normalizedEmail} found in rows but not in map!`);
          const matchingRow = rows.find(r => String(r.agent_email || '').toLowerCase().trim() === normalizedEmail);
          if (matchingRow) {
            console.warn(`⚠️ Found matching row:`, { 
              original_email: matchingRow.agent_email, 
              normalized: String(matchingRow.agent_email || '').toLowerCase().trim(),
              vdp_total: matchingRow.vdp_total_minutes 
            });
          }
        }
        
        // Helper to get value: use database value if it exists (even if 0), otherwise use calculated value
        const getValue = (dbValue: any, calculatedValue: any) => {
          if (dbValue !== null && dbValue !== undefined) {
            const numValue = Number(dbValue);
            return isNaN(numValue) ? 0 : numValue; // Use database value (even if 0)
          }
          return calculatedValue ?? 0; // Only use calculated if database value doesn't exist
        };
        
        // CRITICAL: For VDP time, use database values DIRECTLY - they are the source of truth
        // Database values are already synced by the poller, so use them as-is
        const vdpAvailable = weeklyStat?.vdp_available_minutes != null 
          ? Number(weeklyStat.vdp_available_minutes) || 0
          : (vdpAvailableTimeByAgent[email] || 0);
        const vdpCall = weeklyStat?.vdp_call_minutes != null
          ? Number(weeklyStat.vdp_call_minutes) || 0
          : (vdpCallTimeByAgent[email] || 0);
        const vdpTotal = weeklyStat?.vdp_total_minutes != null
          ? Number(weeklyStat.vdp_total_minutes) || 0
          : (vdpAvailable + vdpCall);
        
        // Debug logging for agents with VDP data
        if (weeklyStat && (weeklyStat.vdp_total_minutes > 0 || weeklyStat.vdp_available_minutes > 0 || weeklyStat.vdp_call_minutes > 0)) {
          console.log(`📊 VDP TIME MAPPING ${email}:`, {
            from_db: {
              vdp_total: weeklyStat.vdp_total_minutes,
              vdp_available: weeklyStat.vdp_available_minutes,
              vdp_call: weeklyStat.vdp_call_minutes
            },
            result: {
              vdp_total: vdpTotal,
              vdp_available: vdpAvailable,
              vdp_call: vdpCall
            },
            weeklyStat_exists: !!weeklyStat,
            email_in_map: weeklyStatsMap.has(email)
          });
        }
        
        // Resolve associate ID emails to real emails
        let displayEmail = email;
        let displayName = weeklyStat?.agent_name;
        
        if (isAssociateIdEmail(email)) {
          const lookup = emailLookupMap.get(email);
          if (lookup?.email) {
            displayEmail = lookup.email;
            if (lookup.name) {
              displayName = lookup.name;
            }
          }
        }
        
        return {
          agent_email: displayEmail,
          agent_name: displayName || (profile?.firstName && profile?.lastName 
            ? `${profile.firstName} ${profile.lastName}` 
            : displayEmail),
          week_start_date: weeklyStat?.week_start_date || weekStartStr,
          week_end_date: weeklyStat?.week_end_date || weekEndStr,
          total_logins: getValue(weeklyStat?.total_logins, 0),
          unique_login_days: getValue(weeklyStat?.unique_login_days, 0),
          // Use database online time first, only calculate from heartbeats if database value is missing
          total_online_minutes: getValue(weeklyStat?.total_online_minutes, onlineTimeByAgent[email]),
          // Use database VDP connects first, supplement with calculated if missing
          vdp_connects_received: getValue(weeklyStat?.vdp_connects_received, vdpConnectsByAgent[email]?.count),
          vdp_available_minutes: vdpAvailable, // Time waiting for calls (available/online)
          vdp_call_minutes: vdpCall, // Time actively on calls
          vdp_total_minutes: vdpTotal, // Total VDP time (available + on calls)
          total_dials_made: getValue(weeklyStat?.total_dials_made, 0),
          total_call_minutes: getValue(weeklyStat?.total_call_minutes, 0) + getValue(weeklyStat?.ccpro_call_minutes, 0),
          appointments_scheduled: getValue(weeklyStat?.appointments_scheduled, 0),
          sales_made: getValue(weeklyStat?.sales_made, 0),
          total_alp: getValue(weeklyStat?.total_alp, 0),
          last_activity_at: weeklyStat?.last_activity_at || null,
          firstName: profile?.firstName || null,
          lastName: profile?.lastName || null,
          mgaAssociateId: profile?.mgaAssociateId || null,
          rgaAssociateId: profile?.rgaAssociateId || null
        };
      });
      
      console.log(`📊 UsageTracker: Returning ${result.length} total agents in result`);
      
      if (result.length === 0) {
        console.error('❌ CRITICAL: Result array is EMPTY! This should not happen.');
        console.error('❌ Debug info:');
        console.error(`  - Rows from weekly_usage_stats: ${rows.length}`);
        console.error(`  - All agent emails set size: ${allAgentEmails.size}`);
        console.error(`  - Weekly stats map size: ${weeklyStatsMap.size}`);
        console.error(`  - Profile map size: ${profileMap.size}`);
        console.error(`  - Week being queried: ${weekStartStr} to ${weekEndStr}`);
        
        // If we have rows but result is empty, something is wrong with the mapping
        // Return the rows directly as a fallback - THIS IS THE FIX
        if (rows.length > 0) {
          console.error('❌ We have rows but result is empty - mapping logic is broken! Returning rows directly.');
          const directResult = rows.map(row => {
            const { displayEmail, displayName } = resolveRowEmail(row);
            return {
              agent_email: displayEmail,
              agent_name: displayName || displayEmail,
            week_start_date: row.week_start_date,
            week_end_date: row.week_end_date,
            total_logins: Number(row.total_logins) || 0,
            unique_login_days: Number(row.unique_login_days) || 0,
            total_online_minutes: Number(row.total_online_minutes) || 0,
            vdp_connects_received: Number(row.vdp_connects_received) || 0,
            vdp_available_minutes: Number(row.vdp_available_minutes) || 0,
            vdp_call_minutes: Number(row.vdp_call_minutes) || 0,
            vdp_total_minutes: Number(row.vdp_total_minutes) || 0,
            total_dials_made: Number(row.total_dials_made) || 0,
            total_call_minutes: (Number(row.total_call_minutes) || 0) + (Number(row.ccpro_call_minutes) || 0),
            appointments_scheduled: Number(row.appointments_scheduled) || 0,
            sales_made: Number(row.sales_made) || 0,
            total_alp: Number(row.total_alp) || 0,
            last_activity_at: row.last_activity_at || null,
            firstName: null,
            lastName: null,
            mgaAssociateId: null,
            rgaAssociateId: null
          };
          });
          console.log(`✅ Returning ${directResult.length} agents directly from database rows`);
          return directResult;
        }
        
        // If we still have nothing, return empty array
        console.error('❌ No data available at all - returning empty array');
        return [];
      } else {
        console.log('📊 UsageTracker: Sample rows (first 5):');
        result.slice(0, 5).forEach((row, idx) => {
          console.log(`  ${idx + 1}. ${row.agent_email}: logins=${row.total_logins}, vdp_total=${row.vdp_total_minutes}, vdp_available=${row.vdp_available_minutes}`);
        });
        
        // Count agents with actual data
        const agentsWithData = result.filter(r => 
          r.total_logins > 0 || 
          r.vdp_total_minutes > 0 || 
          r.total_dials_made > 0 || 
          r.appointments_scheduled > 0
        );
        console.log(`📊 Agents with actual data: ${agentsWithData.length} out of ${result.length}`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error getting all weekly stats:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('❌ Stack trace:', error.stack);
      }
      // Try a fallback simple query
      try {
        console.log('📊 UsageTracker: Attempting fallback simple query...');
        const fallback = await db.execute(sql`SELECT * FROM weekly_usage_stats LIMIT 10`);
        console.log('📊 UsageTracker: Fallback query result:', {
          hasResult: !!fallback,
          type: typeof fallback,
          isArray: Array.isArray(fallback),
          keys: fallback ? Object.keys(fallback) : []
        });
        if (Array.isArray(fallback)) {
          return fallback;
        } else if (fallback?.rows) {
          return fallback.rows;
        }
      } catch (fallbackError) {
        console.error('❌ Fallback query also failed:', fallbackError);
      }
      return [];
    }
  }
}

export const usageTracker = UsageTracker;

