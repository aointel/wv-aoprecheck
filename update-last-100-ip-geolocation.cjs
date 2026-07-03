// Update last 100 verification sessions with ipinfo.io geolocation data
// Re-fetches IP geolocation using ipinfo.io only (removed ip-api.com fallback)

const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Import IPINFO_API_KEY from hardcoded-config
let IPINFO_API_KEY;
try {
  const config = require('./server/hardcoded-config.js');
  IPINFO_API_KEY = config.IPINFO_API_KEY;
} catch (e) {
  console.error('❌ Failed to load IPINFO_API_KEY from hardcoded-config.js');
  console.error('   Make sure the file exists and exports IPINFO_API_KEY');
  process.exit(1);
}

/**
 * Fetch IP geolocation using ipinfo.io ONLY
 */
async function getIPGeolocation(ip) {
  if (!ip || ip === 'unknown' || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(
      `https://ipinfo.io/${ip}?token=${IPINFO_API_KEY}`,
      { signal: controller.signal }
    );
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      
      if (data && !data.error && data.country) {
        // Parse coordinates from "lat,lon" format
        let lat = null;
        let lon = null;
        if (data.loc) {
          const [latStr, lonStr] = data.loc.split(',');
          lat = parseFloat(latStr);
          lon = parseFloat(lonStr);
          if (isNaN(lat) || isNaN(lon)) {
            lat = null;
            lon = null;
          }
        }
        
        // Detect VPN from ISP name
        const isp = data.org || data.asn?.name || null;
        const isVpn = data.is_anonymous || data.is_hosting || detectVpnFromIsp(isp);
        const isProxy = data.is_anonymous || false;
        const isHosting = data.is_hosting || false;
        
        let vpnReason = '';
        if (data.is_anonymous) {
          vpnReason = 'IP flagged as anonymous/proxy by ipinfo.io';
        } else if (data.is_hosting) {
          vpnReason = 'IP flagged as hosting/datacenter by ipinfo.io';
        } else if (detectVpnFromIsp(isp)) {
          vpnReason = `ISP name contains VPN indicator`;
        }
        
        return {
          country: data.country || null,
          region: data.region || null,
          city: data.city || null,
          lat: lat,
          lon: lon,
          timezone: data.timezone || null,
          isp: isp,
          isVpn: isVpn,
          isProxy: isProxy,
          isHosting: isHosting,
          vpnDetectionReason: vpnReason || null,
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Error fetching geolocation for ${ip}:`, error.message);
    return null;
  }
}

/**
 * Detect VPN from ISP name
 */
function detectVpnFromIsp(isp) {
  if (!isp) return false;
  
  const ispLower = isp.toLowerCase();
  const vpnKeywords = [
    'vpn', 'proxy', 'hosting', 'datacenter', 'data center', 'server', 'cloud',
    'aws', 'azure', 'gcp', 'google cloud', 'amazon', 'digitalocean', 'linode',
    'vultr', 'ovh', 'hetzner', 'contabo', 'leaseweb', 'ramnode', 'buyvm',
    'nordvpn', 'expressvpn', 'surfshark', 'cyberghost', 'private internet access',
    'ipvanish', 'protonvpn', 'tunnelbear', 'windscribe', 'mullvad', 'hide.me',
    'tor', 'tor network', 'onion', 'anonymous', 'privacy', 'anonymizer'
  ];
  
  return vpnKeywords.some(keyword => ispLower.includes(keyword));
}

/**
 * Update IP geolocation for a session
 */
async function updateSessionIP(session) {
  const updates = {};
  let updated = false;
  
  // Update client IP geolocation
  if (session.client_ip_address) {
    const clientGeo = await getIPGeolocation(session.client_ip_address);
    if (clientGeo) {
      updates.client_country = clientGeo.country;
      updates.client_region = clientGeo.region;
      updates.client_city = clientGeo.city;
      if (clientGeo.lat) updates.client_latitude = clientGeo.lat.toString();
      if (clientGeo.lon) updates.client_longitude = clientGeo.lon.toString();
      updates.client_timezone = clientGeo.timezone;
      updates.client_isp = clientGeo.isp;
      // GPS overrides IP-based VPN detection - only save VPN if GPS not available
      updates.client_is_vpn = (clientGeo.isVpn && !session.client_latitude) || false;
      updates.client_is_proxy = clientGeo.isProxy || false;
      updates.client_is_hosting = clientGeo.isHosting || false;
      updates.client_vpn_detection_reason = (clientGeo.isVpn && !session.client_latitude) ? clientGeo.vpnDetectionReason : null;
      updated = true;
      
      console.log(`  ✅ Client IP ${session.client_ip_address}: ${clientGeo.city || 'unknown'}, ${clientGeo.region || 'unknown'}`);
      if (clientGeo.isVpn) {
        console.log(`     🚩 VPN detected: ${clientGeo.vpnDetectionReason || 'detected'}`);
      }
    } else {
      console.log(`  ⚠️  Client IP ${session.client_ip_address}: Failed to fetch geolocation`);
    }
    
    // Rate limiting: Wait 1 second between API calls
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Update agent IP geolocation
  if (session.agent_ip_address) {
    const agentGeo = await getIPGeolocation(session.agent_ip_address);
    if (agentGeo) {
      updates.agent_country = agentGeo.country;
      updates.agent_region = agentGeo.region;
      updates.agent_city = agentGeo.city;
      if (agentGeo.lat) updates.agent_latitude = agentGeo.lat.toString();
      if (agentGeo.lon) updates.agent_longitude = agentGeo.lon.toString();
      updates.agent_timezone = agentGeo.timezone;
      updates.agent_isp = agentGeo.isp;
      // GPS overrides IP-based VPN detection - only save VPN if GPS not available
      updates.agent_is_vpn = (agentGeo.isVpn && !session.agent_latitude) || false;
      updates.agent_is_proxy = agentGeo.isProxy || false;
      updates.agent_is_hosting = agentGeo.isHosting || false;
      updates.agent_vpn_detection_reason = (agentGeo.isVpn && !session.agent_latitude) ? agentGeo.vpnDetectionReason : null;
      updated = true;
      
      console.log(`  ✅ Agent IP ${session.agent_ip_address}: ${agentGeo.city || 'unknown'}, ${agentGeo.region || 'unknown'}`);
      if (agentGeo.isVpn) {
        console.log(`     🚩 VPN detected: ${agentGeo.vpnDetectionReason || 'detected'}`);
      }
    } else {
      console.log(`  ⚠️  Agent IP ${session.agent_ip_address}: Failed to fetch geolocation`);
    }
    
    // Rate limiting: Wait 1 second between API calls
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Update database if we have updates
  if (updated) {
    const { error } = await supabase
      .from('verification_sessions')
      .update(updates)
      .eq('id', session.id);
    
    if (error) {
      console.error(`  ❌ Failed to update session ${session.id}:`, error);
      return false;
    }
    
    return true;
  }
  
  return false;
}

/**
 * Main function
 */
async function main() {
  console.log('\n🔄 Updating last 100 verification sessions with ipinfo.io geolocation...\n');
  console.log('='.repeat(60));
  
  try {
    // Get last 100 sessions with IP addresses
    const { data: sessions, error } = await supabase
      .from('verification_sessions')
      .select('id, client_ip_address, agent_ip_address, client_name, agent_email, created_at')
      .or('client_ip_address.not.is.null,agent_ip_address.not.is.null')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error('❌ Error fetching sessions:', error);
      return;
    }
    
    if (!sessions || sessions.length === 0) {
      console.log('⚠️  No sessions found with IP addresses');
      return;
    }
    
    console.log(`\n📊 Found ${sessions.length} sessions to update\n`);
    
    let updated = 0;
    let failed = 0;
    let skipped = 0;
    
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      console.log(`\n[${i + 1}/${sessions.length}] Session ${session.id}`);
      console.log(`   Client: ${session.client_name || 'unknown'}`);
      console.log(`   Agent: ${session.agent_email || 'unknown'}`);
      
      const success = await updateSessionIP(session);
      
      if (success) {
        updated++;
      } else if (!session.client_ip_address && !session.agent_ip_address) {
        skipped++;
        console.log(`   ⏭️  Skipped - no IP addresses`);
      } else {
        failed++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Update complete!');
    console.log(`   Updated: ${updated} sessions`);
    console.log(`   Failed: ${failed} sessions`);
    console.log(`   Skipped: ${skipped} sessions`);
    console.log(`   Total: ${sessions.length} sessions\n`);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
