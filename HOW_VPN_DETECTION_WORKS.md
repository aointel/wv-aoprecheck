# How VPN/Proxy Detection Works

## 🔍 Detection Methods

We use **3 methods** to detect VPNs/Proxies:

### 1. **Direct Flags from IP Services** (Most Reliable)

We check two IP geolocation services:

**ipinfo.io (Primary):**
- `is_anonymous` → Proxy/VPN detected
- `is_hosting` → Datacenter/hosting IP

**ip-api.com (Fallback):**
- `proxy` → Proxy detected
- `hosting` → Datacenter/hosting IP

**Example from your case:**
```
"IP flagged as hosting/datacenter by ip-api.com"
```
This means `ip-api.com` returned `hosting: true` for that IP address.

---

### 2. **ISP Name Pattern Matching** (Secondary Check)

We check the **ISP name** (Internet Service Provider) for VPN keywords:

**VPN Keywords We Look For:**
- VPN services: `nordvpn`, `expressvpn`, `surfshark`, `cyberghost`, `protonvpn`, etc.
- Cloud providers: `aws`, `azure`, `gcp`, `google cloud`, `amazon`, `digitalocean`
- Hosting providers: `vultr`, `ovh`, `hetzner`, `contabo`, `leaseweb`
- Generic terms: `vpn`, `proxy`, `hosting`, `datacenter`, `server`, `cloud`, `tor`

**Example:**
If ISP name is "NordVPN Inc" → Detected as VPN
Reason: `ISP name contains "nordvpn" indicator`

---

### 3. **Combined Detection**

An IP is flagged as VPN if **ANY** of these are true:
- Service says `is_anonymous = true`
- Service says `is_hosting = true` 
- Service says `proxy = true`
- ISP name contains VPN keywords

---

## 📊 What Information We Get

### From IP Services:
- ✅ **ISP Name** - The actual company/organization name (e.g., "DigitalOcean LLC", "Amazon Technologies Inc")
- ✅ **Direct Flags** - `is_anonymous`, `is_hosting`, `proxy` fields
- ✅ **Location** - City, state, country
- ✅ **Coordinates** - GPS location

### What We Show You:
- **VPN/Proxy Detected** - Yes/No
- **Detection Reason** - HOW it was detected:
  - `"IP flagged as hosting/datacenter by ip-api.com"` ← Service flagged it
  - `"IP flagged as anonymous/proxy by ipinfo.io"` ← Service flagged it
  - `"ISP name contains 'digitalocean' indicator"` ← ISP name matched keyword

---

## ❓ Do We Get the VPN Name?

**Sometimes, but not always:**

1. **If ISP name is a VPN provider:**
   - ✅ Yes - We see the name (e.g., "NordVPN Inc", "ExpressVPN")
   - Reason shows: `"ISP name contains 'nordvpn' indicator"`

2. **If it's a cloud/hosting provider:**
   - ✅ Yes - We see the name (e.g., "DigitalOcean LLC", "Amazon Technologies Inc")
   - Reason shows: `"ISP name contains 'digitalocean' indicator"` or `"IP flagged as hosting/datacenter"`

3. **If service flags it but ISP is generic:**
   - ❌ No specific VPN name
   - Reason shows: `"IP flagged as anonymous/proxy"` or `"IP flagged as hosting/datacenter"`

---

## 🔍 Your Example Explained

**Client IP: 63.79.130.12**

**Detection:**
- `ip-api.com` returned `hosting: true`
- This means the IP belongs to a datacenter/hosting provider
- **Reason:** `"IP flagged as hosting/datacenter by ip-api.com"`

**What this means:**
- The IP is from a hosting/datacenter (not residential)
- Could be:
  - VPN server
  - Proxy server
  - Cloud hosting (AWS, DigitalOcean, etc.)
  - Corporate datacenter

**We don't know the specific VPN name** because:
- The service only flagged it as "hosting"
- The ISP name might be generic (like "Datacenter Provider LLC")
- We'd need to check the actual ISP name to see if it contains VPN keywords

---

## 💡 How to See More Details

The **ISP name** is stored in the database but might not be displayed in the UI. To see the actual ISP name:

1. Check server logs - they show the full ISP name
2. Check database - `client_isp` or `agent_isp` columns
3. The ISP name would tell you if it's "NordVPN", "DigitalOcean", etc.

---

## 🎯 Summary

**How we detect:**
1. ✅ IP services flag it directly (`is_hosting`, `is_anonymous`, `proxy`)
2. ✅ ISP name contains VPN keywords
3. ✅ Combined check (either method triggers detection)

**What we know:**
- ✅ VPN/Proxy detected: Yes/No
- ✅ Detection method: Service flag or ISP keyword
- ✅ ISP name: Usually available (shows company name)
- ❓ Specific VPN name: Only if ISP name is a VPN provider

**Your case:**
- Detected via: `ip-api.com` hosting flag
- Reason: `"IP flagged as hosting/datacenter by ip-api.com"`
- ISP name: Check database/logs to see actual company name
