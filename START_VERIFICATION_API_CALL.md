# 🎯 Start Verification - Taalk API Call

## When Agent Clicks "Start Verification"

This document shows the exact API call sent to Taalk when an agent clicks "Start Verification" in the AO Precheck workflow.

---

## 📞 API Endpoints

### Backend Routes:
1. **Conference Call Track:** `/api/verification/initiate-conference-call`
2. **Zoom Track:** `/api/verification/initiate-zoom-call`

### Taalk API Endpoint:
```
POST https://api.taalk.ai/api/call?db=michaelmandella
```

---

## 🔥 Conference Call Track (Phone Bridge)

### When Used:
- Spanish verification workflow
- Conference phone bridge option
- Direct phone call to agent

### Request to Backend:
```javascript
// Client calls this endpoint
POST /api/verification/initiate-conference-call

// Payload
{
  "sessionId": "VER-1234567890",
  "clientInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+15551234567",
    "city": "Dallas",
    "state": "TX",
    "premium": "149.00"
  },
  "agentPhone": "+15551234567"
}
```

### Taalk API Call (from server):
```javascript
POST https://api.taalk.ai/api/call?db=michaelmandella

Headers:
{
  "Content-Type": "application/json",
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4"
}

Body:
{
  "name": "John Doe",
  "phone": "15551234567",  // Agent's phone (cleaned, no +)
  "agent": "68a5ff0fc8f1520e59acf3e6",  // English AI agent ID
  "retryMethod": 0,
  "webhookUrl": "https://policy-verify-mmandella.replit.app/api/taalk/webhook",
  "params": {
    // Agent Information
    "Taalk_AgentFirstName": "Michael",
    "Taalk_AgentLastName": "Mandella",
    "Taalk_AgentPhone": "+15551234567",
    "Taalk_AgentEmail": "agent@aoglobelife.com",
    
    // Client Information
    "Taalk_MemberFirstName": "John",
    "Taalk_MemberFiirstName": "John",  // Typo for script compatibility
    "Taalk_MemberPhone": "+15551234567",
    "Taalk_PMemberFirstName": "John",
    "MemberFirstName": "John",
    "Taalk_ClientName": "John Doe",
    "Taalk_ClientPhone": "+15551234567",
    
    // Premium & Payment
    "Taalk_MonthlyPremium": "149.00",
    "Taalk_ALP": "149.00",
    "Taalk_ACHdrawdate": "January 15, 2025",
    "Taalk_ACHdrawdateshort": "1/15",
    
    // Location Data
    "Taalk_Location": "Dallas, TX",
    "Taalk_ClientCountry": "United States",
    "Taalk_ClientRegion": "TX",
    "Taalk_ClientCity": "Dallas",
    
    // Session Metadata
    "Taalk_SessionId": "VER-1234567890",
    "Taalk_VerificationMethod": "Conference Call",
    "Taalk_CallTimestamp": "2025-01-24T13:05:00.000Z",
    "Taalk_CompanyName": "Globe Life AIL Division"
  }
}
```

### Key Points:
- ✅ **phone** field = Agent's phone (Taalk calls the agent)
- ✅ **agent** field = Taalk AI agent ID (68a5ff0fc8f1520e59acf3e6 for English)
- ✅ **retryMethod** = 0 (no retry)
- ✅ Phone numbers cleaned (no + symbol in main phone field)

---

## 🎥 Zoom Track (Zoom Bridge)

### When Used:
- English verification workflow
- Zoom video call option
- AI joins Zoom meeting

### Request to Backend:
```javascript
// Client calls this endpoint
POST /api/verification/initiate-zoom-call

// Payload
{
  "sessionId": "VER-1234567890",
  "clientInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+15551234567",
    "zoomRoomId": "123456789",
    "zoomPassword": "abc123",
    "city": "Dallas",
    "state": "TX",
    "premium": "149.00"
  },
  "agentPhone": "+15551234567",
  "zoomRoomId": "123456789",
  "zoomPassword": "abc123"
}
```

### Taalk API Call (from server):
```javascript
POST https://api.taalk.ai/api/call?db=michaelmandella

Headers:
{
  "Content-Type": "application/json",
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4"
}

Body:
{
  "name": "John Doe",
  "phone": "19142289324",  // TWILIO phone for Zoom bridge (cleaned, no +)
  "agent": "68a5ff0fc8f1520e59acf3e6",  // English AI agent ID
  "retryMethod": 0,
  "webhookUrl": "https://policy-verify-mmandella.replit.app/api/taalk/webhook",
  "params": {
    // Agent Information
    "Taalk_AgentFirstName": "Michael",
    "Taalk_AgentLastName": "Mandella",
    "Taalk_AgentPhone": "+15551234567",
    "Taalk_AgentEmail": "agent@aoglobelife.com",
    
    // Client Information
    "Taalk_MemberFirstName": "John",
    "Taalk_MemberFiirstName": "John",
    "Taalk_ClientName": "John Doe",
    "Taalk_ClientPhone": "+15551234567",
    
    // Zoom Information (CRITICAL!)
    "Taalk_ZoomRoomId": "123456789",
    "Taalk_ZoomPassword": "abc123",
    "Taalk_ZoomMeetingUrl": "https://zoom.us/j/123456789",
    
    // Premium & Payment
    "Taalk_MonthlyPremium": "149.00",
    "Taalk_ALP": "149.00",
    "Taalk_ACHdrawdate": "January 15, 2025",
    "Taalk_ACHdrawdateshort": "1/15",
    
    // Location Data
    "Taalk_Location": "Dallas, TX",
    "Taalk_ClientCountry": "United States",
    "Taalk_ClientRegion": "TX",
    "Taalk_ClientCity": "Dallas",
    
    // Session Metadata
    "Taalk_SessionId": "VER-1234567890",
    "Taalk_VerificationMethod": "Zoom",
    "Taalk_CallTimestamp": "2025-01-24T13:05:00.000Z",
    "Taalk_CompanyName": "Globe Life AIL Division"
  }
}
```

### Key Points:
- ✅ **phone** field = Twilio phone (+19142289324) - NOT agent's phone!
- ✅ **Zoom params** included (RoomId, Password, MeetingUrl)
- ✅ Twilio dials into Zoom, then Taalk AI joins
- ✅ Agent is already in Zoom waiting

---

## 🔑 Important Fields

### Agent IDs (Taalk AI):
```javascript
// English AI
"agent": "68a5ff0fc8f1520e59acf3e6"

// Spanish AI
"agent": "66461a241e0b08270180af7a"
```

### Campaign ID:
```javascript
const workingCampaignId = "6747819a86c131c2cb203719";  // AO Precheck verification
```

### Phone Number Formatting:
```javascript
// Input: "+15551234567" or "5551234567"
// Output for main phone field: "15551234567" (no + symbol)
// Output for params: "+15551234567" (keep + symbol)

const cleanPhone = formattedPhone.replace(/[^0-9]/g, '');
```

---

## 🔄 Flow Diagram

### Conference Call Track:
```
Agent clicks "Start Verification"
    ↓
Frontend: POST /api/verification/initiate-conference-call
    ↓
Backend: POST https://api.taalk.ai/api/call?db=michaelmandella
    ↓
Taalk AI calls agent's phone
    ↓
Agent answers → Verification begins
```

### Zoom Track:
```
Agent clicks "Start Verification"
    ↓
Frontend: POST /api/verification/initiate-zoom-call
    ↓
Backend: POST https://api.taalk.ai/api/call?db=michaelmandella
    ↓
Taalk calls Twilio phone (+19142289324)
    ↓
Twilio joins Zoom meeting
    ↓
Taalk AI joins via Twilio → Verification begins
```

---

## 📋 Required Parameters

### Minimum Required:
```javascript
{
  "name": "Client Full Name",        // Required
  "phone": "Phone Number",            // Required (agent or Twilio)
  "agent": "Taalk AI Agent ID",      // Required
  "retryMethod": 0,                   // Required
  "webhookUrl": "Webhook URL",        // Optional but recommended
  "params": { /* client details */ }  // Optional but needed for script
}
```

---

## 🐛 Common Issues

### Issue: Call doesn't initiate
**Check:**
- ✅ Phone number format (should be cleaned, no +)
- ✅ Agent ID is correct for language
- ✅ API key is valid
- ✅ Webhook URL is accessible

### Issue: Wrong person gets called
**Check:**
- ✅ Conference track: `phone` = agent's phone
- ✅ Zoom track: `phone` = Twilio phone (+19142289324)

### Issue: AI doesn't have client info
**Check:**
- ✅ All `Taalk_*` params are populated
- ✅ Premium, ACH dates, location included
- ✅ Typo field `Taalk_MemberFiirstName` included (yes, really)

---

## 📝 Response Format

### Success Response:
```javascript
{
  "success": true,
  "message": "Conference call initiated successfully via Taalk",
  "callId": "taalk_call_id_here",
  "sessionId": "VER-1234567890",
  "taalkResult": { /* full Taalk response */ }
}
```

### Error Response:
```javascript
{
  "success": false,
  "error": "Taalk API error: 400 - Invalid phone number"
}
```

---

## 📍 Files Involved

1. **Client trigger:** `client/src/pages/verification-workflow.tsx` (line 252-325)
2. **Backend conference:** `server/routes.ts` (line 8635-8884)
3. **Backend zoom:** `server/routes.ts` (line 8887+)
4. **Taalk service:** `server/taalk-service.ts`

---

**API Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  
**Database:** michaelmandella  
**Webhook:** https://policy-verify-mmandella.replit.app/api/taalk/webhook

