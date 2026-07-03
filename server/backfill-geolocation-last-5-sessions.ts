/**
 * Backfill Geolocation Data for Last 5 Sessions
 * 
 * This script fetches the last 5 verification sessions and fills in
 * geolocation data (latitude/longitude) from IP addresses if missing.
 */

import { supabaseAdmin } from './supabase.js';
import { getIPGeolocation, type LocationData } from './ip-analysis-service.js';

async function backfillGeolocationForLast5Sessions() {
  console.log('🔄 Starting geolocation backfill for last 5 sessions...\n');

  try {
    // Get the last 5 verification sessions ordered by created_at DESC
    const { data: sessions, error: fetchError } = await supabaseAdmin
      .from('verification_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (fetchError) {
      console.error('❌ Error fetching sessions:', fetchError);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log('ℹ️ No sessions found');
      return;
    }

    console.log(`📋 Found ${sessions.length} sessions to process\n`);

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      console.log(`\n[${i + 1}/${sessions.length}] Processing session: ${session.session_id}`);
      console.log(`   Created: ${session.created_at}`);
      console.log(`   Client: ${session.first_name} ${session.last_name}`);

      let updated = false;
      const updateData: any = {};

      // Check and update client geolocation
      if (session.client_ip_address && (!session.client_latitude || !session.client_longitude)) {
        console.log(`   🔍 Fetching client geolocation for IP: ${session.client_ip_address}`);
        try {
          const clientLocationData = await getIPGeolocation(session.client_ip_address);
          if (clientLocationData && clientLocationData.lat && clientLocationData.lon) {
            updateData.client_latitude = clientLocationData.lat.toString();
            updateData.client_longitude = clientLocationData.lon.toString();
            updateData.client_country = clientLocationData.country || session.client_country;
            updateData.client_region = clientLocationData.regionName || session.client_region;
            updateData.client_city = clientLocationData.city || session.client_city;
            updateData.client_timezone = clientLocationData.timezone || session.client_timezone;
            updateData.client_isp = clientLocationData.isp || session.client_isp;
            updated = true;
            console.log(`   ✅ Client geolocation: ${clientLocationData.lat}, ${clientLocationData.lon}`);
            console.log(`      Location: ${clientLocationData.city || 'N/A'}, ${clientLocationData.regionName || 'N/A'}, ${clientLocationData.country || 'N/A'}`);
          } else {
            console.log(`   ⚠️ No geolocation data returned for client IP`);
          }
        } catch (geoError) {
          console.error(`   ❌ Failed to fetch client geolocation:`, geoError);
        }
      } else if (session.client_latitude && session.client_longitude) {
        console.log(`   ✓ Client geolocation already exists: ${session.client_latitude}, ${session.client_longitude}`);
      } else if (!session.client_ip_address) {
        console.log(`   ⚠️ No client IP address available`);
      }

      // Check and update agent geolocation
      if (session.agent_ip_address && (!session.agent_latitude || !session.agent_longitude)) {
        console.log(`   🔍 Fetching agent geolocation for IP: ${session.agent_ip_address}`);
        try {
          const agentLocationData = await getIPGeolocation(session.agent_ip_address);
          if (agentLocationData && agentLocationData.lat && agentLocationData.lon) {
            updateData.agent_latitude = agentLocationData.lat.toString();
            updateData.agent_longitude = agentLocationData.lon.toString();
            updateData.agent_country = agentLocationData.country || session.agent_country;
            updateData.agent_region = agentLocationData.regionName || session.agent_region;
            updateData.agent_city = agentLocationData.city || session.agent_city;
            updateData.agent_timezone = agentLocationData.timezone || session.agent_timezone;
            updateData.agent_isp = agentLocationData.isp || session.agent_isp;
            updated = true;
            console.log(`   ✅ Agent geolocation: ${agentLocationData.lat}, ${agentLocationData.lon}`);
            console.log(`      Location: ${agentLocationData.city || 'N/A'}, ${agentLocationData.regionName || 'N/A'}, ${agentLocationData.country || 'N/A'}`);
          } else {
            console.log(`   ⚠️ No geolocation data returned for agent IP`);
          }
        } catch (geoError) {
          console.error(`   ❌ Failed to fetch agent geolocation:`, geoError);
        }
      } else if (session.agent_latitude && session.agent_longitude) {
        console.log(`   ✓ Agent geolocation already exists: ${session.agent_latitude}, ${session.agent_longitude}`);
      } else if (!session.agent_ip_address) {
        console.log(`   ⚠️ No agent IP address available`);
      }

      // Update session if we have new data
      if (updated) {
        console.log(`   💾 Updating session with geolocation data...`);
        const { error: updateError } = await supabaseAdmin
          .from('verification_sessions')
          .update(updateData)
          .eq('session_id', session.session_id);

        if (updateError) {
          console.error(`   ❌ Failed to update session:`, updateError);
        } else {
          console.log(`   ✅ Session updated successfully`);
        }
      } else {
        console.log(`   ℹ️ No updates needed for this session`);
      }
    }

    console.log(`\n✅ Geolocation backfill completed for ${sessions.length} sessions`);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
backfillGeolocationForLast5Sessions()
  .then(() => {
    console.log('\n✨ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

