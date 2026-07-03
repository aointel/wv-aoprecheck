/**
 * IP Analysis Service for AO Precheck
 * Compares agent and client IP addresses/locations to detect potential fraud
 * 
 * Since agents do Zoom presentations, they should NOT be in the same location as the client.
 * If they are, it's suspicious and could indicate fraud (agent pretending to be client).
 */

export interface IPAnalysisResult {
  isValid: boolean;
  flagStatus: 'valid' | 'flagged' | 'suspicious' | 'critical' | 'pending';
  confidence: number; // 0-1
  reason: string;
  details: {
    sameIp: boolean;
    sameCity: boolean;
    sameRegion: boolean;
    sameCountry: boolean;
    distanceMiles: number | null;
    agentLocation: string | null;
    clientLocation: string | null;
    agentVpn: boolean | null;
    clientVpn: boolean | null;
  };
}

export interface LocationData {
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: string | null;
  longitude: string | null;
  isp: string | null;
  timezone: string | null;
  isVpn?: boolean | null;
  isProxy?: boolean | null;
  isHosting?: boolean | null;
  vpnDetectionReason?: string | null;
}

/**
 * Calculate distance between two coordinates in miles using Haversine formula
 */
export function calculateDistanceMiles(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * State abbreviation to full name mapping
 */
const STATE_ABBREVIATIONS: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming'
};

/**
 * Normalize state name/abbreviation for comparison
 */
function normalizeState(state: string | null | undefined): string | null {
  if (!state) return null;
  const normalized = state.trim();
  const upper = normalized.toUpperCase();
  
  // If it's an abbreviation, return full name
  if (STATE_ABBREVIATIONS[upper]) {
    return STATE_ABBREVIATIONS[upper];
  }
  
  // If it's already a full name, return as-is (normalized)
  const fullName = Object.values(STATE_ABBREVIATIONS).find(
    name => name.toLowerCase() === normalized.toLowerCase()
  );
  
  return fullName || normalized;
}

/**
 * Analyze IP addresses and locations for agent and client
 * Returns flag status based on proximity, VPN, New York location, and state mismatch
 * 
 * Flagging rules:
 * 1. Red flag if client IP is in New York (cannot accept business from NY)
 * 2. Red flag if VPN detected (client or agent)
 * 3. Red flag if client IP location doesn't match declared state
 */
export function analyzeIPAddresses(
  agentData: LocationData,
  clientData: LocationData,
  declaredState?: string | null, // The state declared in the session (session.state)
  options?: {
    agentGeolocationDenied?: boolean;
    clientGeolocationDenied?: boolean;
  }
): IPAnalysisResult {
  // Check if geolocation was denied (has IP but no GPS coordinates)
  // NOTE: Missing geolocation is NOT a red flag - IP-based location is sufficient if IPs look good
  const hasAgentGps = !!(agentData.latitude && agentData.longitude);
  const hasClientGps = !!(clientData.latitude && clientData.longitude);
  const agentDenied = (options?.agentGeolocationDenied && !hasAgentGps) || (agentData.ip && !hasAgentGps);
  const clientDenied = (options?.clientGeolocationDenied && !hasClientGps) || (clientData.ip && !hasClientGps);
  const geolocationNote = agentDenied || clientDenied 
    ? (agentDenied && clientDenied 
        ? ' (Note: Using IP-based location - device geolocation not available)'
        : agentDenied 
          ? ' (Note: Agent using IP-based location - device geolocation not available)'
          : ' (Note: Client using IP-based location - device geolocation not available)')
    : '';
  
  // If either IP is missing, return pending
  if (!agentData.ip || !clientData.ip) {
    const missing = !agentData.ip && !clientData.ip 
      ? 'both agent and client IPs' 
      : !agentData.ip 
        ? 'agent IP' 
        : 'client IP';
    
    return {
      isValid: true, // Don't flag as invalid, just pending
      flagStatus: 'pending',
      confidence: 0,
      reason: `Cannot analyze - ${missing} not captured`,
      details: {
        sameIp: false,
        sameCity: false,
        sameRegion: false,
        sameCountry: false,
        distanceMiles: null,
        agentLocation: agentData.city ? `${agentData.city}, ${agentData.region}` : null,
        clientLocation: clientData.city ? `${clientData.city}, ${clientData.region}` : null,
        agentVpn: agentData.isVpn || false,
        clientVpn: clientData.isVpn || false,
      }
    };
  }

  // Normalize IPs for comparison
  const agentIp = agentData.ip.trim().toLowerCase();
  const clientIp = clientData.ip.trim().toLowerCase();
  
  // Check for same IP address - CRITICAL FLAG
  const sameIp = agentIp === clientIp;
  
  // Check for suspicious default locations (Google HQ, etc.)
  const GOOGLE_HQ_LAT = 37.4225;
  const GOOGLE_HQ_LON = -122.0850;
  const GOOGLE_HQ_TOLERANCE = 0.01; // ~1km tolerance
  
  const isGoogleHQ = (lat: string | number | null | undefined, lon: string | number | null | undefined): boolean => {
    if (!lat || !lon) return false;
    const latNum = typeof lat === 'string' ? parseFloat(lat) : lat;
    const lonNum = typeof lon === 'string' ? parseFloat(lon) : lon;
    if (isNaN(latNum) || isNaN(lonNum)) return false;
    return Math.abs(latNum - GOOGLE_HQ_LAT) < GOOGLE_HQ_TOLERANCE && 
           Math.abs(lonNum - GOOGLE_HQ_LON) < GOOGLE_HQ_TOLERANCE;
  };
  
  const agentAtGoogleHQ = isGoogleHQ(agentData.latitude, agentData.longitude);
  const clientAtGoogleHQ = isGoogleHQ(clientData.latitude, clientData.longitude);
  
  // Check location matches
  const sameCity = !!(agentData.city && clientData.city && 
    agentData.city.toLowerCase() === clientData.city.toLowerCase());
  const sameRegion = !!(agentData.region && clientData.region && 
    agentData.region.toLowerCase() === clientData.region.toLowerCase());
  const sameCountry = !!(agentData.country && clientData.country && 
    agentData.country.toLowerCase() === clientData.country.toLowerCase());

  // Calculate distance if we have coordinates
  let distanceMiles: number | null = null;
  if (agentData.latitude && agentData.longitude && clientData.latitude && clientData.longitude) {
    const agentLat = parseFloat(agentData.latitude);
    const agentLon = parseFloat(agentData.longitude);
    const clientLat = parseFloat(clientData.latitude);
    const clientLon = parseFloat(clientData.longitude);
    
    if (!isNaN(agentLat) && !isNaN(agentLon) && !isNaN(clientLat) && !isNaN(clientLon)) {
      distanceMiles = Math.round(calculateDistanceMiles(agentLat, agentLon, clientLat, clientLon));
    }
  }

  // Build location strings
  const agentLocation = agentData.city 
    ? `${agentData.city}, ${agentData.region || ''}, ${agentData.country || ''}`.replace(/,\s*,/g, ',').replace(/,\s*$/, '')
    : null;
  const clientLocation = clientData.city 
    ? `${clientData.city}, ${clientData.region || ''}, ${clientData.country || ''}`.replace(/,\s*,/g, ',').replace(/,\s*$/, '')
    : null;

  // Check for VPN usage
  const agentVpn = agentData.isVpn === true;
  const clientVpn = clientData.isVpn === true;

  // Determine flag status and reason (declare early for Google HQ check)
  let flagStatus: IPAnalysisResult['flagStatus'];
  let isValid: boolean;
  let confidence: number;
  let reason: string;

  // Check for suspicious default locations (Google HQ) - BEFORE other checks
  if (agentAtGoogleHQ || clientAtGoogleHQ) {
    flagStatus = 'suspicious';
    isValid = false;
    confidence = 0.90;
    const who = agentAtGoogleHQ && clientAtGoogleHQ ? 'Both agent and client' : 
                agentAtGoogleHQ ? 'Agent' : 'Client';
    reason = `SUSPICIOUS: ${who} location shows Google Headquarters (Mountain View, CA). This is likely a spoofed/default location or Google Cloud IP.`;
    return {
      isValid,
      flagStatus,
      confidence,
      reason,
      details: {
        sameIp,
        sameCity,
        sameRegion,
        sameCountry,
        distanceMiles,
        agentLocation,
        clientLocation,
        agentVpn: agentVpn || false,
        clientVpn: clientVpn || false,
      }
    };
  }
  
  // Check for New York location (cannot accept business from NY)
  const clientInNY = clientData.region?.toLowerCase().includes('new york') || 
                     clientData.city?.toLowerCase().includes('new york') ||
                     clientData.region === 'New York' ||
                     clientData.region === 'NY';
  const agentInNY = agentData.region?.toLowerCase().includes('new york') || 
                    agentData.city?.toLowerCase().includes('new york') ||
                    agentData.region === 'New York' ||
                    agentData.region === 'NY';

  // Check if client IP location matches declared state
  let stateMismatch = false;
  let stateMismatchReason = '';
  if (declaredState && clientData.region) {
    const normalizedDeclared = normalizeState(declaredState);
    const normalizedIPState = normalizeState(clientData.region);
    
    if (normalizedDeclared && normalizedIPState) {
      stateMismatch = normalizedDeclared.toLowerCase() !== normalizedIPState.toLowerCase();
      if (stateMismatch) {
        stateMismatchReason = `Client IP location (${clientData.region}) does not match declared state (${declaredState})`;
      }
    }
  }

  // Build VPN warning if detected (but only if GPS location is not available)
  // GPS location is more reliable than IP-based detection, so we trust GPS over IP VPN flags
  const vpnWarnings: string[] = [];
  const shouldFlagAgentVpn = agentVpn && !hasAgentGps; // Only flag if no GPS available
  const shouldFlagClientVpn = clientVpn && !hasClientGps; // Only flag if no GPS available
  
  if (shouldFlagAgentVpn) {
    vpnWarnings.push(`Agent using VPN/Proxy (${agentData.vpnDetectionReason || 'detected'})`);
  }
  if (shouldFlagClientVpn) {
    vpnWarnings.push(`Client using VPN/Proxy (${clientData.vpnDetectionReason || 'detected'})`);
  }
  const vpnWarning = vpnWarnings.length > 0 ? ` ⚠️ ${vpnWarnings.join(', ')}.` : '';

  // Priority order for flags (most critical first):
  // 1. Client in New York - RED FLAG (cannot accept business from NY)
  // 2. VPN detected (only if GPS not available) - RED FLAG
  // 3. State mismatch - RED FLAG
  // 4. Same IP - CRITICAL
  // 5. Other proximity issues

  if (clientInNY) {
    // CRITICAL: Client in New York - cannot accept business
    flagStatus = 'flagged';
    isValid = false;
    confidence = 1.0;
    reason = `FLAGGED: Client IP is in New York (${clientData.city || clientData.region || 'NY'}). Business cannot be accepted from New York.`;
  } else if (shouldFlagClientVpn || shouldFlagAgentVpn) {
    // FLAGGED: VPN detected - red flag (only if GPS location not available)
    flagStatus = 'flagged';
    isValid = false;
    confidence = 0.95;
    reason = `FLAGGED: ${vpnWarnings.join(' and ')} detected. VPN usage flags the session for review.${vpnWarning}`;
  } else if (stateMismatch) {
    // INFO: State mismatch - informational only, does NOT flag as invalid
    // IP/location analysis is purely informational and does not affect validation status
    flagStatus = 'flagged';
    isValid = true; // Changed to true - IP state mismatch is informational only
    confidence = 0.90;
    reason = `INFO: ${stateMismatchReason}. This is informational only - IP location does not affect validation.`;
  } else if (sameIp) {
    // CRITICAL: Same exact IP address - very suspicious
    flagStatus = 'critical';
    isValid = false;
    confidence = 0.99;
    reason = `CRITICAL: Agent and client have SAME IP address (${agentIp}). This is highly suspicious - agent may be impersonating client.${vpnWarning}`;
  } else if (shouldFlagAgentVpn && shouldFlagClientVpn && sameCity) {
    // CRITICAL: Both using VPN and same city - very suspicious (only if GPS not available)
    flagStatus = 'critical';
    isValid = false;
    confidence = 0.95;
    reason = `CRITICAL: Both agent and client using VPN/Proxy AND in SAME CITY (${agentData.city}). This is highly suspicious - may be coordinated fraud.${vpnWarning}`;
  } else if (sameCity) {
    // HIGH: Same city - suspicious for Zoom presentations
    flagStatus = 'flagged';
    isValid = false;
    confidence = 0.85;
    reason = `FLAGGED: Agent and client in SAME CITY (${agentData.city}). Agents do Zoom presentations so should not be in same location as client.${vpnWarning}`;
  } else if (distanceMiles !== null && distanceMiles < 10) {
    // HIGH: Within 10 miles - very suspicious
    flagStatus = 'flagged';
    isValid = false;
    confidence = 0.85;
    reason = `FLAGGED: Agent and client are only ${distanceMiles} miles apart. Agents do Zoom presentations so should not be in close proximity.`;
  } else if (distanceMiles !== null && distanceMiles < 60) {
    // MEDIUM: Within 60 miles - suspicious
    flagStatus = 'suspicious';
    isValid = false;
    confidence = 0.70;
    reason = `SUSPICIOUS: Agent and client are ${distanceMiles} miles apart. Closer than typical for Zoom presentations.${geolocationNote}`;
  } else if (sameRegion) {
    // ✅ FIXED: Same region is NOT a flag - just mention it, but mark as VALID
    // Same state/region is common and not suspicious (e.g., both in Texas)
    flagStatus = 'valid';
    isValid = true;
    confidence = 0.90;
    const distanceStr = distanceMiles !== null ? ` (${distanceMiles} miles apart)` : '';
    const regionNote = ` Both in ${agentData.region} region.`;
    reason = `VALID: Agent and client in different locations${distanceStr}.${regionNote} This is expected for Zoom presentations.${geolocationNote}`;
  } else {
    // VALID: Different locations - expected for Zoom
    // ✅ FIXED: If we have IP addresses but no GPS (geolocation denied), still mark as VALID
    // Geolocation denial is NOT a flag - IP-based location is sufficient
    flagStatus = 'valid';
    isValid = true;
    confidence = 0.95;
    const distanceStr = distanceMiles !== null ? ` (${distanceMiles} miles apart)` : '';
    reason = `VALID: Agent and client in different locations${distanceStr}. This is expected for Zoom presentations.${geolocationNote}`;
  }

  return {
    isValid,
    flagStatus,
    confidence,
    reason,
    details: {
      sameIp,
      sameCity,
      sameRegion,
      sameCountry,
      distanceMiles,
      agentLocation,
      clientLocation,
      // GPS overrides IP-based VPN detection - only show VPN if GPS not available
      agentVpn: shouldFlagAgentVpn || false,
      clientVpn: shouldFlagClientVpn || false,
    }
  };
}

/**
 * Get the real IP address from a request, handling proxies and load balancers
 */
export function getRealIP(req: any): string {
  // Try various headers in order of reliability
  const forwardedFor = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  const cfConnectingIp = req.headers['cf-connecting-ip']; // Cloudflare
  const trueClientIp = req.headers['true-client-ip']; // Akamai/Cloudflare
  
  // x-forwarded-for can be a comma-separated list, take the first (original client)
  if (forwardedFor) {
    const ips = typeof forwardedFor === 'string' 
      ? forwardedFor.split(',').map(ip => ip.trim())
      : forwardedFor;
    const clientIp = Array.isArray(ips) ? ips[0] : forwardedFor;
    if (clientIp && clientIp !== '::1' && clientIp !== '127.0.0.1') {
      return clientIp;
    }
  }
  
  if (cfConnectingIp && cfConnectingIp !== '::1' && cfConnectingIp !== '127.0.0.1') {
    return typeof cfConnectingIp === 'string' ? cfConnectingIp : cfConnectingIp[0];
  }
  
  if (trueClientIp && trueClientIp !== '::1' && trueClientIp !== '127.0.0.1') {
    return typeof trueClientIp === 'string' ? trueClientIp : trueClientIp[0];
  }
  
  if (realIp && realIp !== '::1' && realIp !== '127.0.0.1') {
    return typeof realIp === 'string' ? realIp : realIp[0];
  }
  
  // Fallback to req.ip or socket
  const reqIp = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;
  
  // Handle IPv6 localhost
  if (reqIp === '::1' || reqIp === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }
  
  // Strip IPv6 prefix if present
  if (reqIp && reqIp.startsWith('::ffff:')) {
    return reqIp.substring(7);
  }
  
  return reqIp || 'unknown';
}

/**
 * Detect VPN/Proxy based on ISP name patterns
 * Common VPN/proxy/hosting indicators in ISP names
 */
function detectVpnFromIsp(isp: string | null): { isVpn: boolean; reason: string } {
  if (!isp) {
    return { isVpn: false, reason: 'No ISP data' };
  }
  
  const ispLower = isp.toLowerCase();
  
  // Common VPN/proxy/hosting keywords
  const vpnKeywords = [
    'vpn', 'proxy', 'hosting', 'datacenter', 'data center', 'server', 'cloud',
    'aws', 'azure', 'gcp', 'google cloud', 'amazon', 'digitalocean', 'linode',
    'vultr', 'ovh', 'hetzner', 'contabo', 'leaseweb', 'ramnode', 'buyvm',
    'nordvpn', 'expressvpn', 'surfshark', 'cyberghost', 'private internet access',
    'ipvanish', 'protonvpn', 'tunnelbear', 'windscribe', 'mullvad', 'hide.me',
    'tor', 'tor network', 'onion', 'anonymous', 'privacy', 'anonymizer'
  ];
  
  for (const keyword of vpnKeywords) {
    if (ispLower.includes(keyword)) {
      return { 
        isVpn: true, 
        reason: `ISP name contains "${keyword}" indicator` 
      };
    }
  }
  
  return { isVpn: false, reason: 'No VPN indicators found in ISP name' };
}

/**
 * Fetch IP geolocation data using ipinfo.io ONLY (most reliable)
 * ipinfo.io provides better accuracy, especially for mobile carrier IPs
 * Also detects VPN/proxy/hosting status
 * ✅ REMOVED ip-api.com fallback - not reliable
 */
export async function getIPGeolocation(ip: string): Promise<{
  country: string | null;
  regionName: string | null;
  city: string | null;
  lat: number | null;
  lon: number | null;
  timezone: string | null;
  isp: string | null;
  isVpn: boolean | null;
  isProxy: boolean | null;
  isHosting: boolean | null;
  vpnDetectionReason: string | null;
} | null> {
  // Skip localhost IPs
  if (!ip || ip === 'unknown' || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    console.log(`⚠️ Skipping geolocation for local/private IP: ${ip}`);
    return null;
  }
  
  // Import IPinfo API key
  const { IPINFO_API_KEY } = await import('./hardcoded-config.js');
  
  // ✅ ONLY use ipinfo.io - most reliable
  try {
    // Use AbortController for timeout (fetch doesn't support timeout directly)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const ipinfoResponse = await fetch(
      `https://ipinfo.io/${ip}?token=${IPINFO_API_KEY}`,
      { signal: controller.signal }
    );
    
    clearTimeout(timeoutId);
    
    if (ipinfoResponse.ok) {
      const ipinfoData = await ipinfoResponse.json();
      
      // Check if ipinfo.io returned valid data (not error)
      if (ipinfoData && !ipinfoData.error && ipinfoData.country) {
        // Parse coordinates from "lat,lon" format
        let lat: number | null = null;
        let lon: number | null = null;
        if (ipinfoData.loc) {
          const [latStr, lonStr] = ipinfoData.loc.split(',');
          lat = parseFloat(latStr);
          lon = parseFloat(lonStr);
          if (isNaN(lat) || isNaN(lon)) {
            lat = null;
            lon = null;
          }
        }
        
        // Use ipinfo.io data - it's reliable
        const ispVpnDetection = detectVpnFromIsp(ipinfoData.org || ipinfoData.asn?.name || null);
        const isVpn = ipinfoData.is_anonymous || ipinfoData.is_hosting || ispVpnDetection.isVpn;
        const isProxy = ipinfoData.is_anonymous || false;
        const isHosting = ipinfoData.is_hosting || false;
        
        let vpnReason = '';
        if (ipinfoData.is_anonymous) {
          vpnReason = 'IP flagged as anonymous/proxy by ipinfo.io';
        } else if (ipinfoData.is_hosting) {
          vpnReason = 'IP flagged as hosting/datacenter by ipinfo.io';
        } else if (ispVpnDetection.isVpn) {
          vpnReason = ispVpnDetection.reason;
        }
        
        console.log(`✅ ipinfo.io geolocation for ${ip}:`, {
          city: ipinfoData.city,
          region: ipinfoData.region,
          country: ipinfoData.country,
          isp: ipinfoData.org || ipinfoData.asn?.name,
          isVpn,
          isProxy,
          isHosting
        });
        
        return {
          country: ipinfoData.country || null,
          regionName: ipinfoData.region || null,
          city: ipinfoData.city || null,
          lat,
          lon,
          timezone: ipinfoData.timezone || null,
          isp: ipinfoData.org || ipinfoData.asn?.name || null,
          isVpn: isVpn || null,
          isProxy: isProxy || null,
          isHosting: isHosting || null,
          vpnDetectionReason: vpnReason || null,
        };
      } else {
        console.warn(`⚠️ ipinfo.io returned error for ${ip}:`, ipinfoData?.error || 'Invalid response');
        return null;
      }
    } else {
      console.warn(`⚠️ ipinfo.io lookup failed for ${ip}: HTTP ${ipinfoResponse.status}`);
      return null;
    }
  } catch (ipinfoError) {
    console.error(`❌ ipinfo.io lookup error for ${ip}:`, ipinfoError);
    return null;
  }
}

/**
 * Fetch public IP using external service (for when behind proxy/NAT)
 * This is called from the client-side to get their real public IP
 */
export async function getPublicIP(): Promise<string | null> {
  try {
    // Try multiple services as fallbacks
    const services = [
      'https://api.ipify.org?format=json',
      'https://api.ip.sb/ip',
      'https://icanhazip.com',
    ];
    
    for (const service of services) {
      try {
        const response = await fetch(service, { 
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (response.ok) {
          const text = await response.text();
          // Handle JSON response from ipify
          if (text.startsWith('{')) {
            const data = JSON.parse(text);
            return data.ip;
          }
          // Plain text IP
          return text.trim();
        }
      } catch (e) {
        continue; // Try next service
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to get public IP:', error);
    return null;
  }
}

console.log('✅ IP Analysis Service loaded');

