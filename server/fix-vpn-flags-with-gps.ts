/**
 * Script to fix VPN flags for sessions that have GPS coordinates
 * GPS location overrides IP-based VPN detection, so sessions with GPS should not be flagged as VPN
 * 
 * Usage:
 *   tsx server/fix-vpn-flags-with-gps.ts
 *   tsx server/fix-vpn-flags-with-gps.ts --limit 100
 *   tsx server/fix-vpn-flags-with-gps.ts --dry-run
 */

import { supabaseAdmin } from './supabase.js';
import { analyzeIPAddresses, type LocationData } from './ip-analysis-service.js';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './hardcoded-config.js';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

interface VerificationSession {
  id: number;
  session_id: string;
  client_ip_address: string | null;
  client_latitude: string | null;
  client_longitude: string | null;
  client_city: string | null;
  client_region: string | null;
  client_country: string | null;
  client_isp: string | null;
  client_timezone: string | null;
  client_is_vpn: boolean | null;
  client_is_proxy: boolean | null;
  client_is_hosting: boolean | null;
  client_vpn_detection_reason: string | null;
  agent_ip_address: string | null;
  agent_latitude: string | null;
  agent_longitude: string | null;
  agent_city: string | null;
  agent_region: string | null;
  agent_country: string | null;
  agent_isp: string | null;
  agent_timezone: string | null;
  agent_is_vpn: boolean | null;
  agent_is_proxy: boolean | null;
  agent_is_hosting: boolean | null;
  agent_vpn_detection_reason: string | null;
  state: string | null;
  ip_flag_status: string | null;
  ip_flag_reason: string | null;
  ip_analysis: any;
}

async function fixVPNSession(session: VerificationSession, dryRun: boolean = false): Promise<boolean> {
  try {
    const hasClientGps = !!(session.client_latitude && session.client_longitude);
    const hasAgentGps = !!(session.agent_latitude && session.agent_longitude);
    
    // Only process sessions that have GPS AND are flagged as VPN
    const needsClientFix = hasClientGps && session.client_is_vpn === true;
    const needsAgentFix = hasAgentGps && session.agent_is_vpn === true;
    
    if (!needsClientFix && !needsAgentFix) {
      return false; // No fix needed
    }

    if (!session.agent_ip_address || !session.client_ip_address) {
      console.warn(`  ⚠️ Missing IPs - Skipping session ${session.session_id}`);
      return false;
    }

    console.log(`\n🔍 Fixing VPN flags for session ${session.session_id}`);
    if (needsClientFix) {
      console.log(`   Client GPS: ${session.client_latitude}, ${session.client_longitude} (currently flagged as VPN)`);
    }
    if (needsAgentFix) {
      console.log(`   Agent GPS: ${session.agent_latitude}, ${session.agent_longitude} (currently flagged as VPN)`);
    }

    // Build location data for analysis
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

    // Check if geolocation was denied
    const agentGeolocationDenied = session.agent_ip_address && !hasAgentGps;
    const clientGeolocationDenied = session.client_ip_address && !hasClientGps;

    // Re-run IP analysis with GPS-aware logic
    const ipAnalysis = analyzeIPAddresses(agentData, clientData, session.state || null, {
      agentGeolocationDenied,
      clientGeolocationDenied,
    });

    // Check if VPN flags changed
    const oldClientVpn = session.client_is_vpn === true;
    const oldAgentVpn = session.agent_is_vpn === true;
    const newClientVpn = ipAnalysis.details.clientVpn || false;
    const newAgentVpn = ipAnalysis.details.agentVpn || false;

    const clientVpnChanged = oldClientVpn !== newClientVpn;
    const agentVpnChanged = oldAgentVpn !== newAgentVpn;

    if (!clientVpnChanged && !agentVpnChanged) {
      console.log(`   ✓ VPN flags already correct (no changes needed)`);
      return false;
    }

    if (dryRun) {
      console.log(`   [DRY RUN] Would update:`);
      if (clientVpnChanged) {
        console.log(`     client_is_vpn: ${oldClientVpn} → ${newClientVpn}`);
      }
      if (agentVpnChanged) {
        console.log(`     agent_is_vpn: ${oldAgentVpn} → ${newAgentVpn}`);
      }
      return true;
    }

    // Update session with corrected VPN flags
    const updateData: any = {
      ip_analysis: ipAnalysis,
      ip_flag_status: ipAnalysis.flagStatus,
      ip_flag_reason: ipAnalysis.reason,
      // Update VPN fields based on IP analysis result (GPS-aware)
      client_is_vpn: newClientVpn,
      agent_is_vpn: newAgentVpn,
      // Clear VPN detection reason if VPN is now false
      client_vpn_detection_reason: newClientVpn ? session.client_vpn_detection_reason : null,
      agent_vpn_detection_reason: newAgentVpn ? session.agent_vpn_detection_reason : null,
    };

    const { error: updateError } = await supabaseAdmin
      .from('verification_sessions')
      .update(updateData)
      .eq('session_id', session.session_id);

    if (updateError) {
      console.error(`  ❌ Failed to update session:`, updateError);
      return false;
    }

    console.log(`   ✅ Updated VPN flags:`);
    if (clientVpnChanged) {
      console.log(`     client_is_vpn: ${oldClientVpn} → ${newClientVpn} (GPS overrides IP detection)`);
    }
    if (agentVpnChanged) {
      console.log(`     agent_is_vpn: ${oldAgentVpn} → ${newAgentVpn} (GPS overrides IP detection)`);
    }
    console.log(`     Flag status: ${ipAnalysis.flagStatus.toUpperCase()}`);

    return true;
  } catch (error: any) {
    console.error(`  ❌ Error fixing session ${session.session_id}:`, error.message);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;
  const dryRun = args.includes('--dry-run');

  console.log('🔧 Fixing VPN flags for sessions with GPS coordinates\n');
  console.log(`   GPS location overrides IP-based VPN detection`);
  console.log(`   Sessions with GPS should not be flagged as VPN\n`);

  if (dryRun) {
    console.log('   [DRY RUN MODE - No changes will be saved]\n');
  }

  try {
    // Find sessions that have GPS coordinates AND are flagged as VPN
    // Query for sessions where:
    // - Client has GPS AND client_is_vpn = true, OR
    // - Agent has GPS AND agent_is_vpn = true
    
    // Get sessions where client has GPS and is VPN
    let clientQuery = supabaseAdmin
      .from('verification_sessions')
      .select('id, session_id, client_ip_address, client_latitude, client_longitude, client_city, client_region, client_country, client_isp, client_timezone, client_is_vpn, client_is_proxy, client_is_hosting, client_vpn_detection_reason, agent_ip_address, agent_latitude, agent_longitude, agent_city, agent_region, agent_country, agent_isp, agent_timezone, agent_is_vpn, agent_is_proxy, agent_is_hosting, agent_vpn_detection_reason, state, ip_flag_status, ip_flag_reason, ip_analysis')
      .eq('client_is_vpn', true)
      .not('client_latitude', 'is', null)
      .not('client_longitude', 'is', null);
    
    if (limit) {
      clientQuery = clientQuery.limit(limit);
    }
    
    const { data: clientSessions, error: clientError } = await clientQuery.order('created_at', { ascending: false });
    
    // Get sessions where agent has GPS and is VPN
    let agentQuery = supabaseAdmin
      .from('verification_sessions')
      .select('id, session_id, client_ip_address, client_latitude, client_longitude, client_city, client_region, client_country, client_isp, client_timezone, client_is_vpn, client_is_proxy, client_is_hosting, client_vpn_detection_reason, agent_ip_address, agent_latitude, agent_longitude, agent_city, agent_region, agent_country, agent_isp, agent_timezone, agent_is_vpn, agent_is_proxy, agent_is_hosting, agent_vpn_detection_reason, state, ip_flag_status, ip_flag_reason, ip_analysis')
      .eq('agent_is_vpn', true)
      .not('agent_latitude', 'is', null)
      .not('agent_longitude', 'is', null);
    
    if (limit) {
      agentQuery = agentQuery.limit(limit);
    }
    
    const { data: agentSessions, error: agentError } = await agentQuery.order('created_at', { ascending: false });
    
    if (clientError || agentError) {
      console.error('❌ Error fetching sessions:', clientError || agentError);
      process.exit(1);
    }
    
    // Combine and deduplicate by session_id
    const sessionMap = new Map<string, VerificationSession>();
    
    if (clientSessions) {
      clientSessions.forEach((s: VerificationSession) => {
        if (s.session_id && s.client_latitude && s.client_longitude && s.client_is_vpn === true) {
          sessionMap.set(s.session_id, s);
        }
      });
    }
    
    if (agentSessions) {
      agentSessions.forEach((s: VerificationSession) => {
        if (s.session_id && s.agent_latitude && s.agent_longitude && s.agent_is_vpn === true) {
          // Merge with existing session if already in map
          const existing = sessionMap.get(s.session_id);
          if (existing) {
            // Keep the more complete session
            sessionMap.set(s.session_id, s);
          } else {
            sessionMap.set(s.session_id, s);
          }
        }
      });
    }
    
    const sessions = Array.from(sessionMap.values());

    if (!sessions || sessions.length === 0) {
      console.log('✅ No sessions found that need VPN flag fixes');
      return;
    }

    console.log(`📊 Found ${sessions.length} sessions with GPS coordinates that are flagged as VPN\n`);

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const session of sessions) {
      const wasFixed = await fixVPNSession(session as VerificationSession, dryRun);
      if (wasFixed) {
        fixed++;
      } else {
        skipped++;
      }

      // Rate limiting: Small delay between updates
      if (!dryRun && fixed > 0 && fixed % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Total sessions checked: ${sessions.length}`);
    console.log(`Sessions fixed: ${fixed}`);
    console.log(`Sessions skipped (no changes needed): ${skipped}`);
    console.log(`Errors: ${errors}`);
    if (dryRun) {
      console.log('\n⚠️  DRY RUN MODE - No changes were saved');
      console.log('   Run without --dry-run to apply changes');
    } else {
      console.log('\n✅ VPN flags have been corrected for sessions with GPS coordinates');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Export main function for programmatic use
export { main };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith('fix-vpn-flags-with-gps.ts')) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

