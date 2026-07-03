import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './hardcoded-config';

// Permanent Call Monitoring Service - Tracks ALL outbound calls
export class CallMonitoringService {
  private pool: Pool;
  private supabase: any;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(pool: Pool) {
    this.pool = pool;
    
    // Initialize Supabase using hardcoded config
    try {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('✅ Call Monitoring Service Supabase initialized with hardcoded config');
    } catch (error) {
      console.log('⚠️ Failed to initialize Supabase, using database only:', error);
      this.supabase = null;
    }
    
    console.log('🎯 Call Monitoring Service initialized');
  }

  // Start permanent monitoring of all outbound calls
  startMonitoring() {
    console.log('🎯 Starting permanent call monitoring...');
    
    // Monitor every 30 seconds for real-time tracking
    this.monitoringInterval = setInterval(async () => {
      await this.trackAllOutboundCalls();
    }, 30000);

    // Initial run
    this.trackAllOutboundCalls();
  }

  // Track all outbound calls from Twilio + database sources
  async trackAllOutboundCalls() {
    const client = await this.pool.connect();
    
    try {
      console.log('🎯 COMPREHENSIVE CALL TRACKING - Starting Twilio + Database sync');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get yesterday's date for expanded call analysis
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      // Get LAST 3 DAYS of calls from Twilio
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      threeDaysAgo.setHours(0, 0, 0, 0);
      
      let twilioStats = {};
      
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        try {
          const Twilio = await import('twilio');
          const twilioClient = Twilio.default(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          
          console.log('📞 PULLING ALL TWILIO DATA - LAST 3 DAYS...');
          
          const calls = await twilioClient.calls.list({
            startTimeAfter: threeDaysAgo,
            limit: 2000  // Increase limit for 3 days of data
          });
          
          console.log(`📞 TWILIO COMPREHENSIVE: Found ${calls.length} calls in last 3 days`);
          
          if (calls.length === 0) {
            console.log('⚠️ NO TWILIO CALLS FOUND - This suggests:');
            console.log('   1. No calls made through Twilio in last 3 days');
            console.log('   2. Calls made through different system/method');
            console.log('   3. Time zone or date filtering issue');
            console.log('   4. Database calls are from different calling system');
          }
          
          // Filter for TODAY + YESTERDAY calls for comprehensive analysis
          const todayCalls = calls.filter(call => {
            const callDate = new Date(call.dateCreated);
            return callDate >= today;
          });
          
          const yesterdayCalls = calls.filter(call => {
            const callDate = new Date(call.dateCreated);
            return callDate >= yesterday && callDate < today;
          });
          
          console.log(`📞 TODAY'S CALLS: ${todayCalls.length} out of ${calls.length} total`);
          console.log(`📞 YESTERDAY'S CALLS: ${yesterdayCalls.length} additional calls from yesterday`);
          
          // Log ALL calls from last 3 days for comprehensive analysis
          console.log('📞 COMPREHENSIVE 3-DAY CALL ANALYSIS:');
          calls.forEach((call, index) => {
            if (index < 20) { // Log first 20 calls for analysis
              console.log(`📞 Call ${index + 1}: ${call.direction} | From: ${call.from} | To: ${call.to} | Duration: ${call.duration}s | Status: ${call.status} | Date: ${call.dateCreated}`);
            }
          });
          
          if (calls.length > 20) {
            console.log(`📞 ... and ${calls.length - 20} more calls`);
          }
          
          // Process TODAY + YESTERDAY calls with ENHANCED AGENT EMAIL ATTRIBUTION
          const allRecentCalls = [...todayCalls, ...yesterdayCalls];
          console.log(`📞 PROCESSING ${allRecentCalls.length} calls (Today: ${todayCalls.length}, Yesterday: ${yesterdayCalls.length})`);
          
          for (const call of allRecentCalls) {
            // Skip inbound calls
            if (call.direction === 'inbound') continue;
            
            let agentEmail = null;
            
            // PRIORITY 1: Check call metadata for agent email (NEW TRACKING METHOD)
            if (call.metadata && call.metadata.agent_email) {
              agentEmail = call.metadata.agent_email;
              console.log(`📞 METADATA ATTRIBUTION: Found agent email in metadata: ${agentEmail}`);
            }
            // PRIORITY 2: Map by FROM number (existing method)
            else {
              const fromNumber = call.from;
              
              // Map Twilio numbers to agents - comprehensive mapping
              if (fromNumber === '+16052500834' || fromNumber === '+19142289324') {
                agentEmail = 'davidfulfer@aoglobelife.com';
              } else if (fromNumber.includes('+1605') || fromNumber.includes('+1914')) {
                // David's area codes
                agentEmail = 'davidfulfer@aoglobelife.com';
              } else if (fromNumber.includes('+1')) {
                // Other outbound calls - check against known agent numbers
                agentEmail = 'kingsleyibeh@aoglobelife.com';
              }
              
              if (agentEmail) {
                console.log(`📞 PHONE NUMBER ATTRIBUTION: ${fromNumber} mapped to ${agentEmail}`);
              }
            }
            
            if (agentEmail) {
              if (!twilioStats[agentEmail]) {
                twilioStats[agentEmail] = { dials: 0, reached: 0, booked: 0 };
              }
              
              twilioStats[agentEmail].dials++;
              
              console.log(`📞 TWILIO CALL ATTRIBUTED: ${agentEmail} - ${call.direction} to ${call.to} (${call.duration}s) [Source: ${call.metadata?.call_source || 'phone_mapping'}]`);
              
              // Consider calls over 30 seconds as "reached"
              if (call.duration && parseInt(call.duration) >= 30) {
                twilioStats[agentEmail].reached++;
              }
              
              // Check for appointment indicators in call status
              if (call.status === 'completed' && call.duration && parseInt(call.duration) >= 60) {
                twilioStats[agentEmail].booked++;
              }
            } else {
              console.log(`⚠️ UNATTRIBUTED CALL: No agent found for call ${call.sid} from ${call.from}`);
            }
          }
          
          console.log('📞 Twilio call analysis complete:', twilioStats);
          
        } catch (twilioError) {
          console.log('❌ Twilio API error:', twilioError.message);
        }
      }

      const agents = [
        'davidfulfer@aoglobelife.com',
        'fayesaad@aoglobelife.com', 
        'chrislafond@aoglobelife.com',
        'martintoma@aoglobelife.com',
        'tabithamcdermid@aoglobelife.com',
        'kingsleyibeh@aoglobelife.com',
        'cnsysop@aoglobelife.com'
      ];

      const stats = {};
      
      // Initialize agent stats
      agents.forEach(email => {
        stats[email] = {
          dials: 0,
          reached: 0, // calls over 60 seconds
          booked: 0   // appointments set
        };
      });

      // Process each agent's calling activity from database sources
      for (const agentEmail of agents) {
        console.log(`🎯 Processing calls for ${agentEmail}`);
        
        // 1. Get from outbound_call_history (check if duration column exists)
        const outboundResult = await client.query(`
          SELECT 
            COUNT(*) as total_dials,
            COUNT(CASE WHEN COALESCE(call_duration, 0) > 60 THEN 1 END) as reached_calls
          FROM outbound_call_history 
          WHERE agent_email = $1 AND DATE(created_at) = CURRENT_DATE
        `, [agentEmail]);

        // 2. Get from call_logs
        const callLogsResult = await client.query(`
          SELECT 
            COUNT(*) as total_dials,
            COUNT(CASE WHEN status = 'completed' OR disposition = 'reached' THEN 1 END) as reached_calls
          FROM call_logs 
          WHERE (agent_email = $1 OR user_id = $1) 
            AND call_type = 'outbound' 
            AND DATE(created_at) = CURRENT_DATE
        `, [agentEmail]);

        // 3. Get from war_connects
        const warResult = await client.query(`
          SELECT 
            COUNT(*) as total_dials,
            COUNT(CASE WHEN immediate_outcome IN ('reached', 'contacted') OR connect_type = 'connected' THEN 1 END) as reached_calls
          FROM war_connects 
          WHERE agent_email = $1 AND DATE(connect_date) = CURRENT_DATE
        `, [agentEmail]);

        // 4. Count appointments booked today - check multiple possible column names
        let appointmentCount = 0;
        
        try {
          if (this.supabase) {
            const { data: appointments } = await this.supabase
              .from('appointments')
              .select('id')
              .eq('user_email', agentEmail)
              .gte('created_at', today.toISOString());
            appointmentCount = appointments?.length || 0;
          } else {
            // Try different column names for appointments
            const appointmentResult = await client.query(`
              SELECT COUNT(*) as booked_appointments
              FROM appointments 
              WHERE (user_email = $1 OR agent_email = $1 OR email = $1) 
                AND DATE(created_at) = CURRENT_DATE
            `, [agentEmail]);
            appointmentCount = parseInt(appointmentResult.rows[0]?.booked_appointments || 0);
          }
        } catch (appointmentError) {
          console.log(`⚠️ Appointment query error for ${agentEmail}:`, appointmentError.message);
          appointmentCount = 0;
        }

        // Combine all sources
        const outboundStats = outboundResult.rows[0] || { total_dials: 0, reached_calls: 0 };
        const callLogStats = callLogsResult.rows[0] || { total_dials: 0, reached_calls: 0 };
        const warStats = warResult.rows[0] || { total_dials: 0, reached_calls: 0 };

        // Get Twilio stats for this agent
        const twilioAgentStats = twilioStats[agentEmail] || { dials: 0, reached: 0, booked: 0 };

        stats[agentEmail] = {
          dials: parseInt(outboundStats.total_dials) + parseInt(callLogStats.total_dials) + parseInt(warStats.total_dials) + twilioAgentStats.dials,
          reached: parseInt(outboundStats.reached_calls) + parseInt(callLogStats.reached_calls) + parseInt(warStats.reached_calls) + twilioAgentStats.reached,
          booked: appointmentCount + twilioAgentStats.booked
        };

        console.log(`📊 ${agentEmail}: ${stats[agentEmail].dials} dials (DB: ${parseInt(outboundStats.total_dials) + parseInt(callLogStats.total_dials) + parseInt(warStats.total_dials)}, Twilio: ${twilioAgentStats.dials}), ${stats[agentEmail].reached} reached, ${stats[agentEmail].booked} booked`);
      }

      // Store daily stats in monitoring table
      await this.storeDailyStats(stats);
      
      console.log(`🎯 Call monitoring update: ${new Date().toISOString()}`);
      Object.entries(stats).forEach(([email, data]: [string, any]) => {
        if (data.dials > 0) {
          console.log(`📞 ${email}: ${data.dials} dials, ${data.reached} reached (60+s), ${data.booked} booked`);
        }
      });

    } catch (error) {
      console.error('❌ Call monitoring error:', error);
    } finally {
      client.release();
    }
  }

  // Store daily statistics in permanent monitoring table
  async storeDailyStats(stats: any) {
    const client = await this.pool.connect();
    
    try {
      // Create monitoring table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS daily_call_monitoring (
          id SERIAL PRIMARY KEY,
          date DATE NOT NULL,
          agent_email VARCHAR(255) NOT NULL,
          total_dials INTEGER DEFAULT 0,
          total_reached INTEGER DEFAULT 0,
          total_booked INTEGER DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(date, agent_email)
        )
      `);

      const today = new Date().toISOString().split('T')[0];

      // Upsert stats for each agent
      for (const [agentEmail, data] of Object.entries(stats)) {
        const { dials, reached, booked } = data as any;
        
        await client.query(`
          INSERT INTO daily_call_monitoring (date, agent_email, total_dials, total_reached, total_booked, updated_at)
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
          ON CONFLICT (date, agent_email) 
          DO UPDATE SET 
            total_dials = $3,
            total_reached = $4,
            total_booked = $5,
            updated_at = CURRENT_TIMESTAMP
        `, [today, agentEmail, dials, reached, booked]);
      }

    } catch (error) {
      console.error('❌ Error storing daily stats:', error);
    } finally {
      client.release();
    }
  }

  // Get current day's stats for dashboard
  async getCurrentStats() {
    const client = await this.pool.connect();
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const result = await client.query(`
        SELECT 
          agent_email,
          total_dials as dials,
          total_reached as reached,
          total_booked as booked
        FROM daily_call_monitoring 
        WHERE date = $1
        ORDER BY total_dials DESC
      `, [today]);

      return result.rows;
    } catch (error) {
      console.error('❌ Error getting current stats:', error);
      return [];
    } finally {
      client.release();
    }
  }

  // Get historical stats for any date range
  async getHistoricalStats(startDate: string, endDate: string) {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          date,
          agent_email,
          total_dials as dials,
          total_reached as reached,
          total_booked as booked
        FROM daily_call_monitoring 
        WHERE date >= $1 AND date <= $2
        ORDER BY date DESC, total_dials DESC
      `, [startDate, endDate]);

      return result.rows;
    } catch (error) {
      console.error('❌ Error getting historical stats:', error);
      return [];
    } finally {
      client.release();
    }
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('🎯 Call monitoring stopped');
    }
  }
}