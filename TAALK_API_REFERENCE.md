# 🎯 Taalk API Reference

## API Base URLs

### Primary API Endpoint:
```
https://api.taalk.ai/api
```

### Alternative Endpoint:
```
https://lets.taalk.ai/api
```

---

## 🔑 API Credentials

### API Key (Bearer Token):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4
```

### Database Parameter:
```
db=michaelmandella
```

---

## 📞 API Endpoints

### 1. Initiate Call
**POST** `/call?db=michaelmandella`

**Base URL:**
```
https://api.taalk.ai/api/call?db=michaelmandella
```

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Payload Example (Conference Call):**
```json
{
  "name": "John Doe",
  "phone": "+15551234567",
  "agent": "michaelmandella",
  "campaign": "CAMPAIGN_ID_HERE",
  "retryMethod": "both",
  "params": {
    "firstName": "John",
    "lastName": "Doe",
    "spouseName": "Jane Doe",
    "city": "Dallas",
    "state": "TX",
    "premium": "149.00",
    "achDrawDate": "January 15, 2025",
    "achDrawDateShort": "1/15"
  }
}
```

**Payload Example (Zoom Call):**
```json
{
  "name": "John Doe",
  "phone": "+19142289324",
  "agent": "michaelmandella",
  "campaign": "CAMPAIGN_ID_HERE",
  "retryMethod": "both",
  "params": {
    "firstName": "John",
    "lastName": "Doe",
    "zoomRoomId": "1234567890",
    "zoomPassword": "abc123",
    "agentPhone": "+15551234567",
    "city": "Dallas",
    "state": "TX",
    "premium": "149.00"
  }
}
```

---

### 2. Get Recording
**GET** `/calls/{callId}/recording?db=michaelmandella`

**Full URL:**
```
https://api.taalk.ai/api/calls/{CALL_ID}/recording?db=michaelmandella
```

**Headers:**
```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "audio/mpeg, audio/mp3, audio/*, */*",
  "Origin": "https://lets.taalk.ai",
  "Referer": "https://lets.taalk.ai/"
}
```

**Response:** Audio file (MP3)

---

### 3. Get Transcript ⭐ NEW
**GET** `/calls/{callId}/transcript?db=michaelmandella`

**Full URL:**
```
https://api.taalk.ai/api/calls/{CALL_ID}/transcript?db=michaelmandella
```

**Headers:**
```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:** Plain text transcript with speaker labels

**Example Response:**
```
AI: Hola agente Joel R. Por favor, confirma tu correo electrónico de la empresa?

Customer: Joel r Fernández García A O blog live.

AI: ¡Gracias por eso! Hola claudia. Soy Alex Swift de la División AIL de Globe Life...

Customer: Correcto.

AI: Run Summary
```

**Notes:**
- Returns full conversation transcript with "AI:" and "Customer:" labels
- Works for both English and Spanish calls
- Much faster & cheaper than using OpenAI Whisper on recordings
- Available immediately after call completion

---

### 4. Get AI Summary ⭐ NEW
**GET** `/calls/{callId}/summary?db=michaelmandella`

**Full URL:**
```
https://api.taalk.ai/api/calls/{CALL_ID}/summary?db=michaelmandella
```

**Headers:**
```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:** JSON with AI analysis
```json
{
  "payload": {
    "_id": "68eeca7b7143cbaaf7be6d3f",
    "summary": [
      {"key": "Quick recap", "value": "Alex Swift from Globe Life conducted a verification call..."},
      {"key": "Next steps", "value": "Information will be sent for review and policy issuance..."},
      {"key": "Summary of key topics", "value": "Verification of contact info, premium confirmation..."},
      {"key": "Rate the Sentiment of the call in 0~10", "value": "9"},
      {"key": "The user refuse to accept phone call", "value": "False"},
      {"key": "PREVIEW", "value": "PASS - Agent: Alex, Client: Christine, Premium: $96.89..."},
      {"key": "Agent Confirmed", "value": "Y"},
      {"key": "Contact Verified", "value": "Y"},
      {"key": "Premium OK", "value": "Y"},
      {"key": "Medical Q's Asked", "value": "Y"},
      {"key": "Legal Q's Asked", "value": "Y"},
      {"key": "Needs Analysis", "value": "Y"},
      {"key": "Client Satisfied", "value": "Y"},
      {"key": "Red Flags", "value": "None"},
      {"key": "Favorite Feature", "value": "Coverage for burial expenses"},
      {"key": "RESULT", "value": "Verification PASSED - agent compliant"}
    ]
  }
}
```

**Fields Include:**
- Quick recap, Next steps, Key topics
- Sentiment score (0-10)
- Compliance checklist (Agent Confirmed, Contact Verified, Premium OK, Medical/Legal Q's, etc.)
- Red flags, Favorite feature
- PASS/FAIL result

---

### 5. Get Calls List (VDP)
**GET** `/vdp/calls?db=michaelmandella`

**Query Parameters:**
- `from`: ISO timestamp (e.g., `2025-01-24T00:00:00.000Z`)
- `to`: ISO timestamp
- `page`: Page number
- `limit`: Results per page

**Example:**
```
https://api.taalk.ai/api/vdp/calls?db=michaelmandella&from=2025-01-24T00:00:00.000Z&to=2025-01-24T23:59:59.999Z&page=1&limit=100
```

---

## 🎯 Campaign IDs

### AO Precheck Verification Campaign:
```
6747819a86c131c2cb203719
```

---

## 🔧 Configuration in Code

### Where to find Taalk API config:

1. **`server/taalk-service.ts`** - Main Taalk service
2. **`server/taalk-handler.ts`** - Call initiation handler  
3. **`server/ai-verification-service.ts`** - AI verification
4. **`server/hotlead-sync-service.ts`** - Hotlead sync
5. **`server/routes.ts`** - API endpoints

### Standard Configuration:
```typescript
const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
const taalkBaseUrl = "https://api.taalk.ai/api";
const dbParam = "michaelmandella";
```

---

## 📋 Common Use Cases

### 1. Conference Call (Phone Bridge)
```typescript
const response = await fetch(`https://api.taalk.ai/api/call?db=michaelmandella`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    name: "Client Name",
    phone: "+15551234567",
    agent: "michaelmandella",
    campaign: "CAMPAIGN_ID",
    retryMethod: "both",
    params: {
      // client details
    }
  })
});
```

### 2. Zoom Call with AI
```typescript
const response = await fetch(`https://api.taalk.ai/api/call?db=michaelmandella`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    name: "Client Name",
    phone: "TWILIO_PHONE",
    agent: "michaelmandella",
    campaign: "ZOOM_CAMPAIGN_ID",
    retryMethod: "both",
    params: {
      zoomRoomId: "123456789",
      zoomPassword: "abc123",
      agentPhone: "+15551234567",
      // client details
    }
  })
});
```

### 3. Download Recording
```typescript
const callId = "SESSION_ID_OR_CALL_ID";
const response = await fetch(
  `https://api.taalk.ai/api/calls/${callId}/recording?db=michaelmandella`,
  {
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Origin': 'https://lets.taalk.ai',
      'Referer': 'https://lets.taalk.ai/'
    }
  }
);

const audioBlob = await response.blob();
```

---

## 🌐 VDP (Video Dialer Pro) Integration

### Frontend SDK:
```html
<script>
(function() {
  window.TaalkVDPSettings = {
    APIKey: "pub.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay41NDYyOWJkOS03Y2ZkLTQyYTUtYWY2Mi0xMGRmOTkzMmMzY2EiLCJuYW1lIjoiVkRQIEFQSSBLZXkiLCJzY29wZXMiOlsidmRwIl0sImV4cCI6MjA2NTg1MTI5Nn0.z-O2F_W0rkyyq-lhwmwEFt21HFW30tTu9As1-5f8O68",
    container: "#mount-vdp-selector"
  };
  const script = document.createElement("script");
  script.defer = true;
  script.id = "Taalk_VDP_script";
  script.src = "https://lets.taalk.ai/sdk/vdp_client/michaelmandella";
  document.head.appendChild(script);
})();
</script>
```

---

## 🔒 Security Notes

1. **API Key** is embedded in code (hardcoded)
2. **Database name** is always `michaelmandella`
3. **Bearer token** used for authentication
4. **Origin headers** required for recording downloads

---

## 📞 Phone Numbers

### Twilio Phone (for Zoom bridge):
```
+19142289324
```

---

## 🐛 Debugging

### Check if call was initiated:
```bash
# Look for session in database
SELECT * FROM verification_sessions WHERE session_id = 'YOUR_SESSION_ID';
```

### Check recording availability:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://api.taalk.ai/api/calls/CALL_ID/recording?db=michaelmandella"
```

---

## 📝 Files Using Taalk API

1. `server/taalk-service.ts` - Main service
2. `server/taalk-handler.ts` - Call handler
3. `server/ai-verification-service.ts` - AI verification
4. `server/hotlead-sync-service.ts` - Hotlead sync
5. `server/routes.ts` - API routes
6. `server/download-recordings.ts` - Recording downloader
7. `server/rescue-recent-recordings.ts` - Recording rescue

---

**API Key Expiration:** 2055 (exp: 2055035692)

