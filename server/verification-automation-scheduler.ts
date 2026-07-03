/**
 * Verification Automation Scheduler
 * 
 * Automatically ensures all verification sessions have:
 * 1. IP analysis run when both agent and client IPs are available
 * 2. Transcripts and summaries fetched from Taalk API
 * 
 * Runs every 15 minutes to catch up on any missed data
 */

import * as cron from 'node-cron';
import { supabaseAdmin } from './supabase';
import { analyzeIPAddresses, getIPGeolocation, type LocationData } from './ip-analysis-service';

export class VerificationAutomationScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Start the automation scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Verification Automation Scheduler already running');
      return;
    }

    console.log('🔄 Starting Verification Automation Scheduler...');
    
    // Run every 15 minutes
    this.cronJob = cron.schedule('*/15 * * * *', async () => {
      console.log('⏰ Running verification automation checks...');
      await this.runAutomationChecks();
    }, {
      scheduled: true,
      timezone: "America/Los_Angeles"
    });

    this.isRunning = true;
    console.log('✅ Verification Automation Scheduler started - will run every 15 minutes');
    
    // Run immediately on startup
    setTimeout(() => {
      this.runAutomationChecks().catch(err => {
        console.error('❌ Initial automation check failed:', err);
      });
    }, 10000); // Wait 10 seconds after startup
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('🛑 Verification Automation Scheduler stopped');
  }

  /**
   * Run automation checks for all verification sessions
   */
  private async runAutomationChecks(): Promise<void> {
    try {
      console.log('🔍 Checking for sessions needing IP analysis...');
      
      // Find sessions that have both IPs but no IP analysis
      const { data: sessionsNeedingAnalysis, error: analysisError } = await supabaseAdmin
        .from('verification_sessions')
        .select('session_id, state, agent_ip_address, client_ip_address, agent_city, agent_region, agent_country, agent_latitude, agent_longitude, agent_isp, agent_timezone, agent_is_vpn, agent_is_proxy, agent_is_hosting, agent_vpn_detection_reason, client_city, client_region, client_country, client_latitude, client_longitude, client_isp, client_timezone, client_is_vpn, client_is_proxy, client_is_hosting, client_vpn_detection_reason, ip_flag_status')
        .not('agent_ip_address', 'is', null)
        .not('client_ip_address', 'is', null)
        .or('ip_flag_status.is.null,ip_flag_status.eq.pending')
        .limit(100);

      if (analysisError) {
        console.error('❌ Error fetching sessions needing IP analysis:', analysisError);
      } else if (sessionsNeedingAnalysis && sessionsNeedingAnalysis.length > 0) {
        console.log(`📊 Found ${sessionsNeedingAnalysis.length} sessions needing IP analysis`);
        
        let analyzedCount = 0;
        for (const session of sessionsNeedingAnalysis) {
          try {
            // Fetch geolocation for client IP if location data is missing
            let clientLocationData = null;
            if (session.client_ip_address && !session.client_city) {
              try {
                console.log(`  🔍 Fetching missing client geolocation for IP: ${session.client_ip_address}`);
                clientLocationData = await getIPGeolocation(session.client_ip_address);
                if (clientLocationData) {
                  // Update database with client location data
                  // Only update IP-based fields, don't overwrite device geolocation
                  await supabaseAdmin
                    .from('verification_sessions')
                    .update({
                      client_city: clientLocationData.city || null,
                      client_region: clientLocationData.regionName || null,
                      client_country: clientLocationData.country || null,
                      // CRITICAL: Do NOT use IP coordinates for GPS fields - GPS must come from device navigator.geolocation only
                      // client_latitude and client_longitude should only be set by actual device GPS, not IP geolocation
                      client_timezone: clientLocationData.timezone || null,
                      client_isp: clientLocationData.isp || null,
                      // GPS overrides IP-based VPN detection - only save VPN if GPS not available
                      client_is_vpn: (clientLocationData.isVpn && !session.client_latitude) || false,
                      client_is_proxy: clientLocationData.isProxy || false,
                      client_is_hosting: clientLocationData.isHosting || false,
                      client_vpn_detection_reason: (clientLocationData.isVpn && !session.client_latitude) ? clientLocationData.vpnDetectionReason : null,
                    })
                    .eq('session_id', session.session_id);
                  console.log(`  ✅ Client location data fetched and saved`);
                }
              } catch (geoError) {
                console.warn(`  ⚠️ Failed to fetch client geolocation:`, geoError);
              }
            }
            
            // Fetch geolocation for agent IP if location data is missing
            let agentLocationData = null;
            if (session.agent_ip_address && !session.agent_city) {
              try {
                console.log(`  🔍 Fetching missing agent geolocation for IP: ${session.agent_ip_address}`);
                agentLocationData = await getIPGeolocation(session.agent_ip_address);
                if (agentLocationData) {
                  // Only update IP-based fields, don't overwrite device geolocation
                  await supabaseAdmin
                    .from('verification_sessions')
                    .update({
                      agent_city: agentLocationData.city || null,
                      agent_region: agentLocationData.regionName || null,
                      agent_country: agentLocationData.country || null,
                      // CRITICAL: Do NOT use IP coordinates for GPS fields - GPS must come from device navigator.geolocation only
                      // agent_latitude and agent_longitude should only be set by actual device GPS, not IP geolocation
                      agent_timezone: agentLocationData.timezone || null,
                      agent_isp: agentLocationData.isp || null,
                      // GPS overrides IP-based VPN detection - only save VPN if GPS not available
                      agent_is_vpn: (agentLocationData.isVpn && !session.agent_latitude) || false,
                      agent_is_proxy: agentLocationData.isProxy || false,
                      agent_is_hosting: agentLocationData.isHosting || false,
                      agent_vpn_detection_reason: (agentLocationData.isVpn && !session.agent_latitude) ? agentLocationData.vpnDetectionReason : null,
                    })
                    .eq('session_id', session.session_id);
                  console.log(`  ✅ Agent location data fetched and saved`);
                }
              } catch (geoError) {
                console.warn(`  ⚠️ Failed to fetch agent geolocation:`, geoError);
              }
            }
            
            // IP ANALYSIS: Use ONLY IP-based geolocation data, NOT GPS coordinates
            // GPS coordinates are stored separately and should NOT be mixed with IP analysis
            const agentData: LocationData = {
              ip: session.agent_ip_address,
              city: agentLocationData?.city || session.agent_city || null, // IP-based only
              region: agentLocationData?.regionName || session.agent_region || null, // IP-based only
              country: agentLocationData?.country || session.agent_country || null, // IP-based only
              latitude: agentLocationData?.lat?.toString() || null, // IP-based coordinates ONLY - NOT GPS
              longitude: agentLocationData?.lon?.toString() || null, // IP-based coordinates ONLY - NOT GPS
              isp: agentLocationData?.isp || session.agent_isp || null,
              timezone: agentLocationData?.timezone || session.agent_timezone || null,
              isVpn: agentLocationData?.isVpn || session.agent_is_vpn === true,
              isProxy: agentLocationData?.isProxy || session.agent_is_proxy === true,
              isHosting: agentLocationData?.isHosting || session.agent_is_hosting === true,
              vpnDetectionReason: agentLocationData?.vpnDetectionReason || session.agent_vpn_detection_reason || null,
            };
            
            const clientData: LocationData = {
              ip: session.client_ip_address,
              city: clientLocationData?.city || session.client_city || null, // IP-based only
              region: clientLocationData?.regionName || session.client_region || null, // IP-based only
              country: clientLocationData?.country || session.client_country || null, // IP-based only
              latitude: clientLocationData?.lat?.toString() || null, // IP-based coordinates ONLY - NOT GPS
              longitude: clientLocationData?.lon?.toString() || null, // IP-based coordinates ONLY - NOT GPS
              isp: clientLocationData?.isp || session.client_isp || null,
              timezone: clientLocationData?.timezone || session.client_timezone || null,
              isVpn: clientLocationData?.isVpn || session.client_is_vpn === true,
              isProxy: clientLocationData?.isProxy || session.client_is_proxy === true,
              isHosting: clientLocationData?.isHosting || session.client_is_hosting === true,
              vpnDetectionReason: clientLocationData?.vpnDetectionReason || session.client_vpn_detection_reason || null,
            };
            
            // Check if geolocation was denied (has IP but no GPS)
            const agentGeolocationDenied = session.agent_ip_address && !session.agent_latitude && !session.agent_longitude;
            const clientGeolocationDenied = session.client_ip_address && !session.client_latitude && !session.client_longitude;
            
            const ipAnalysis = analyzeIPAddresses(agentData, clientData, session.state || null, {
              agentGeolocationDenied,
              clientGeolocationDenied,
            });
            
            // Update session with IP analysis
            // GPS overrides IP-based VPN detection - use VPN flags from analysis (which accounts for GPS)
            const { error: updateError } = await supabaseAdmin
              .from('verification_sessions')
              .update({
                ip_analysis: ipAnalysis,
                ip_flag_status: ipAnalysis.flagStatus,
                ip_flag_reason: ipAnalysis.reason,
                // Update VPN fields based on IP analysis result (GPS-aware)
                // If GPS exists, VPN will be false in ipAnalysis.details
                client_is_vpn: ipAnalysis.details.clientVpn || false,
                agent_is_vpn: ipAnalysis.details.agentVpn || false,
                // Note: ip_analysis_summary column may not exist - using ip_flag_reason instead
              })
              .eq('session_id', session.session_id);
            
            if (updateError) {
              console.error(`❌ Failed to update IP analysis for session ${session.session_id}:`, updateError);
            } else {
              analyzedCount++;
              if (!ipAnalysis.isValid) {
                console.log(`🚩 IP FLAGGED for session ${session.session_id}: ${ipAnalysis.reason}`);
              }
            }
          } catch (error) {
            console.error(`❌ Error analyzing IPs for session ${session.session_id}:`, error);
          }
        }
        
        console.log(`✅ Analyzed IP data for ${analyzedCount} sessions`);
      } else {
        console.log('✅ No sessions need IP analysis (all have both IPs analyzed or missing IPs)');
      }
      
    } catch (error) {
      console.error('❌ Error in verification automation checks:', error);
    }
  }
}

// Export singleton instance
export const verificationAutomationScheduler = new VerificationAutomationScheduler();

