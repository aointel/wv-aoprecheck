# How to Check for VPN Detection

## 🚀 Automatic Detection

VPN detection happens **automatically** when:
- Client visits their verification link → Client IP captured → VPN checked
- Agent visits their verification link → Agent IP captured → VPN checked

The system checks:
1. **API flags** from ip-api.com (`proxy`, `hosting` fields)
2. **ISP name patterns** (e.g., "NordVPN", "ExpressVPN", "DigitalOcean")

## 📊 Ways to Check for VPNs

### Option 1: Quick Summary Stats

Run the check script:
```bash
tsx server/check-vpn-detection.ts
```

This shows:
- Total sessions
- How many clients using VPN
- How many agents using VPN
- How many both using VPN
- Flag status breakdown

### Option 2: View All VPN Sessions

```bash
tsx server/check-vpn-detection.ts --all
```

Shows detailed list of all sessions with VPN detection.

### Option 3: Check Specific Session

```bash
tsx server/check-vpn-detection.ts --session <session_id>
```

Example:
```bash
tsx server/check-vpn-detection.ts --session abc123
```

### Option 4: Recent VPN Sessions

```bash
tsx server/check-vpn-detection.ts --recent
```

Shows last 50 sessions with VPN detection.

## 🔍 Direct SQL Queries

### Find All Sessions with VPN Usage

```sql
SELECT 
  session_id,
  first_name,
  last_name,
  client_ip_address,
  client_isp,
  client_is_vpn,
  client_vpn_detection_reason,
  agent_ip_address,
  agent_isp,
  agent_is_vpn,
  agent_vpn_detection_reason,
  ip_flag_status,
  ip_flag_reason,
  created_at
FROM verification_sessions
WHERE client_is_vpn = TRUE OR agent_is_vpn = TRUE
ORDER BY created_at DESC;
```

### Find Critical Fraud Cases (Both VPN + Same City)

```sql
SELECT 
  session_id,
  first_name,
  last_name,
  client_ip_address,
  client_city,
  client_is_vpn,
  agent_ip_address,
  agent_city,
  agent_is_vpn,
  ip_flag_status,
  ip_flag_reason
FROM verification_sessions
WHERE client_is_vpn = TRUE 
  AND agent_is_vpn = TRUE
  AND client_city = agent_city
  AND ip_flag_status = 'critical';
```

### Count VPN Usage by Type

```sql
SELECT 
  COUNT(*) as total_sessions,
  SUM(CASE WHEN client_is_vpn THEN 1 ELSE 0 END) as client_vpn_count,
  SUM(CASE WHEN agent_is_vpn THEN 1 ELSE 0 END) as agent_vpn_count,
  SUM(CASE WHEN client_is_vpn AND agent_is_vpn THEN 1 ELSE 0 END) as both_vpn_count,
  SUM(CASE WHEN client_is_proxy THEN 1 ELSE 0 END) as client_proxy_count,
  SUM(CASE WHEN agent_is_proxy THEN 1 ELSE 0 END) as agent_proxy_count,
  SUM(CASE WHEN client_is_hosting THEN 1 ELSE 0 END) as client_hosting_count,
  SUM(CASE WHEN agent_is_hosting THEN 1 ELSE 0 END) as agent_hosting_count
FROM verification_sessions;
```

### Find Sessions Flagged Due to VPN

```sql
SELECT 
  session_id,
  first_name,
  last_name,
  ip_flag_status,
  ip_flag_reason,
  client_is_vpn,
  agent_is_vpn,
  created_at
FROM verification_sessions
WHERE ip_flag_status IN ('suspicious', 'flagged', 'critical')
  AND (client_is_vpn = TRUE OR agent_is_vpn = TRUE)
ORDER BY created_at DESC;
```

### VPN Detection Reasons Breakdown

```sql
SELECT 
  client_vpn_detection_reason,
  COUNT(*) as count
FROM verification_sessions
WHERE client_is_vpn = TRUE
GROUP BY client_vpn_detection_reason
ORDER BY count DESC;
```

## 📋 Understanding the Results

### Column Meanings:

- **`client_is_vpn`**: `TRUE` if client IP detected as VPN/proxy/hosting
- **`client_is_proxy`**: `TRUE` if flagged as proxy by API
- **`client_is_hosting`**: `TRUE` if flagged as datacenter/hosting by API
- **`client_vpn_detection_reason`**: Why it was detected (e.g., "ISP name contains 'nordvpn' indicator")
- **`agent_is_vpn`**: Same as above, for agent
- **`ip_flag_status`**: Overall fraud flag status
  - `critical`: Same IP or both VPN + same city
  - `flagged`: Same city
  - `suspicious`: VPN detected or close proximity
  - `valid`: No issues detected
  - `pending`: Analysis not complete yet

### What to Look For:

1. **Both VPN + Same City** = CRITICAL - Very suspicious
2. **Both VPN** = SUSPICIOUS - Worth reviewing
3. **Client VPN** = May indicate privacy concerns or fraud
4. **Agent VPN** = Unusual for agents (may indicate compromised account)

## 🔄 Real-Time Monitoring

VPN detection happens in real-time when:
- ✅ Client visits verification link → `/api/verification/session/:id/capture-client-ip`
- ✅ Agent visits verification link → `/api/verification/session/:id/capture-agent-ip`

Both endpoints:
1. Get IP address
2. Call `getIPGeolocation()` → Detects VPN
3. Store VPN flags in database
4. Run IP analysis → Updates `ip_flag_status` if VPN detected

## 📝 Example Output

When you run the check script, you'll see:

```
📊 VPN Detection Summary
================================================================================
Total Sessions: 1250

VPN Usage:
  Client using VPN: 47 (3.8%)
  Agent using VPN: 3 (0.2%)
  Both using VPN: 1 (0.1%)

Flag Status:
  Critical: 2
  Flagged: 15
  Suspicious: 48
  Valid: 1185

🔍 Sessions with VPN Detection (51):
================================================================================

1. Session: abc123-def456
   Client: John Doe
   Created: 12/15/2025, 3:45:12 PM
   Client VPN: ✅ NordVPN Services Pte. Ltd.
   Agent VPN: ❌ Comcast Cable Communications
   Flag: SUSPICIOUS - SUSPICIOUS: Client using VPN/Proxy detected. Review recommended.
```

## 🛠️ Troubleshooting

**No VPN data showing?**
- Make sure IPs are being captured (check `client_ip_address` and `agent_ip_address` columns)
- VPN detection only works for public IPs (not localhost/private IPs)
- Check server logs for geolocation API errors

**False positives?**
- Some legitimate ISPs may match VPN keywords
- Review the `client_vpn_detection_reason` to see why it was flagged
- Check if `client_is_proxy` or `client_is_hosting` are TRUE (more reliable than ISP name)

