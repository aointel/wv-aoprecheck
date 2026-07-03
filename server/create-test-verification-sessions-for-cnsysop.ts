/**
 * Create Test Verification Sessions for cnsysop
 * 
 * Inserts test verification sessions with client and agent IP addresses
 * so we can test IP data display and analysis
 */

import { supabaseAdmin } from './supabase';
import { randomUUID } from 'crypto';

// Sample IP addresses for testing (mix of different locations and VPN/non-VPN)
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

// Sample names and data
const SAMPLE_NAMES = [
  { first: 'John', last: 'Smith', phone: '+15551234567', city: 'Los Angeles', state: 'CA', premium: '$125.50' },
  { first: 'Maria', last: 'Garcia', phone: '+15559876543', city: 'Houston', state: 'TX', premium: '$89.99' },
  { first: 'Robert', last: 'Johnson', phone: '+15555551234', city: 'Miami', state: 'FL', premium: '$156.75' },
  { first: 'Sarah', last: 'Williams', phone: '+15554448888', city: 'Phoenix', state: 'AZ', premium: '$98.25' },
  { first: 'Michael', last: 'Brown', phone: '+15553336666', city: 'Portland', state: 'OR', premium: '$142.00' },
];

async function getRecentSessionAsTemplate() {
  if (!supabaseAdmin) return null;

  try {
    // Get a recent session to use as template
    const { data, error } = await supabaseAdmin
      .from('verification_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.log('⚠️ No recent session found to use as template, using defaults');
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Error fetching template session:', error);
    return null;
  }
}

async function createTestSessions() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    return;
  }

  try {
    console.log('🔍 Fetching recent session as template...');
    const template = await getRecentSessionAsTemplate();

    console.log('📝 Creating test verification sessions for cnsysop...\n');

    // Get cnsysop's associate_id from customers or user_credits
    const { data: cnsysopData } = await supabaseAdmin
      .from('customers')
      .select('associate_id, first_name, last_name, company_email')
      .ilike('company_email', 'cnsysop%')
      .limit(1)
      .maybeSingle();

    const associateId = cnsysopData?.associate_id || null;
    const agentFirstName = cnsysopData?.first_name || 'CN';
    const agentLastName = cnsysopData?.last_name || 'SysOp';
    const agentEmail = cnsysopData?.company_email || 'cnsysop@aoglobelife.com';

    console.log(`👤 Found cnsysop: ${agentEmail}, Associate ID: ${associateId || 'N/A'}\n`);

    const sessions = [];

    // Create 5 test sessions with different IP combinations
    for (let i = 0; i < 5; i++) {
      const sample = SAMPLE_NAMES[i];
      const clientIp = TEST_CLIENT_IPS[i] || TEST_CLIENT_IPS[0];
      const agentIp = TEST_AGENT_IPS[i] || TEST_AGENT_IPS[0];

      const sessionId = `test-${randomUUID()}`;
      const now = new Date();
      const sessionDate = new Date(now);
      sessionDate.setDate(now.getDate() - (i + 1)); // Stagger dates

      // Start with template data if available, then override with our test data
      const session: any = template ? { ...template } : {};
      
      // Override with our test data
      session.session_id = sessionId;
      session.first_name = sample.first;
      session.last_name = sample.last;
      session.phone = sample.phone;
      session.agent_phone = '+15550001234'; // cnsysop's test phone
      session.agent_first_name = agentFirstName;
      session.agent_last_name = agentLastName;
      session.associate_id = associateId;
      session.agent_email = agentEmail; // Required for filtering sessions by agent
      session.company_email = agentEmail; // Also check company_email field
      session.city = sample.city;
      session.state = sample.state;
      session.premium = sample.premium;
      session.verification_method = i % 2 === 0 ? 'zoom' : 'phone';
      session.language = template?.language || 'en';
      session.status = i < 3 ? 'completed' : 'pending'; // Mix of statuses
      session.session_type = template?.session_type || 'live';
      
      // Client IP data
      session.client_ip_address = clientIp.ip;
      session.client_country = clientIp.country;
      session.client_region = clientIp.region;
      session.client_city = clientIp.city;
      session.client_latitude = i === 0 ? '34.0522' : i === 1 ? '29.7604' : i === 2 ? '25.7617' : i === 3 ? '32.7767' : '45.5152';
      session.client_longitude = i === 0 ? '-118.2437' : i === 1 ? '-95.3698' : i === 2 ? '-80.1918' : i === 3 ? '-96.7970' : '-122.6784';
      session.client_timezone = 'America/Los_Angeles';
      session.client_isp = clientIp.isp;
      session.client_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      session.client_is_vpn = clientIp.vpn;
      session.client_is_proxy = clientIp.vpn;
      session.client_is_hosting = false;
      session.client_vpn_detection_reason = clientIp.vpn ? `Detected VPN provider: ${clientIp.isp}` : null;
      
      // Agent IP data
      session.agent_ip_address = agentIp.ip;
      session.agent_country = agentIp.country;
      session.agent_region = agentIp.region;
      session.agent_city = agentIp.city;
      session.agent_latitude = i === 0 ? '37.7749' : i === 1 ? '36.1699' : i === 2 ? '33.4484' : i === 3 ? '45.5152' : '37.7749';
      session.agent_longitude = i === 0 ? '-122.4194' : i === 1 ? '-115.1398' : i === 2 ? '-112.0740' : i === 3 ? '-122.6784' : '-122.4194';
      session.agent_timezone = 'America/Los_Angeles';
      session.agent_isp = agentIp.isp;
      session.agent_user_agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
      session.agent_is_vpn = agentIp.vpn;
      session.agent_is_proxy = agentIp.vpn;
      session.agent_is_hosting = false;
      session.agent_vpn_detection_reason = agentIp.vpn ? `Detected VPN provider: ${agentIp.isp}` : null;
      
      // IP Analysis (populate if both IPs are present)
      session.ip_analysis = {
        distance_miles: Math.floor(Math.random() * 500) + 10, // Random distance 10-510 miles
        same_country: clientIp.country === agentIp.country,
        same_state: clientIp.region === agentIp.region,
        both_vpn: clientIp.vpn && agentIp.vpn,
        risk_score: clientIp.vpn || agentIp.vpn ? Math.floor(Math.random() * 40) + 60 : Math.floor(Math.random() * 20),
        flags: [
          ...(clientIp.vpn ? ['client_vpn_detected'] : []),
          ...(agentIp.vpn ? ['agent_vpn_detected'] : []),
          ...(clientIp.country !== 'US' ? ['client_non_us'] : []),
        ],
      };
      session.ip_flag_status = clientIp.vpn || agentIp.vpn ? (clientIp.vpn && agentIp.vpn ? 'critical' : 'flagged') : 'valid';
      session.ip_flag_reason = clientIp.vpn || agentIp.vpn 
        ? `${clientIp.vpn ? 'Client' : 'Agent'} using VPN detected`
        : 'IP addresses appear valid';
      
      // Remove fields that shouldn't be copied (id, timestamps will be new)
      delete session.id;
      delete session.created_at;
      delete session.completed_at;
      delete session.updated_at;
      
      // Set new dates
      session.created_at = sessionDate.toISOString();
      if (i < 3) {
        session.completed_at = new Date(sessionDate.getTime() + 30 * 60000).toISOString();
        session.call_completed = true;
      } else {
        session.completed_at = null;
        session.call_completed = false;
      }
      
      // Taalk data - copy from template if available, otherwise use defaults
      if (template?.taalk_call_id) {
        session.taalk_call_id = `test-${template.taalk_call_id}-${i + 1}`;
      } else {
        session.taalk_call_id = `test-call-${i + 1}`;
      }
      session.taalk_call_status = i < 3 ? 'completed' : 'initiated';
      
      // Ensure required fields have defaults if template didn't have them
      if (!session.zoom_room_id && session.verification_method === 'zoom') {
        session.zoom_room_id = `test-room-${i + 1}`;
      }
      if (!session.zoom_password && session.verification_method === 'zoom') {
        session.zoom_password = 'test123';
      }

      sessions.push(session);
    }

    // Insert all sessions
    console.log('📤 Inserting test sessions...\n');
    const { data: inserted, error } = await supabaseAdmin
      .from('verification_sessions')
      .insert(sessions)
      .select('id, session_id, first_name, last_name, client_ip_address, agent_ip_address');

    if (error) {
      console.error('❌ Error inserting test sessions:', error);
      return;
    }

    console.log(`✅ Successfully created ${inserted?.length || 0} test verification sessions:\n`);
    
    inserted?.forEach((session, i) => {
      const clientIp = TEST_CLIENT_IPS[i] || TEST_CLIENT_IPS[0];
      const agentIp = TEST_AGENT_IPS[i] || TEST_AGENT_IPS[TEST_AGENT_IPS.length - 1];
      console.log(`  ${i + 1}. ${session.first_name} ${session.last_name}`);
      console.log(`     Session ID: ${session.session_id}`);
      console.log(`     Client IP: ${session.client_ip_address} (${clientIp.city}, ${clientIp.country}) ${clientIp.vpn ? '🔒 VPN' : ''}`);
      console.log(`     Agent IP: ${session.agent_ip_address} (${agentIp.city}, ${agentIp.country}) ${agentIp.vpn ? '🔒 VPN' : ''}`);
      console.log('');
    });

    console.log('✅ Test sessions created successfully!');
    console.log('💡 These sessions can now be viewed in AOI Precheck Admin to test IP data display');

  } catch (error) {
    console.error('❌ Error creating test sessions:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('create-test-verification-sessions-for-cnsysop.ts')) {
  createTestSessions()
    .then(() => {
      console.log('\n✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { createTestSessions };

