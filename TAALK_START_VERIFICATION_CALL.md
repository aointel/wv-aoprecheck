# 📞 Taalk API Call - Start Verification Button

## What Happens When Agent Clicks "Start Verification"

---

## 🔀 Two Different Tracks

### 1. **Conference Track** (Spanish / Phone Bridge)
- Agent gets called directly on their phone
- AI agent conducts verification over phone

### 2. **Zoom Track** (English / Video Call)
- Twilio phone dials into Zoom meeting
- AI agent joins Zoom via phone bridge
- Agent and client already in Zoom

---

## 📞 CONFERENCE TRACK (Phone Bridge)

### Frontend Trigger:
```javascript
// User clicks "Start Verification" button
const response = await fetch('/api/verification/initiate-conference-call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: "VER-1234567890",
    clientInfo: {
      firstName: "John",
      lastName: "Doe",
      phone: "+15551234567",
      city: "Dallas",
      state: "TX",
      premium: "149.00"
    },
    agentPhone: "+15551234567"
  })
});
```

### Backend → Taalk API Call:

**Endpoint:**
```
POST https://api.taalk.ai/api/call?db=michaelmandella
```

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4"
}
```

**Body (Exact Payload):**
```json
{
  "name": "John Doe",
  "phone": "15551234567",
  "agent": "68a5ff0fc8f1520e59acf3e6",
  "retryMethod": 0,
  "webhookUrl": "https://policy-verify-mmandella.replit.app/api/taalk/webhook",
  "params": {
    "Taalk_AgentFirstName": "Michael",
    "Taalk_AgentLastName": "Mandella",
    "Taalk_AgentPhone": "+15551234567",
    "Taalk_AgentEmail": "agent@aoglobelife.com",
    "Taalk_MemberFirstName": "John",
    "Taalk_MemberFiirstName": "John",
    "Taalk_MemberPhone": "+15551234567",
    "Taalk_PMemberFirstName": "John",
    "MemberFirstName": "John",
    "Taalk_ClientName": "John Doe",
    "Taalk_ClientPhone": "+15551234567",
    "Taalk_MonthlyPremium": "149.00",
    "Taalk_ALP": "149.00",
    "Taalk_ACHdrawdate": "January 15, 2025",
    "Taalk_ACHdrawdateshort": "1/15",
    "Taalk_Location": "Dallas, TX",
    "Taalk_ClientCountry": "United States",
    "Taalk_ClientRegion": "TX",
    "Taalk_ClientCity": "Dallas",
    "Taalk_SessionId": "VER-1234567890",
    "Taalk_VerificationMethod": "Conference Call",
    "Taalk_CallTimestamp": "2025-10-17T16:30:00.000Z",
    "Taalk_CompanyName": "Globe Life AIL Division"
  }
}
```

**KEY POINT:** 
- ✅ `"phone": "15551234567"` = **AGENT'S PHONE** (no + symbol)
- ✅ Taalk AI calls the agent directly
- ✅ Agent answers, then conferences in client manually

---

## 🎥 ZOOM TRACK (Zoom Bridge)

### Frontend Trigger:
```javascript
// User clicks "Start Verification" button
const response = await fetch('/api/verification/initiate-zoom-call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: "VER-1234567890",
    clientInfo: {
      firstName: "John",
      lastName: "Doe",
      phone: "+15551234567",
      zoomRoomId: "123456789",
      zoomPassword: "abc123",
      city: "Dallas",
      state: "TX",
      premium: "149.00"
    },
    agentPhone: "+15551234567",
    zoomRoomId: "123456789",
    zoomPassword: "abc123"
  })
});
```

### Backend → Taalk API Call:

**Endpoint:**
```
POST https://api.taalk.ai/api/call?db=michaelmandella
```

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4"
}
```

**Body (Exact Payload with Zoom Bridge):**
```json
{
  "name": "John Doe",
  "phone": "6692192599,,123456789#,,#,,abc123#",
  "agent": "68a5ff0fc8f1520e59acf3e6",
  "retryMethod": 0,
  "force": true,
  "webhookUrl": "https://policy-verify-mmandella.replit.app/api/taalk/webhook",
  "params": {
    "Taalk_AgentFirstName": "Michael",
    "Taalk_AgentLastName": "Mandella",
    "Taalk_AgentPhone": "+15551234567",
    "Taalk_AgentEmail": "agent@aoglobelife.com",
    "Taalk_ZoomId": "123456789",
    "Taalk_ZoomPassword": "abc123",
    "Taalk_MemberFirstName": "John",
    "Taalk_MemberFiirstName": "John",
    "Taalk_MemberPhone": "+15551234567",
    "Taalk_PMemberFirstName": "John",
    "MemberFirstName": "John",
    "Taalk_ClientName": "John Doe",
    "Taalk_ClientPhone": "+15551234567",
    "Taalk_MonthlyPremium": "149.00",
    "Taalk_ALP": "149.00",
    "Taalk_ACHdrawdate": "January 15, 2025",
    "Taalk_ACHdrawdateshort": "1/15",
    "Taalk_Location": "Dallas, TX",
    "Taalk_ClientCountry": "United States",
    "Taalk_ClientRegion": "TX",
    "Taalk_ClientCity": "Dallas",
    "Taalk_SessionId": "VER-1234567890",
    "Taalk_VerificationMethod": "Zoom Call",
    "Taalk_CallTimestamp": "2025-10-17T16:30:00.000Z",
    "Taalk_CompanyName": "Globe Life AIL Division",
    "Taalk_AssociateId": "12345"
  }
}
```

**KEY POINTS:** 
- ✅ `"phone": "6692192599,,123456789#,,#,,abc123#"` = **ZOOM BRIDGE PHONE**
- ✅ Format: `ZoomDialInNumber,,RoomID#,,#,,Password#`
- ✅ Taalk AI calls Zoom bridge and auto-enters credentials
- ✅ Agent and client already in Zoom waiting

---

## 🔑 Critical Fields

### Phone Number Field:
```javascript
// CONFERENCE TRACK:
"phone": "15551234567"  // Agent's phone (cleaned, no +)

// ZOOM TRACK:
"phone": "6692192599,,123456789#,,#,,abc123#"  // Zoom bridge dial string
```

### Zoom Bridge Format:
```
[Zoom Dial-In],,,[Room ID]#,,#,,[Password]#

Example:
6692192599,,123456789#,,#,,abc123#

Breakdown:
- 6692192599 = Zoom US dial-in number
- ,, = Pause for system
- 123456789# = Meeting ID + # to confirm
- ,,# = Pause + # for participant
- ,, = Another pause
- abc123# = Password + # to join
```

### AI Agent IDs:
```javascript
// English AI
"agent": "68a5ff0fc8f1520e59acf3e6"

// Spanish AI  
"agent": "66461a241e0b08270180af7a"
```

### Campaign ID:
```javascript
const workingCampaignId = "6747819a86c131c2cb203719";
```

---

## 📋 All Taalk Parameters

### Agent Information:
- `Taalk_AgentFirstName` - Agent's first name
- `Taalk_AgentLastName` - Agent's last name
- `Taalk_AgentPhone` - Agent's phone (with +)
- `Taalk_AgentEmail` - Agent's email
- `Taalk_AssociateId` - Agent's associate ID

### Client Information:
- `Taalk_MemberFirstName` - Client first name
- `Taalk_MemberFiirstName` - Typo version (required!)
- `Taalk_PMemberFirstName` - Alternate field
- `MemberFirstName` - Without prefix
- `Taalk_ClientName` - Full client name
- `Taalk_ClientPhone` - Client phone
- `Taalk_MemberPhone` - Client phone (duplicate)

### Payment Information:
- `Taalk_MonthlyPremium` - Monthly premium amount
- `Taalk_ALP` - Same as premium (script uses this)
- `Taalk_ACHdrawdate` - Full ACH date
- `Taalk_ACHdrawdateshort` - Short date format

### Location:
- `Taalk_Location` - "City, State" format
- `Taalk_ClientCountry` - Always "United States"
- `Taalk_ClientRegion` - State
- `Taalk_ClientCity` - City

### Zoom-Specific (Zoom Track Only):
- `Taalk_ZoomId` - Zoom room/meeting ID
- `Taalk_ZoomPassword` - Zoom password

### Metadata:
- `Taalk_SessionId` - Verification session ID
- `Taalk_VerificationMethod` - "Conference Call" or "Zoom Call"
- `Taalk_CallTimestamp` - ISO timestamp
- `Taalk_CompanyName` - Company name

---

## 🔄 Complete Flow

### Conference Track:
```
1. Agent clicks "Start Verification"
   ↓
2. Frontend → POST /api/verification/initiate-conference-call
   ↓
3. Backend → POST https://api.taalk.ai/api/call?db=michaelmandella
   ↓
4. Taalk calls agent's phone: "15551234567"
   ↓
5. Agent answers phone
   ↓
6. AI: "Hello Michael, I have John Doe on the line..."
   ↓
7. Agent conferences in client manually
   ↓
8. AI conducts verification with both parties
```

### Zoom Track:
```
1. Agent clicks "Start Verification"
   ↓
2. Frontend → POST /api/verification/initiate-zoom-call
   ↓
3. Backend → POST https://api.taalk.ai/api/call?db=michaelmandella
   ↓
4. Taalk calls Zoom bridge: "6692192599,,123456789#,,#,,abc123#"
   ↓
5. Zoom bridge auto-joins meeting with credentials
   ↓
6. AI joins Zoom meeting
   ↓
7. AI sees agent and client in Zoom
   ↓
8. AI conducts verification in Zoom call
```

---

## 🧪 Testing the API Call

### Test Conference Call:
```bash
curl -X POST https://api.taalk.ai/api/call?db=michaelmandella \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "name": "Test Client",
    "phone": "15551234567",
    "agent": "68a5ff0fc8f1520e59acf3e6",
    "retryMethod": 0,
    "webhookUrl": "https://your-app.com/api/taalk/webhook",
    "params": {
      "Taalk_AgentFirstName": "Test",
      "Taalk_AgentLastName": "Agent",
      "Taalk_ClientName": "Test Client",
      "Taalk_SessionId": "TEST-123"
    }
  }'
```

---

## 📊 Response from Taalk

### Success Response:
```json
{
  "success": true,
  "payload": {
    "id": "actual_taalk_call_id_here"
  },
  "callId": "actual_taalk_call_id_here",
  "status": "initiated"
}
```

### Our Backend Returns:
```json
{
  "success": true,
  "message": "Conference call initiated successfully via Taalk",
  "callId": "actual_taalk_call_id_here",
  "sessionId": "VER-1234567890",
  "taalkResult": { /* full Taalk response */ }
}
```

---

## 🚨 Critical Details

### Phone Number Cleaning:
```javascript
// Input: "+15551234567"
// Cleaned for Taalk: "15551234567"

const cleanPhone = formattedPhone.replace(/[^0-9]/g, '');
```

### Zoom Bridge Phone Construction:
```javascript
const zoomBridgePhone = `6692192599,,${zoomRoomId}#,,#,,${zoomPassword}#`;

// Example output:
// "6692192599,,123456789#,,#,,abc123#"
```

### Language Detection:
```javascript
// Session has language property
const taalkAgentId = session?.language === 'es' 
  ? '66461a241e0b08270180af7a'  // Spanish AI
  : '68a5ff0fc8f1520e59acf3e6'; // English AI
```

---

## 📁 Code Location

### Frontend:
- `client/src/pages/verification-workflow.tsx` (lines 252-325)
- `client/src/pages/verification-workflow-es.tsx` (lines 72-118)

### Backend:
- **Conference:** `server/routes.ts` (lines 8635-8884)
- **Zoom:** `server/routes.ts` (lines 8887-9140)

---

## 🔧 Modifying the Call

### To change what data is sent:

**Edit:** `server/routes.ts`

**Conference Track:** Line 8763 onwards (callParams object)
**Zoom Track:** Line 9031 onwards (callParams object)

### To add new parameters:
```javascript
params: {
  // Add your new field here
  "Taalk_NewField": "Your Value",
  
  // Existing fields...
  "Taalk_AgentFirstName": agentFirstName,
  // ...
}
```

---

## 🌐 Webhook Callbacks

After Taalk processes the call, it sends updates to:
```
POST https://policy-verify-mmandella.replit.app/api/taalk/webhook
```

**Updates include:**
- Call connected
- Call in progress
- Call completed
- Recording available

---

## ✅ Summary

**When agent clicks "Start Verification":**

1. Frontend sends session data to backend
2. Backend formats Taalk API call based on track type
3. **Conference:** Calls agent's phone directly
4. **Zoom:** Calls Zoom bridge with auto-dial credentials
5. Taalk AI conducts verification
6. Results sent back via webhook

---

**File:** `server/routes.ts`  
**Lines:** 8635-9140  
**Taalk Endpoint:** `https://api.taalk.ai/api/call?db=michaelmandella`

