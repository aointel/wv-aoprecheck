/**
 * Check Verification Sessions IP Addresses
 * 
 * This script checks the current state of IP addresses in verification sessions
 * to identify any issues or anomalies.
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './hardcoded-config.js';

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
  ip_flag_status: string | null;
  ip_flag_reason: string | null;
  created_at: string;
}

async function checkVerificationIPAddresses() {
  console.log('🔍 Checking verification sessions IP addresses...\n');

  try {
    // Fetch last 50 verification sessions
    const { data: sessions, error: fetchError } = await supabase
      .from('verification_sessions')
      .select('id, client_ip_address, agent_ip_address, client_latitude, client_longitude, agent_latitude, agent_longitude, client_city, client_region, client_country, agent_city, agent_region, agent_country, ip_flag_status, ip_flag_reason, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (fetchError) {
      console.error('❌ Error fetching sessions:', fetchError);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log('⚠️ No sessions found');
      return;
    }

    console.log(`📊 Found ${sessions.length} sessions to check\n`);

    // Statistics
    let sessionsWithClientIP = 0;
    let sessionsWithAgentIP = 0;
    let sessionsWithBothIPs = 0;
    let sessionsWithNoIPs = 0;
    let sessionsWithGoogleHQ = 0;
    let sessionsWithMissingLocation = 0;
    let sessionsWithNullIPs = 0;
    let sessionsWithUnknownIPs = 0;

    const googleHQCoords = { lat: 37.4225, lon: -122.0850 };
    const googleHQTolerance = 0.01;

    console.log('📋 Session Details:\n');
    console.log('='.repeat(100));

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i] as VerificationSession;
      
      const hasClientIP = session.client_ip_address && session.client_ip_address !== 'unknown' && session.client_ip_address !== 'null';
      const hasAgentIP = session.agent_ip_address && session.agent_ip_address !== 'unknown' && session.agent_ip_address !== 'null';
      
      if (hasClientIP) sessionsWithClientIP++;
      if (hasAgentIP) sessionsWithAgentIP++;
      if (hasClientIP && hasAgentIP) sessionsWithBothIPs++;
      if (!hasClientIP && !hasAgentIP) sessionsWithNoIPs++;
      
      if (session.client_ip_address === null || session.agent_ip_address === null) sessionsWithNullIPs++;
      if (session.client_ip_address === 'unknown' || session.agent_ip_address === 'unknown') sessionsWithUnknownIPs++;

      // Check for Google HQ coordinates
      const clientLat = session.client_latitude ? parseFloat(session.client_latitude) : null;
      const clientLon = session.client_longitude ? parseFloat(session.client_longitude) : null;
      const agentLat = session.agent_latitude ? parseFloat(session.agent_latitude) : null;
      const agentLon = session.agent_longitude ? parseFloat(session.agent_longitude) : null;

      const isClientGoogleHQ = clientLat && clientLon && 
        Math.abs(clientLat - googleHQCoords.lat) < googleHQTolerance && 
        Math.abs(clientLon - googleHQCoords.lon) < googleHQTolerance;
      
      const isAgentGoogleHQ = agentLat && agentLon && 
        Math.abs(agentLat - googleHQCoords.lat) < googleHQTolerance && 
        Math.abs(agentLon - googleHQCoords.lon) < googleHQTolerance;

      if (isClientGoogleHQ || isAgentGoogleHQ) {
        sessionsWithGoogleHQ++;
      }

      // Check for missing location data
      const clientHasIPButNoLocation = hasClientIP && (!session.client_city || !session.client_region);
      const agentHasIPButNoLocation = hasAgentIP && (!session.agent_city || !session.agent_region);
      
      if (clientHasIPButNoLocation || agentHasIPButNoLocation) {
        sessionsWithMissingLocation++;
      }

      // Display session details
      const sessionIdStr = String(session.id);
      console.log(`\n[${i + 1}] Session ${sessionIdStr.length > 8 ? sessionIdStr.substring(0, 8) + '...' : sessionIdStr} (${new Date(session.created_at).toLocaleDateString()})`);
      console.log(`   Client IP: ${session.client_ip_address || 'NULL'} | Agent IP: ${session.agent_ip_address || 'NULL'}`);
      
      if (hasClientIP) {
        console.log(`   Client Location: ${session.client_city || 'N/A'}, ${session.client_region || 'N/A'}, ${session.client_country || 'N/A'}`);
        if (clientLat && clientLon) {
          console.log(`   Client Coords: ${clientLat}, ${clientLon}${isClientGoogleHQ ? ' ⚠️ GOOGLE HQ' : ''}`);
        }
      }
      
      if (hasAgentIP) {
        console.log(`   Agent Location: ${session.agent_city || 'N/A'}, ${session.agent_region || 'N/A'}, ${session.agent_country || 'N/A'}`);
        if (agentLat && agentLon) {
          console.log(`   Agent Coords: ${agentLat}, ${agentLon}${isAgentGoogleHQ ? ' ⚠️ GOOGLE HQ' : ''}`);
        }
      }

      if (session.ip_flag_status) {
        console.log(`   IP Flag: ${session.ip_flag_status} - ${session.ip_flag_reason?.substring(0, 60) || 'N/A'}...`);
      }

      if (clientHasIPButNoLocation || agentHasIPButNoLocation) {
        console.log(`   ⚠️ WARNING: Has IP but missing location data`);
      }
    }

    console.log('\n' + '='.repeat(100));
    console.log('\n📊 Summary Statistics:\n');
    console.log(`   Total sessions checked: ${sessions.length}`);
    console.log(`   Sessions with client IP: ${sessionsWithClientIP} (${((sessionsWithClientIP / sessions.length) * 100).toFixed(1)}%)`);
    console.log(`   Sessions with agent IP: ${sessionsWithAgentIP} (${((sessionsWithAgentIP / sessions.length) * 100).toFixed(1)}%)`);
    console.log(`   Sessions with both IPs: ${sessionsWithBothIPs} (${((sessionsWithBothIPs / sessions.length) * 100).toFixed(1)}%)`);
    console.log(`   Sessions with no IPs: ${sessionsWithNoIPs} (${((sessionsWithNoIPs / sessions.length) * 100).toFixed(1)}%)`);
    console.log(`   Sessions with NULL IPs: ${sessionsWithNullIPs}`);
    console.log(`   Sessions with 'unknown' IPs: ${sessionsWithUnknownIPs}`);
    console.log(`   Sessions with Google HQ coordinates: ${sessionsWithGoogleHQ} ⚠️`);
    console.log(`   Sessions with IP but missing location: ${sessionsWithMissingLocation} ⚠️`);

    // Check for specific issues
    console.log('\n🔍 Issue Analysis:\n');
    
    if (sessionsWithGoogleHQ > 0) {
      console.log(`   ⚠️ ${sessionsWithGoogleHQ} sessions have Google HQ coordinates (likely incorrect)`);
    }
    
    if (sessionsWithMissingLocation > 0) {
      console.log(`   ⚠️ ${sessionsWithMissingLocation} sessions have IP addresses but missing city/region data`);
    }
    
    if (sessionsWithNullIPs > 0) {
      console.log(`   ⚠️ ${sessionsWithNullIPs} sessions have NULL IP addresses`);
    }
    
    if (sessionsWithUnknownIPs > 0) {
      console.log(`   ⚠️ ${sessionsWithUnknownIPs} sessions have 'unknown' IP addresses`);
    }

    if (sessionsWithGoogleHQ === 0 && sessionsWithMissingLocation === 0 && sessionsWithNullIPs === 0 && sessionsWithUnknownIPs === 0) {
      console.log('   ✅ No issues detected!');
    }

  } catch (error) {
    console.error('❌ Fatal error during check:', error);
    process.exit(1);
  }
}

// Run the check
checkVerificationIPAddresses()
  .then(() => {
    console.log('\n✅ Check completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });

