/**
 * Validate GPS Coordinates vs IP-Based Location
 * 
 * This script checks if GPS coordinates match IP-based location.
 * If GPS and IP locations are significantly different (>100 miles), 
 * it could indicate:
 * 1. GPS spoofing
 * 2. User traveling (legitimate)
 * 3. Mobile carrier routing (IP shows carrier location, GPS shows user location)
 * 
 * Usage:
 *   tsx server/validate-gps-vs-ip-location.ts
 *   tsx server/validate-gps-vs-ip-location.ts --limit 100
 */

import { supabaseAdmin } from './supabase.js';
import { getIPGeolocation, calculateDistanceMiles } from './ip-analysis-service.js';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './hardcoded-config.js';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

interface VerificationSession {
  id: string;
  session_id: string;
  client_ip_address: string | null;
  client_latitude: string | null;
  client_longitude: string | null;
  client_city: string | null;
  client_region: string | null;
  client_country: string | null;
  agent_ip_address: string | null;
  agent_latitude: string | null;
  agent_longitude: string | null;
  agent_city: string | null;
  agent_region: string | null;
  agent_country: string | null;
  created_at: string;
}

interface LocationMismatch {
  sessionId: string;
  type: 'agent' | 'client';
  gpsLat: number;
  gpsLon: number;
  gpsLocation: string;
  ipLocation: string;
  ipLat: number | null;
  ipLon: number | null;
  distanceMiles: number | null;
  cityMatch: boolean;
  regionMatch: boolean;
  countryMatch: boolean;
}

async function validateGPSvsIP() {
  console.log('🔍 Validating GPS coordinates against IP-based locations...\n');

  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

  try {
    // Fetch sessions with both GPS and IP addresses
    let query = supabaseAdmin
      .from('verification_sessions')
      .select('id, session_id, client_ip_address, client_latitude, client_longitude, client_city, client_region, client_country, agent_ip_address, agent_latitude, agent_longitude, agent_city, agent_region, agent_country, created_at')
      .not('client_ip_address', 'is', null)
      .not('client_latitude', 'is', null)
      .not('client_longitude', 'is', null)
      .order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('❌ Error fetching sessions:', error);
      process.exit(1);
    }

    if (!sessions || sessions.length === 0) {
      console.log('✅ No sessions found with both GPS and IP addresses');
      return;
    }

    console.log(`📊 Found ${sessions.length} sessions with GPS and IP addresses\n`);

    const mismatches: LocationMismatch[] = [];
    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const session of sessions as VerificationSession[]) {
      processed++;

      // Validate client GPS vs IP
      if (session.client_ip_address && session.client_latitude && session.client_longitude) {
        try {
          const clientGPSLat = parseFloat(session.client_latitude);
          const clientGPSLon = parseFloat(session.client_longitude);

          if (isNaN(clientGPSLat) || isNaN(clientGPSLon)) {
            console.log(`⚠️ [${processed}/${sessions.length}] Session ${session.session_id}: Invalid GPS coordinates`);
            skipped++;
            continue;
          }

          // Fetch IP-based location
          const ipLocationData = await getIPGeolocation(session.client_ip_address);

          if (ipLocationData && ipLocationData.lat && ipLocationData.lon) {
            const ipLat = ipLocationData.lat;
            const ipLon = ipLocationData.lon;

            // Calculate distance between GPS and IP location
            const distanceMiles = calculateDistanceMiles(clientGPSLat, clientGPSLon, ipLat, ipLon);

            // Check if cities/regions match
            const cityMatch = session.client_city && ipLocationData.city
              ? session.client_city.toLowerCase() === ipLocationData.city.toLowerCase()
              : false;
            const regionMatch = session.client_region && ipLocationData.regionName
              ? session.client_region.toLowerCase() === ipLocationData.regionName.toLowerCase()
              : false;
            const countryMatch = session.client_country && ipLocationData.country
              ? session.client_country.toLowerCase() === ipLocationData.country.toLowerCase()
              : false;

            const gpsLocation = `${session.client_city || 'Unknown'}, ${session.client_region || 'Unknown'}`;
            const ipLocation = `${ipLocationData.city || 'Unknown'}, ${ipLocationData.regionName || 'Unknown'}`;

            // Flag if distance is significant (>100 miles) or regions don't match
            if (distanceMiles > 100 || (!regionMatch && distanceMiles > 50)) {
              mismatches.push({
                sessionId: session.session_id,
                type: 'client',
                gpsLat: clientGPSLat,
                gpsLon: clientGPSLon,
                gpsLocation,
                ipLocation,
                ipLat,
                ipLon,
                distanceMiles,
                cityMatch,
                regionMatch,
                countryMatch,
              });

              console.log(`\n🔴 MISMATCH [Client] Session ${session.session_id}:`);
              console.log(`   GPS: ${gpsLocation} (${clientGPSLat}, ${clientGPSLon})`);
              console.log(`   IP:  ${ipLocation} (${ipLat}, ${ipLon})`);
              console.log(`   Distance: ${distanceMiles.toFixed(2)} miles`);
              console.log(`   City Match: ${cityMatch}, Region Match: ${regionMatch}, Country Match: ${countryMatch}`);
            } else {
              console.log(`✓ [${processed}/${sessions.length}] Client GPS matches IP location (${distanceMiles.toFixed(2)} miles)`);
            }
          } else {
            console.log(`⚠️ [${processed}/${sessions.length}] Could not fetch IP location for ${session.client_ip_address}`);
            skipped++;
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error: any) {
          console.error(`❌ Error validating client GPS for session ${session.session_id}:`, error.message);
          errors++;
        }
      }

      // Validate agent GPS vs IP
      if (session.agent_ip_address && session.agent_latitude && session.agent_longitude) {
        try {
          const agentGPSLat = parseFloat(session.agent_latitude);
          const agentGPSLon = parseFloat(session.agent_longitude);

          if (isNaN(agentGPSLat) || isNaN(agentGPSLon)) {
            skipped++;
            continue;
          }

          // Fetch IP-based location
          const ipLocationData = await getIPGeolocation(session.agent_ip_address);

          if (ipLocationData && ipLocationData.lat && ipLocationData.lon) {
            const ipLat = ipLocationData.lat;
            const ipLon = ipLocationData.lon;

            // Calculate distance between GPS and IP location
            const distanceMiles = calculateDistanceMiles(agentGPSLat, agentGPSLon, ipLat, ipLon);

            // Check if cities/regions match
            const cityMatch = session.agent_city && ipLocationData.city
              ? session.agent_city.toLowerCase() === ipLocationData.city.toLowerCase()
              : false;
            const regionMatch = session.agent_region && ipLocationData.regionName
              ? session.agent_region.toLowerCase() === ipLocationData.regionName.toLowerCase()
              : false;
            const countryMatch = session.agent_country && ipLocationData.country
              ? session.agent_country.toLowerCase() === ipLocationData.country.toLowerCase()
              : false;

            const gpsLocation = `${session.agent_city || 'Unknown'}, ${session.agent_region || 'Unknown'}`;
            const ipLocation = `${ipLocationData.city || 'Unknown'}, ${ipLocationData.regionName || 'Unknown'}`;

            // Flag if distance is significant (>100 miles) or regions don't match
            if (distanceMiles > 100 || (!regionMatch && distanceMiles > 50)) {
              mismatches.push({
                sessionId: session.session_id,
                type: 'agent',
                gpsLat: agentGPSLat,
                gpsLon: agentGPSLon,
                gpsLocation,
                ipLocation,
                ipLat,
                ipLon,
                distanceMiles,
                cityMatch,
                regionMatch,
                countryMatch,
              });

              console.log(`\n🔴 MISMATCH [Agent] Session ${session.session_id}:`);
              console.log(`   GPS: ${gpsLocation} (${agentGPSLat}, ${agentGPSLon})`);
              console.log(`   IP:  ${ipLocation} (${ipLat}, ${ipLon})`);
              console.log(`   Distance: ${distanceMiles.toFixed(2)} miles`);
              console.log(`   City Match: ${cityMatch}, Region Match: ${regionMatch}, Country Match: ${countryMatch}`);
            } else {
              console.log(`✓ [${processed}/${sessions.length}] Agent GPS matches IP location (${distanceMiles.toFixed(2)} miles)`);
            }
          } else {
            console.log(`⚠️ [${processed}/${sessions.length}] Could not fetch IP location for ${session.agent_ip_address}`);
            skipped++;
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error: any) {
          console.error(`❌ Error validating agent GPS for session ${session.session_id}:`, error.message);
          errors++;
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 VALIDATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Total sessions processed: ${processed}`);
    console.log(`Sessions with GPS/IP match: ${processed - mismatches.length - skipped - errors}`);
    console.log(`Sessions with GPS/IP mismatch (>100 miles or different region): ${mismatches.length}`);
    console.log(`Sessions skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);

    if (mismatches.length > 0) {
      console.log('\n🔴 LOCATION MISMATCHES DETECTED:');
      console.log('   These GPS coordinates are significantly different from IP-based location.');
      console.log('   Possible reasons:');
      console.log('   1. GPS spoofing (fake location)');
      console.log('   2. User traveling (legitimate)');
      console.log('   3. Mobile carrier routing (IP shows carrier location, GPS shows user location)');
      console.log('   4. VPN with GPS spoofing');
      console.log('\n   Review these sessions manually to determine if GPS is legitimate.\n');
    } else {
      console.log('\n✅ All GPS coordinates match IP-based locations (within 100 miles)');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the validation
validateGPSvsIP()
  .then(() => {
    console.log('\n✅ Validation script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Validation script failed:', error);
    process.exit(1);
  });

