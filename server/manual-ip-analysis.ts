/**
 * Manual script to analyze IP addresses for verification sessions
 * 
 * Usage:
 *   tsx server/manual-ip-analysis.ts                    # Analyze all unprocessed
 *   tsx server/manual-ip-analysis.ts --limit 50          # Analyze first 50
 *   tsx server/manual-ip-analysis.ts --session <id>      # Analyze specific session
 */

import { supabaseAdmin } from './supabase.js';
import { analyzeIPAddresses, getIPGeolocation, type LocationData } from './ip-analysis-service.js';

async function analyzeSessionIPs(session: any): Promise<void> {
  try {
    console.log(`  Analyzing IPs for session ${session.session_id || session.id}`);

    if (!session.agent_ip_address || !session.client_ip_address) {
      console.warn(`  ⚠️ Missing IPs - Agent: ${session.agent_ip_address ? '✓' : '✗'}, Client: ${session.client_ip_address ? '✓' : '✗'}`);
      return;
    }

    // Fetch geolocation for client IP if location data is missing
    let clientLocationData = null;
    if (session.client_ip_address && !session.client_city) {
      try {
        console.log(`    🔍 Fetching missing client geolocation for IP: ${session.client_ip_address}`);
        clientLocationData = await getIPGeolocation(session.client_ip_address);
        if (clientLocationData) {
          // Update database with client location data
          // DON'T overwrite device GPS - only use IP if device GPS not present
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
            .eq('session_id', session.session_id || session.id);
          console.log(`    ✅ Client location data fetched and saved`);
        }
      } catch (geoError) {
        console.warn(`    ⚠️ Failed to fetch client geolocation:`, geoError);
      }
    }
    
    // Fetch geolocation for agent IP if location data is missing
    let agentLocationData = null;
    if (session.agent_ip_address && !session.agent_city) {
      try {
        console.log(`    🔍 Fetching missing agent geolocation for IP: ${session.agent_ip_address}`);
        agentLocationData = await getIPGeolocation(session.agent_ip_address);
        if (agentLocationData) {
          // Update database with agent location data
          // DON'T overwrite device GPS - only use IP if device GPS not present
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
            .eq('session_id', session.session_id || session.id);
          console.log(`    ✅ Agent location data fetched and saved`);
        }
      } catch (geoError) {
        console.warn(`    ⚠️ Failed to fetch agent geolocation:`, geoError);
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

    console.log(`    Agent: ${session.agent_ip_address} (${agentData.city || 'unknown'})`);
    console.log(`    Client: ${session.client_ip_address} (${clientData.city || 'unknown'})`);

    // Check if geolocation was denied (has IP but no GPS)
    // Only flag as denied if we have IP but no GPS coordinates
    const hasAgentGps = !!(session.agent_latitude && session.agent_longitude);
    const hasClientGps = !!(session.client_latitude && session.client_longitude);
    const agentGeolocationDenied = session.agent_ip_address && !hasAgentGps;
    const clientGeolocationDenied = session.client_ip_address && !hasClientGps;
    
    const ipAnalysis = analyzeIPAddresses(agentData, clientData, session.state || null, {
      agentGeolocationDenied,
      clientGeolocationDenied,
    });

    // Update session with IP analysis
    // GPS overrides IP-based VPN detection - use VPN flags from analysis (which accounts for GPS)
    const updateData: any = {
      ip_analysis: ipAnalysis,
      ip_flag_status: ipAnalysis.flagStatus,
      ip_flag_reason: ipAnalysis.reason,
      // Update VPN fields based on IP analysis result (GPS-aware)
      // If GPS exists, VPN will be false in ipAnalysis.details
      client_is_vpn: ipAnalysis.details.clientVpn || false,
      agent_is_vpn: ipAnalysis.details.agentVpn || false,
    };
    
    // Only include ip_analysis_summary if the column exists (won't fail if it doesn't)
    // The hover card can use ip_flag_reason instead
    
    const { error: updateError } = await supabaseAdmin
      .from('verification_sessions')
      .update(updateData)
      .eq('session_id', session.session_id || session.id);

    if (updateError) {
      console.error(`  ❌ Failed to save IP analysis:`, updateError);
      throw updateError;
    }

    console.log(`  ✅ Analysis complete: ${ipAnalysis.flagStatus.toUpperCase()} - ${ipAnalysis.reason}`);
    if (ipAnalysis.details.distanceMiles !== null) {
      console.log(`     Distance: ${ipAnalysis.details.distanceMiles} miles`);
    }
  } catch (error: any) {
    console.error(`  ❌ Error analyzing IPs for session ${session.session_id || session.id}:`, error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) || 100 : 100;
  const sessionIndex = args.indexOf('--session');
  const sessionId = sessionIndex !== -1 ? args[sessionIndex + 1] : null;

  if (!supabaseAdmin) {
    console.error('❌ Supabase not available');
    process.exit(1);
  }

  try {
    if (sessionId) {
      // Analyze specific session
      const { data: session, error } = await supabaseAdmin
        .from('verification_sessions')
        .select('*')
        .or(`session_id.eq.${sessionId},id.eq.${sessionId}`)
        .single();

      if (error || !session) {
        console.error(`❌ Session ${sessionId} not found`);
        return;
      }

      await analyzeSessionIPs(session);
      return;
    }

    // Find all sessions with both IPs but no analysis
    console.log('🔍 Finding sessions with both IPs that need analysis...');

    const { data: allSessions, error } = await supabaseAdmin
      .from('verification_sessions')
      .select('*')
      .not('agent_ip_address', 'is', null)
      .not('client_ip_address', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit * 2);

    if (error) {
      console.error('❌ Error fetching sessions:', error);
      return;
    }

    if (!allSessions || allSessions.length === 0) {
      console.log('✅ No sessions with both IPs found');
      return;
    }

    // Filter to sessions that need analysis OR are missing location data
    const sessions = allSessions.filter(session =>
      !session.ip_flag_status ||
      session.ip_flag_status === 'pending' ||
      !session.ip_analysis ||
      (session.client_ip_address && !session.client_city) ||
      (session.agent_ip_address && !session.agent_city)
    );

    if (sessions.length === 0) {
      console.log(`✅ No sessions need IP analysis or location data (filtered from ${allSessions.length} total)`);
      return;
    }

    console.log(`📊 Found ${sessions.length} session(s) needing IP analysis (from ${allSessions.length} with both IPs)`);
    console.log('🚀 Starting analysis...\n');

    for (const session of sessions) {
      await analyzeSessionIPs(session);
    }

    console.log(`\n✅ Analysis complete! Processed ${sessions.length} session(s)`);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

