# 🔗 Zapier Webhook Configuration List

## Server URLs

### Production (Live)
```
https://aoirail-production.up.railway.app
```

### Staging (Testing)
```
https://aoirail-beta-staging.up.railway.app
```

**Note:** Test all webhooks in staging first!

---

## 🎯 CRITICAL WEBHOOKS (Must Configure)

### 1. Credit Adjustment Webhook
**Purpose:** Apply credits based on associate_id for call billing  
**Zapier Setup:** Send POST requests when credits need to be applied

```
POST https://aoirail-production.up.railway.app/api/webhook/credit-adjustment
```

**Payload Format:**
```json
{
  "associate_id": "12345",
  "credits": 10,
  "reason": "Call completed",
  "call_sid": "CA1234567890abcdef",
  "timestamp": "2025-01-24T13:05:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Credits applied successfully",
  "associate_id": "12345",
  "credits_applied": 10,
  "new_balance": 250
}
```

---

### 2. VDP Events Webhook
**Purpose:** Track Taalk VDP (Video Dialer Pro) call events  
**Zapier Setup:** Send call events from Taalk to database

```
POST https://aoirail-production.up.railway.app/api/webhook/vdp-events
```

**Payload Format:**
```json
{
  "date": "2025-01-24",
  "time": "13:05:00",
  "event_type": "call_completed",
  "phone_number": "+15551234567",
  "agent_id": "agent@aoglobelife.com",
  "lead_id": "123",
  "duration": "180",
  "disposition": "interested"
}
```

---

### 3. SMS Events Webhook
**Purpose:** Handle SMS verification events and client responses  
**Zapier Setup:** Forward SMS events from Twilio/messaging service

```
POST https://aoirail-production.up.railway.app/api/webhook/sms-events
```

**Payload Format:**
```json
{
  "sessionId": "VER-1234567890-ABC123",
  "phone": "+15551234567",
  "message": "yes verified",
  "eventType": "client_response",
  "direction": "inbound",
  "status": "delivered",
  "timestamp": "2025-01-24T13:05:00Z"
}
```

**Event Types:**
- `verification_complete` - Mark verification as done
- `client_response` - Process client SMS replies
- `delivered` - Confirm SMS delivery
- `received` - Log incoming SMS

---

### 4. Taalk Call Completion Webhook
**Purpose:** Track when Taalk calls complete for follow-up  
**Zapier Setup:** Receive call completion notifications

```
POST https://aoirail-production.up.railway.app/api/taalk/webhook
```

**Payload Format:**
```json
{
  "call_id": "taalk_123456",
  "agent_email": "agent@aoglobelife.com",
  "client_phone": "+15551234567",
  "duration": 180,
  "status": "completed",
  "disposition": "interested",
  "timestamp": "2025-01-24T13:05:00Z"
}
```

---

### 5. CSV Lead Import Webhook
**Purpose:** Import leads from CSV data into system  
**Zapier Setup:** Send parsed CSV lead data

```
POST https://aoirail-production.up.railway.app/api/webhook/csv-leads
```

**Payload Format:**
```json
{
  "leads": [
    {
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+15551234567",
      "email": "john@example.com",
      "state": "TX",
      "campaign": "veteran_leads",
      "assignedTo": "agent@aoglobelife.com"
    }
  ],
  "source": "zapier_import",
  "campaign": "veteran_leads",
  "timestamp": "2025-01-24T13:05:00Z"
}
```

---

## 📞 TWILIO WEBHOOKS (Auto-configured)

### 6. Twilio VDP Call Detection
**Purpose:** Automatically detect and log VDP calls  
**Note:** Usually auto-configured, but may need manual setup

```
POST https://aoirail-production.up.railway.app/api/twilio/vdp-webhook
```

### 7. WebRTC Phone Bridge
**Purpose:** Handle browser-to-phone calls  
**Note:** TwiML app webhook

```
POST https://aoirail-production.up.railway.app/webhook/webrtc
```

---

## 💰 STRIPE WEBHOOK (If Using Payments)

### 8. Stripe Payment Events
**Purpose:** Handle payment confirmations and subscription events  
**Zapier Setup:** Forward Stripe events

```
POST https://aoirail-production.up.railway.app/api/webhooks/stripe
```

**Note:** Requires Stripe signature validation header

---

## 🔥 HOTLEAD WEBHOOKS (Optional)

### 9. Send Qualifying Hotleads
**Purpose:** Trigger webhook for hotleads (90+ second calls)  
**Type:** Internal trigger (not incoming)

```
POST https://aoirail-production.up.railway.app/api/hotleads/send-qualifying-webhooks
```

---

## 🧪 TEST WEBHOOKS

### Test Endpoint
**Purpose:** Test Zapier connectivity and debug payloads

```
POST https://aoirail-production.up.railway.app/api/webhook/test
```

**Test Payload:**
```json
{
  "test": true,
  "message": "Testing Zapier webhook",
  "timestamp": "2025-01-24T13:05:00Z"
}
```

---

## 🛠️ ZAPIER CONFIGURATION STEPS

### For Each Webhook:

1. **Create New Zap**
   - Trigger: Your data source (SMS, Taalk, CSV, etc.)
   - Action: Webhooks by Zapier

2. **Configure Webhook Action**
   - Action Event: POST
   - URL: (Copy from list above)
   - Payload Type: JSON
   - Data: Map your trigger fields to webhook format

3. **Add Headers**
   ```
   Content-Type: application/json
   ```

4. **Test the Connection**
   - Send test data
   - Verify 200 OK response
   - Check Railway logs for confirmation

5. **Turn On Zap**

---

## 📋 PRIORITY ORDER FOR SETUP

### MUST HAVE (Set up first):
1. ✅ **Credit Adjustment Webhook** - Billing critical
2. ✅ **VDP Events Webhook** - Call tracking
3. ✅ **SMS Events Webhook** - Verification workflow

### SHOULD HAVE (Set up next):
4. ✅ **Taalk Call Completion** - Follow-up tracking
5. ✅ **CSV Lead Import** - Lead management

### NICE TO HAVE (Optional):
6. ⚪ Hotlead webhooks
7. ⚪ Stripe webhooks (if using payments)

---

## 🔍 TESTING YOUR WEBHOOKS

### Using curl:
```bash
# Test Credit Adjustment
curl -X POST https://aoirail-production.up.railway.app/api/webhook/credit-adjustment \
  -H "Content-Type: application/json" \
  -d '{
    "associate_id": "12345",
    "credits": 5,
    "reason": "Test credit",
    "timestamp": "2025-01-24T13:05:00Z"
  }'

# Test VDP Events
curl -X POST https://aoirail-production.up.railway.app/api/webhook/vdp-events \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-01-24",
    "time": "13:05:00",
    "event_type": "call_completed",
    "phone_number": "+15551234567",
    "agent_id": "test@aoglobelife.com"
  }'

# Test SMS Events
curl -X POST https://aoirail-production.up.railway.app/api/webhook/sms-events \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "TEST-123",
    "phone": "+15551234567",
    "message": "test",
    "eventType": "delivered",
    "timestamp": "2025-01-24T13:05:00Z"
  }'
```

### Using Postman:
1. Import the webhook URLs
2. Set method to POST
3. Add JSON body
4. Send request
5. Verify 200 OK response

---

## 📊 MONITORING

### Check Railway Logs:
```bash
# Look for these success messages:
✅ "Credit adjustment webhook received"
✅ "Received VDP event webhook"
✅ "SMS Event Webhook received"
✅ "Taalk webhook received"
```

### Common Errors:
- ❌ 400: Invalid payload format
- ❌ 404: Wrong URL
- ❌ 500: Server error (check logs)

---

## 🔐 SECURITY NOTES

### Current Setup:
- No authentication required (for ease of setup)
- All webhooks accept POST requests

### Production Recommendations:
- Add API key validation
- Implement rate limiting
- Use webhook signatures
- IP whitelist if possible

---

## 📞 SUPPORT

If webhooks aren't working:
1. Check URL is correct (copy/paste exactly)
2. Verify JSON payload format
3. Check Railway logs for errors
4. Test with curl first
5. Verify Railway deployment is running

---

## 🎯 QUICK REFERENCE

**Most Important Webhook (START HERE):**
```
Credit Adjustment:
https://aoirail-production.up.railway.app/api/webhook/credit-adjustment
```

**Test Webhook (Use for initial Zapier setup):**
```
Test Endpoint:
https://aoirail-production.up.railway.app/api/webhook/test
```

---

**Last Updated:** 2025-01-24  
**Environment:** Production (Railway)

