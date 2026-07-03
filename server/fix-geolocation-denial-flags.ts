/**
 * Fix Geolocation Denial Flags
 * 
 * This script fixes all verification sessions that were incorrectly flagged as CRITICAL
 * due to geolocation denial. Updates them to SUSPICIOUS with the new logic.
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './hardcoded-config.js';
import { analyzeIPAddresses } from './ip-analysis-service.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface VerificationSession {
  id: string;
  ip_flag_status: string | null;
  ip_flag_reason: string | null;
  agent_ip_address: string | null;
  client_ip_address: string | null;
  agent_latitude: string | null;
  agent_longitude: string | null;
  client_latitude: string | null;
  client_longitude: string | null;
  agent_city: string | null;
  agent_region: string | null;
  agent_country: string | null;
  client_city: string | null;
  client_region: string | null;
  client_country: string | null;
  agent_is_vpn: boolean | null;
  client_is_vpn: boolean | null;
  agent_is_proxy: boolean | null;
  client_is_proxy: boolean | null;
  agent_is_hosting: boolean | null;
  client_is_hosting: boolean | null;
  agent_vpn_detection_reason: string | null;
  client_vpn_detection_reason: string | null;
  state: string | null;
  created_at: string;
}

async function fixGeolocationDenialFlags() {
  console.log('🔄 Starting fix for geolocation denial flags...\n');

  try {
    // Find all sessions flagged as CRITICAL due to geolocation denial
    const { data: sessions, error: fetchError } = await supabase
      .from('verification_sessions')
      .select('id, ip_flag_status, ip_flag_reason, agent_ip_address, client_ip_address, agent_latitude, agent_longitude, client_latitude, client_longitude, agent_city, agent_region, agent_country, client_city, client_region, client_country, agent_is_vpn, client_is_vpn, agent_is_proxy, client_is_proxy, agent_is_hosting, client_is_hosting, agent_vpn_detection_reason, client_vpn_detection_reason, state, created_at')
      .or('ip_flag_status.eq.critical,ip_flag_reason.ilike.%denied device geolocation%')
      .order('created_at', { ascending: false })
      .limit(1000); // Get up to 1000 sessions

    if (fetchError) {
      console.error('❌ Error fetching sessions:', fetchError);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log('⚠️ No sessions found with CRITICAL geolocation denial flags');
      return;
    }

    console.log(`📊 Found ${sessions.length} sessions to check\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i] as VerificationSession;
      console.log(`\n[${i + 1}/${sessions.length}] Processing session ${session.id}...`);

      // Check if this is a geolocation denial issue
      const isGeolocationDenial = 
        session.ip_flag_status === 'critical' && 
        session.ip_flag_reason?.toLowerCase().includes('denied device geolocation');

      if (!isGeolocationDenial) {
        console.log(`   ⏭️ Skipping - not a geolocation denial issue`);
        skipped++;
        continue;
      }

      // Prepare location data for re-analysis
      const hasAgentGps = !!(session.agent_latitude && session.agent_longitude);
      const hasClientGps = !!(session.client_latitude && session.client_longitude);
      const agentDenied = session.agent_ip_address && !hasAgentGps;
      const clientDenied = session.client_ip_address && !hasClientGps;

      const agentData = {
        ip: session.agent_ip_address || null,
        city: session.agent_city || null,
        region: session.agent_region || null,
        country: session.agent_country || null,
        latitude: session.agent_latitude || null,
        longitude: session.agent_longitude || null,
        isVpn: session.agent_is_vpn || false,
        isProxy: session.agent_is_proxy || false,
        isHosting: session.agent_is_hosting || false,
        vpnDetectionReason: session.agent_vpn_detection_reason || null,
      };

      const clientData = {
        ip: session.client_ip_address || null,
        city: session.client_city || null,
        region: session.client_region || null,
        country: session.client_country || null,
        latitude: session.client_latitude || null,
        longitude: session.client_longitude || null,
        isVpn: session.client_is_vpn || false,
        isProxy: session.client_is_proxy || false,
        isHosting: session.client_is_hosting || false,
        vpnDetectionReason: session.client_vpn_detection_reason || null,
      };

      // Re-analyze with new logic
      try {
        const analysis = analyzeIPAddresses(
          agentData,
          clientData,
          session.state || null,
          {
            agentGeolocationDenied: agentDenied,
            clientGeolocationDenied: clientDenied,
          }
        );

        // Only update if the flag status changed from critical to suspicious
        if (analysis.flagStatus === 'suspicious' && session.ip_flag_status === 'critical') {
          const { error: updateError } = await supabase
            .from('verification_sessions')
            .update({
              ip_flag_status: analysis.flagStatus,
              ip_flag_reason: analysis.reason,
            })
            .eq('id', session.id);

          if (updateError) {
            console.error(`   ❌ Failed to update session:`, updateError);
            errors++;
          } else {
            console.log(`   ✅ Updated: ${session.ip_flag_status} → ${analysis.flagStatus}`);
            console.log(`      Reason: ${analysis.reason.substring(0, 80)}...`);
            updated++;
          }
        } else {
          console.log(`   ✓ Flag status already correct: ${analysis.flagStatus}`);
          skipped++;
        }
      } catch (analysisError) {
        console.error(`   ❌ Error re-analyzing session:`, analysisError);
        errors++;
      }

      // Rate limiting: Small delay between updates
      if (i < sessions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`\n✅ Fix completed!`);
    console.log(`   Updated: ${updated} sessions (CRITICAL → SUSPICIOUS)`);
    console.log(`   Skipped: ${skipped} sessions (not geolocation denial or already correct)`);
    console.log(`   Errors: ${errors} sessions`);

  } catch (error) {
    console.error('❌ Fatal error during fix:', error);
    process.exit(1);
  }
}

// Run the fix
fixGeolocationDenialFlags()
  .then(() => {
    console.log('\n✅ Fix script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fix script failed:', error);
    process.exit(1);
  });
