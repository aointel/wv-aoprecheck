/**
 * Backfill IP Geolocation for Last 200 Verification Sessions
 * 
 * This script re-fetches IP geolocation data using ipinfo.io (accurate)
 * for the last 200 verification sessions to fix incorrect Google HQ locations
 * that were stored using the old ip-api.com service.
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './hardcoded-config.js';
import { getIPGeolocation } from './ip-analysis-service.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface VerificationSession {
  id: string;
  client_ip_address: string | null;
  agent_ip_address: string | null;
  client_latitude: string | null;
  client_longitude: string | null;
  agent_latitude: string | null;
  agent_longitude: string | null;
  client_city: string | null;
  client_region: string | null;
  client_country: string | null;
  agent_city: string | null;
  agent_region: string | null;
  agent_country: string | null;
  created_at: string;
}

async function backfillIPGeolocation() {
  console.log('🔄 Starting IP geolocation backfill for last 200 verification sessions...\n');

  try {
    // Fetch last 200 verification sessions that have IP addresses
    const { data: sessions, error: fetchError } = await supabase
      .from('verification_sessions')
      .select('id, client_ip_address, agent_ip_address, client_latitude, client_longitude, agent_latitude, agent_longitude, client_city, client_region, client_country, agent_city, agent_region, agent_country, created_at')
      .or('client_ip_address.not.is.null,agent_ip_address.not.is.null')
      .order('created_at', { ascending: false })
      .limit(200);

    if (fetchError) {
      console.error('❌ Error fetching sessions:', fetchError);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log('⚠️ No sessions found with IP addresses');
      return;
    }

    console.log(`📊 Found ${sessions.length} sessions to process\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i] as VerificationSession;
      console.log(`\n[${i + 1}/${sessions.length}] Processing session ${session.id}...`);

      let needsUpdate = false;
      const updateData: any = {};

      // Check and update client IP geolocation
      if (session.client_ip_address && session.client_ip_address !== 'unknown') {
        // Check if current location is Google HQ (likely incorrect)
        const currentLat = session.client_latitude ? parseFloat(session.client_latitude) : null;
        const currentLon = session.client_longitude ? parseFloat(session.client_longitude) : null;
        const isGoogleHQ = currentLat && currentLon && 
          Math.abs(currentLat - 37.4225) < 0.01 && 
          Math.abs(currentLon - (-122.0850)) < 0.01;

        // Also update if we have IP but no location data
        if (isGoogleHQ || !session.client_city || !session.client_region) {
          console.log(`   🔍 Re-fetching client geolocation for IP: ${session.client_ip_address}`);
          try {
            const clientLocationData = await getIPGeolocation(session.client_ip_address);
            
            if (clientLocationData) {
              console.log(`   ✅ Client location: ${clientLocationData.city}, ${clientLocationData.regionName}, ${clientLocationData.country}`);
              updateData.client_city = clientLocationData.city;
              updateData.client_region = clientLocationData.regionName;
              updateData.client_country = clientLocationData.country;
              // Only update lat/lon if we got new data (don't overwrite GPS coordinates)
              if (clientLocationData.lat && clientLocationData.lon && isGoogleHQ) {
                updateData.client_latitude = clientLocationData.lat.toString();
                updateData.client_longitude = clientLocationData.lon.toString();
              }
              needsUpdate = true;
            } else {
              console.log(`   ⚠️ No geolocation data returned for client IP`);
            }
          } catch (geoError) {
            console.error(`   ❌ Failed to fetch client geolocation:`, geoError);
            errors++;
          }
        } else {
          console.log(`   ✓ Client geolocation already accurate: ${session.client_city}, ${session.client_region}`);
        }
      }

      // Check and update agent IP geolocation
      if (session.agent_ip_address && session.agent_ip_address !== 'unknown') {
        // Check if current location is Google HQ (likely incorrect)
        const currentLat = session.agent_latitude ? parseFloat(session.agent_latitude) : null;
        const currentLon = session.agent_longitude ? parseFloat(session.agent_longitude) : null;
        const isGoogleHQ = currentLat && currentLon && 
          Math.abs(currentLat - 37.4225) < 0.01 && 
          Math.abs(currentLon - (-122.0850)) < 0.01;

        // Also update if we have IP but no location data
        if (isGoogleHQ || !session.agent_city || !session.agent_region) {
          console.log(`   🔍 Re-fetching agent geolocation for IP: ${session.agent_ip_address}`);
          try {
            const agentLocationData = await getIPGeolocation(session.agent_ip_address);
            
            if (agentLocationData) {
              console.log(`   ✅ Agent location: ${agentLocationData.city}, ${agentLocationData.regionName}, ${agentLocationData.country}`);
              updateData.agent_city = agentLocationData.city;
              updateData.agent_region = agentLocationData.regionName;
              updateData.agent_country = agentLocationData.country;
              // Only update lat/lon if we got new data (don't overwrite GPS coordinates)
              if (agentLocationData.lat && agentLocationData.lon && isGoogleHQ) {
                updateData.agent_latitude = agentLocationData.lat.toString();
                updateData.agent_longitude = agentLocationData.lon.toString();
              }
              needsUpdate = true;
            } else {
              console.log(`   ⚠️ No geolocation data returned for agent IP`);
            }
          } catch (geoError) {
            console.error(`   ❌ Failed to fetch agent geolocation:`, geoError);
            errors++;
          }
        } else {
          console.log(`   ✓ Agent geolocation already accurate: ${session.agent_city}, ${session.agent_region}`);
        }
      }

      // Update session if we have new data
      if (needsUpdate) {
        try {
          const { error: updateError } = await supabase
            .from('verification_sessions')
            .update(updateData)
            .eq('id', session.id);

          if (updateError) {
            console.error(`   ❌ Failed to update session:`, updateError);
            errors++;
          } else {
            console.log(`   💾 Updated session with accurate geolocation data`);
            updated++;
          }
        } catch (updateErr) {
          console.error(`   ❌ Error updating session:`, updateErr);
          errors++;
        }
      } else {
        skipped++;
      }

      // Rate limiting: Wait 200ms between requests to avoid hitting API limits
      if (i < sessions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`\n✅ Backfill completed!`);
    console.log(`   Updated: ${updated} sessions`);
    console.log(`   Skipped: ${skipped} sessions (already accurate)`);
    console.log(`   Errors: ${errors} sessions`);

  } catch (error) {
    console.error('❌ Fatal error during backfill:', error);
    process.exit(1);
  }
}

// Run the backfill
backfillIPGeolocation()
  .then(() => {
    console.log('\n✅ Backfill script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backfill script failed:', error);
    process.exit(1);
  });
