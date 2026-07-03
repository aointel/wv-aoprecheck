# VPN Detection for Verification Sessions

## Overview

The IP analysis system now automatically detects VPNs, proxies, and hosting/datacenter IPs for both agent and client connections. This helps identify potential fraud and privacy concerns.

## How VPN Detection Works

### 1. **API-Based Detection (ip-api.com)**

When an IP address is captured, the system requests geolocation data from `ip-api.com`, including:
- `proxy` field: Indicates if the IP is a known proxy/VPN (requires paid tier, but we try anyway)
- `hosting` field: Indicates if the IP is from a datacenter/hosting provider
- `mobile` field: Indicates if it's a mobile connection

### 2. **ISP Name Pattern Detection**

If the API doesn't provide proxy/hosting flags (free tier limitation), the system analyzes the ISP name for common VPN/proxy/hosting keywords:

**VPN Keywords Detected:**
- `vpn`, `proxy`, `hosting`, `datacenter`, `data center`
- `server`, `cloud`, `aws`, `azure`, `gcp`, `google cloud`, `amazon`
- `digitalocean`, `linode`, `vultr`, `ovh`, `hetzner`, `contabo`, `leaseweb`, `ramnode`, `buyvm`
- Popular VPN services: `nordvpn`, `expressvpn`, `surfshark`, `cyberghost`, `private internet access`, `ipvanish`, `protonvpn`, `tunnelbear`, `windscribe`, `mullvad`, `hide.me`
- Privacy networks: `tor`, `tor network`, `onion`, `anonymous`, `privacy`, `anonymizer`

### 3. **Detection Logic**

An IP is flagged as VPN if:
- `proxy` field from ip-api.com is `true`, OR
- `hosting` field from ip-api.com is `true`, OR
- ISP name contains any VPN/proxy/hosting keyword

## Data Storage

VPN detection results are stored in the `verification_sessions` table:

**Client VPN Fields:**
- `client_is_vpn` (BOOLEAN): True if client IP is detected as VPN/proxy/hosting
- `client_is_proxy` (BOOLEAN): True if flagged as proxy by ip-api.com
- `client_is_hosting` (BOOLEAN): True if flagged as hosting/datacenter by ip-api.com
- `client_vpn_detection_reason` (TEXT): Human-readable reason for detection

**Agent VPN Fields:**
- `agent_is_vpn` (BOOLEAN): True if agent IP is detected as VPN/proxy/hosting
- `agent_is_proxy` (BOOLEAN): True if flagged as proxy by ip-api.com
- `agent_is_hosting` (BOOLEAN): True if flagged as hosting/datacenter by ip-api.com
- `agent_vpn_detection_reason` (TEXT): Human-readable reason for detection

**Full Analysis:**
- VPN data is also included in the `ip_analysis` JSONB field for complete analysis history

## Impact on Fraud Detection

VPN detection enhances the IP analysis flagging system:

### Critical Flags:
- **Same IP + VPN**: If both agent and client have the same IP AND both are using VPNs, this is highly suspicious
- **Same City + VPN**: If both are using VPNs and in the same city, this suggests coordinated fraud

### Suspicious Flags:
- **VPN Usage Detected**: Any VPN/proxy usage is flagged as "suspicious" for review, even if locations are different
- VPN usage doesn't automatically invalidate a session, but it warrants review

### Flag Status Levels:
1. **Critical**: Same IP, or both VPN + same city
2. **Flagged**: Same city (regardless of VPN)
3. **Suspicious**: VPN detected, or close proximity (< 100 miles)
4. **Valid**: Different locations, no VPN detected

## Example Detection Scenarios

### Scenario 1: Client Using VPN
```
Client IP: 185.220.101.45
ISP: "NordVPN"
Detection: client_is_vpn = TRUE
Reason: "ISP name contains 'nordvpn' indicator"
Flag Status: SUSPICIOUS (if agent not using VPN)
```

### Scenario 2: Both Using VPN + Same City
```
Agent IP: 45.33.32.156 (ExpressVPN)
Client IP: 185.220.101.45 (NordVPN)
Both in: Los Angeles, CA
Detection: Both flagged as VPN, same city
Flag Status: CRITICAL
Reason: "CRITICAL: Both agent and client using VPN/Proxy AND in SAME CITY. Highly suspicious."
```

### Scenario 3: Datacenter IP
```
Agent IP: 104.248.90.1
ISP: "DigitalOcean LLC"
Detection: agent_is_hosting = TRUE, agent_is_vpn = TRUE
Reason: "ISP name contains 'digitalocean' indicator"
Flag Status: SUSPICIOUS
```

## Querying VPN Data

### Find all sessions with VPN usage:
```sql
SELECT * FROM verification_sessions 
WHERE client_is_vpn = TRUE OR agent_is_vpn = TRUE;
```

### Find sessions where both used VPN:
```sql
SELECT * FROM verification_sessions 
WHERE client_is_vpn = TRUE AND agent_is_vpn = TRUE;
```

### Find critical fraud cases (VPN + same location):
```sql
SELECT * FROM verification_sessions 
WHERE (client_is_vpn = TRUE OR agent_is_vpn = TRUE)
  AND client_city = agent_city
  AND ip_flag_status = 'critical';
```

## Setup Instructions

1. **Run the SQL script to add VPN columns:**
   ```bash
   psql -d your_database -f server/add-vpn-detection-columns.sql
   ```

2. **Restart the server** to load the updated IP analysis service

3. **VPN detection is automatic** - it runs whenever an IP is captured (client or agent)

## Limitations

1. **Free Tier API**: The `proxy` field from ip-api.com may not be available on the free tier. The system falls back to ISP name pattern detection.

2. **False Positives**: Some legitimate ISPs may have names that match VPN keywords (e.g., "Cloud Services Inc."). These will be flagged but can be reviewed manually.

3. **Privacy vs. Fraud**: VPN usage doesn't necessarily indicate fraud - many legitimate users use VPNs for privacy. The system flags it for review rather than automatically rejecting.

4. **ISP Name Variations**: The keyword detection is case-insensitive but may miss variations or new VPN services not in the keyword list.

## Future Enhancements

- Integration with paid VPN detection APIs for more accurate detection
- Machine learning model to reduce false positives
- Custom VPN/proxy whitelist for known legitimate services
- Real-time alerts when VPN usage is detected in critical sessions

