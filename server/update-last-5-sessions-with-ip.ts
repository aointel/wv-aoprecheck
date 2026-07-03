/**
 * Update Last 5 Verification Sessions with IP Info
 * 
 * Simply adds client and agent IP addresses to the last 5 verification sessions
 */

import { supabaseAdmin } from './supabase';

const TEST_CLIENT_IPS = [
  { ip: '192.168.1.100', country: 'US', region: 'California', city: 'Los Angeles', isp: 'AT&T', vpn: false },
  { ip: '203.0.113.45', country: 'US', region: 'Texas', city: 'Houston', isp: 'Comcast', vpn: false },
  { ip: '198.51.100.23', country: 'US', region: 'Florida', city: 'Miami', isp: 'Verizon', vpn: false },
  { ip: '45.67.89.123', country: 'MX', region: 'Jalisco', city: 'Guadalajara', isp: 'ExpressVPN', vpn: true },
  { ip: '185.220.101.45', country: 'US', region: 'New York', city: 'New York', isp: 'NordVPN', vpn: true },
];

const TEST_AGENT_IPS = [
  { ip: '10.0.0.50', country: 'US', region: 'California', city: 'San Francisco', isp: 'AT&T', vpn: false },
  { ip: '172.16.0.25', country: 'US', region: 'Nevada', city: 'Las Vegas', isp: 'Cox Communications', vpn: false },
  { ip: '192.0.2.100', country: 'US', region: 'Arizona', city: 'Phoenix', isp: 'CenturyLink', vpn: false },
  { ip: '198.18.0.45', country: 'US', region: 'Oregon', city: 'Portland', isp: 'Surfshark', vpn: true },
  { ip: '203.0.113.100', country: 'US', region: 'Washington', city: 'Seattle', isp: 'T-Mobile', vpn: false },
];

async function updateLast5SessionsWithIP() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    return;
  }

  try {
    console.log('🔍 Fetching last 5 verification sessions...\n');

    // Get last 5 sessions
    const { data: sessions, error } = await supabaseAdmin
      .from('verification_sessions')
      .select('id, session_id, first_name, last_name')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Error fetching sessions:', error);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log('❌ No sessions found');
      return;
    }

    console.log(`📋 Found ${sessions.length} sessions to update\n`);

    // Update each session with IP info
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const clientIp = TEST_CLIENT_IPS[i] || TEST_CLIENT_IPS[0];
      const agentIp = TEST_AGENT_IPS[i] || TEST_AGENT_IPS[0];

      const updateData: any = {
        // Client IP data
        client_ip_address: clientIp.ip,
        client_country: clientIp.country,
        client_region: clientIp.region,
        client_city: clientIp.city,
        client_latitude: i === 0 ? '34.0522' : i === 1 ? '29.7604' : i === 2 ? '25.7617' : i === 3 ? '32.7767' : '45.5152',
        client_longitude: i === 0 ? '-118.2437' : i === 1 ? '-95.3698' : i === 2 ? '-80.1918' : i === 3 ? '-96.7970' : '-122.6784',
        client_timezone: 'America/Los_Angeles',
        client_isp: clientIp.isp,
        client_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        client_is_vpn: clientIp.vpn,
        client_is_proxy: clientIp.vpn,
        client_is_hosting: false,
        client_vpn_detection_reason: clientIp.vpn ? `Detected VPN provider: ${clientIp.isp}` : null,
        
        // Agent IP data
        agent_ip_address: agentIp.ip,
        agent_country: agentIp.country,
        agent_region: agentIp.region,
        agent_city: agentIp.city,
        agent_latitude: i === 0 ? '37.7749' : i === 1 ? '36.1699' : i === 2 ? '33.4484' : i === 3 ? '45.5152' : '37.7749',
        agent_longitude: i === 0 ? '-122.4194' : i === 1 ? '-115.1398' : i === 2 ? '-112.0740' : i === 3 ? '-122.6784' : '-122.4194',
        agent_timezone: 'America/Los_Angeles',
        agent_isp: agentIp.isp,
        agent_user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        agent_is_vpn: agentIp.vpn,
        agent_is_proxy: agentIp.vpn,
        agent_is_hosting: false,
        agent_vpn_detection_reason: agentIp.vpn ? `Detected VPN provider: ${agentIp.isp}` : null,
        
        // IP Analysis
        ip_analysis: {
          distance_miles: Math.floor(Math.random() * 500) + 10,
          same_country: clientIp.country === agentIp.country,
          same_state: clientIp.region === agentIp.region,
          both_vpn: clientIp.vpn && agentIp.vpn,
          risk_score: clientIp.vpn || agentIp.vpn ? Math.floor(Math.random() * 40) + 60 : Math.floor(Math.random() * 20),
          flags: [
            ...(clientIp.vpn ? ['client_vpn_detected'] : []),
            ...(agentIp.vpn ? ['agent_vpn_detected'] : []),
            ...(clientIp.country !== 'US' ? ['client_non_us'] : []),
          ],
        },
        ip_flag_status: clientIp.vpn || agentIp.vpn ? (clientIp.vpn && agentIp.vpn ? 'critical' : 'flagged') : 'valid',
        ip_flag_reason: clientIp.vpn || agentIp.vpn 
          ? `${clientIp.vpn ? 'Client' : 'Agent'} using VPN detected`
          : 'IP addresses appear valid',
      };

      const { error: updateError } = await supabaseAdmin
        .from('verification_sessions')
        .update(updateData)
        .eq('id', session.id);

      if (updateError) {
        console.error(`❌ Error updating session ${session.session_id}:`, updateError);
      } else {
        console.log(`✅ Updated: ${session.first_name} ${session.last_name} (${session.session_id})`);
        console.log(`   Client IP: ${clientIp.ip} (${clientIp.city}, ${clientIp.country}) ${clientIp.vpn ? '🔒 VPN' : ''}`);
        console.log(`   Agent IP: ${agentIp.ip} (${agentIp.city}, ${agentIp.country}) ${agentIp.vpn ? '🔒 VPN' : ''}\n`);
      }
    }

    console.log('✅ Done! Updated last 5 sessions with IP data');

  } catch (error) {
    console.error('❌ Error updating sessions:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('update-last-5-sessions-with-ip.ts')) {
  updateLast5SessionsWithIP()
    .then(() => {
      console.log('\n✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { updateLast5SessionsWithIP };


