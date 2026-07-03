/**
 * Script to find and re-analyze sessions by GPS coordinates or IP address
 * 
 * Usage:
 *   tsx server/reanalyze-session-by-coords.ts --client-lat 47.4957 --client-lng -121.7868
 *   tsx server/reanalyze-session-by-coords.ts --ip 73.239.158.173
 */

import { supabaseAdmin } from './supabase.js';
import { analyzeIPAddresses, getIPGeolocation, type LocationData } from './ip-analysis-service.js';

async function reanalyzeSession(session: any): Promise<void> {
  try {
    console.log(`\n🔍 Re-analyzing session ${session.session_id || session.id}`);
    console.log(`   Client GPS: ${session.client_latitude}, ${session.client_longitude}`);
    console.log(`   Agent GPS: ${session.agent_latitude}, ${session.agent_longitude}`);
    console.log(`   Client IP: ${session.client_ip_address}`);
    console.log(`   Agent IP: ${session.agent_ip_address}`);

    if (!session.agent_ip_address || !session.client_ip_address) {
      console.warn(`  ⚠️ Missing IPs - Agent: ${session.agent_ip_address ? '✓' : '✗'}, Client: ${session.client_ip_address ? '✓' : '✗'}`);
      return;
    }

    // PRIORITIZE device geolocation over IP-based location
    const agentData: LocationData = {
      ip: session.agent_ip_address,
      city: session.agent_city || null,
      region: session.agent_region || null,
      country: session.agent_country || null,
      latitude: session.agent_latitude || null, // Device GPS FIRST
      longitude: session.agent_longitude || null, // Device GPS FIRST
      isp: session.agent_isp || null,
      timezone: session.agent_timezone || null,
      isVpn: session.agent_is_vpn === true,
      isProxy: session.agent_is_proxy === true,
      isHosting: session.agent_is_hosting === true,
      vpnDetectionReason: session.agent_vpn_detection_reason || null,
    };

    const clientData: LocationData = {
      ip: session.client_ip_address,
      city: session.client_city || null,
      region: session.client_region || null,
      country: session.client_country || null,
      latitude: session.client_latitude || null, // Device GPS FIRST
      longitude: session.client_longitude || null, // Device GPS FIRST
      isp: session.client_isp || null,
      timezone: session.client_timezone || null,
      isVpn: session.client_is_vpn === true,
      isProxy: session.client_is_proxy === true,
      isHosting: session.client_is_hosting === true,
      vpnDetectionReason: session.client_vpn_detection_reason || null,
    };

    // Check if geolocation was denied (has IP but no GPS)
    // Only flag as denied if we have IP but no GPS coordinates
    const hasAgentGps = !!(session.agent_latitude && session.agent_longitude);
    const hasClientGps = !!(session.client_latitude && session.client_longitude);
    const agentGeolocationDenied = session.agent_ip_address && !hasAgentGps;
    const clientGeolocationDenied = session.client_ip_address && !hasClientGps;
    
    console.log(`   Agent GPS exists: ${hasAgentGps}, Denied: ${agentGeolocationDenied}`);
    console.log(`   Client GPS exists: ${hasClientGps}, Denied: ${clientGeolocationDenied}`);
    
    const ipAnalysis = analyzeIPAddresses(agentData, clientData, session.state || null, {
      agentGeolocationDenied,
      clientGeolocationDenied,
    });

    console.log(`\n   📊 Analysis Result:`);
    console.log(`      Flag Status: ${ipAnalysis.flagStatus.toUpperCase()}`);
    console.log(`      Reason: ${ipAnalysis.reason}`);
    if (ipAnalysis.details.distanceMiles !== null) {
      console.log(`      Distance: ${ipAnalysis.details.distanceMiles.toFixed(2)} miles`);
    }
    console.log(`      Same IP: ${ipAnalysis.details.sameIp ? 'Yes' : 'No'}`);
    console.log(`      Same City: ${ipAnalysis.details.sameCity ? 'Yes' : 'No'}`);
    console.log(`      Same Region: ${ipAnalysis.details.sameRegion ? 'Yes' : 'No'}`);

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
    
    const { error: updateError } = await supabaseAdmin
      .from('verification_sessions')
      .update(updateData)
      .eq('session_id', session.session_id || session.id);

    if (updateError) {
      console.error(`  ❌ Failed to save IP analysis:`, updateError);
      throw updateError;
    }

    console.log(`  ✅ Analysis saved successfully!`);
  } catch (error: any) {
    console.error(`  ❌ Error analyzing session:`, error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  const clientLatIndex = args.indexOf('--client-lat');
  const clientLngIndex = args.indexOf('--client-lng');
  const agentLatIndex = args.indexOf('--agent-lat');
  const agentLngIndex = args.indexOf('--agent-lng');
  const ipIndex = args.indexOf('--ip');
  
  const clientLat = clientLatIndex !== -1 ? parseFloat(args[clientLatIndex + 1]) : null;
  const clientLng = clientLngIndex !== -1 ? parseFloat(args[clientLngIndex + 1]) : null;
  const agentLat = agentLatIndex !== -1 ? parseFloat(args[agentLatIndex + 1]) : null;
  const agentLng = agentLngIndex !== -1 ? parseFloat(args[agentLngIndex + 1]) : null;
  const ip = ipIndex !== -1 ? args[ipIndex + 1] : null;

  if (!supabaseAdmin) {
    console.error('❌ Supabase not available');
    process.exit(1);
  }

  try {
    let query = supabaseAdmin
      .from('verification_sessions')
      .select('*');

    // Build query based on provided parameters
    if (clientLat && clientLng) {
      // Find sessions with matching client GPS coordinates (with small tolerance)
      const tolerance = 0.001; // ~100 meters
      query = query
        .gte('client_latitude', (clientLat - tolerance).toString())
        .lte('client_latitude', (clientLat + tolerance).toString())
        .gte('client_longitude', (clientLng - tolerance).toString())
        .lte('client_longitude', (clientLng + tolerance).toString());
    } else if (agentLat && agentLng) {
      // Find sessions with matching agent GPS coordinates
      const tolerance = 0.001;
      query = query
        .gte('agent_latitude', (agentLat - tolerance).toString())
        .lte('agent_latitude', (agentLat + tolerance).toString())
        .gte('agent_longitude', (agentLng - tolerance).toString())
        .lte('agent_longitude', (agentLng + tolerance).toString());
    } else if (ip) {
      // Find sessions with matching IP address
      query = query.or(`client_ip_address.eq.${ip},agent_ip_address.eq.${ip}`);
    } else {
      console.error('❌ Please provide either --client-lat/--client-lng, --agent-lat/--agent-lng, or --ip');
      process.exit(1);
    }

    query = query.order('created_at', { ascending: false }).limit(10);

    const { data: sessions, error } = await query;

    if (error) {
      console.error('❌ Error fetching sessions:', error);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log('❌ No sessions found matching the criteria');
      return;
    }

    console.log(`📊 Found ${sessions.length} session(s) matching criteria`);
    
    for (const session of sessions) {
      await reanalyzeSession(session);
    }

    console.log(`\n✅ Re-analysis complete! Processed ${sessions.length} session(s)`);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

