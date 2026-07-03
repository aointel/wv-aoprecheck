# Zapier SMS Webhook Integration Guide

## Overview

This document provides implementation details for integrating AO Precheck with Zapier webhooks to handle SMS text events and verification workflows.

## Webhook Endpoints

### 1. SMS Events Webhook
**Endpoint:** `POST /api/webhook/sms-events`

This endpoint receives SMS events from Zapier workflows and processes verification status updates.

#### Supported Event Types

1. **`verification_complete`** - Marks verification session as completed
2. **`client_response`** - Processes client responses to verification requests
3. **`delivered`** - Confirms SMS delivery status
4. **`received`** - Logs incoming SMS messages

#### Request Format

```json
{
  "sessionId": "VER-1234567890-ABC123",
  "phone": "+15551234567",
  "message": "Client response text",
  "status": "delivered|failed|pending",
  "timestamp": "2025-01-24T13:05:00Z",
  "direction": "inbound|outbound",
  "eventType": "verification_complete|client_response|delivered|received",
  "metadata": {
    "custom": "data"
  }
}
```

#### Response Format

```json
{
  "success": true,
  "message": "SMS event processed successfully",
  "eventType": "verification_complete",
  "sessionId": "VER-1234567890-ABC123",
  "timestamp": "2025-01-24T13:05:00Z"
}
```

### 2. Test Webhook
**Endpoint:** `POST /api/webhook/test`

Used for testing Zapier connectivity and debugging webhook payloads.

## Event Processing Logic

### Verification Completion
When `eventType` is `verification_complete`:
- Updates session status to 'completed'
- Sets `completedAt` timestamp
- Logs completion event

### Client Response Processing
When `eventType` is `client_response`:
- Analyzes message content for confirmation keywords:
  - "yes", "confirm", "verified", "complete"
- If confirmed, marks verification as completed
- Logs client response with message content

### SMS Delivery Tracking
When `eventType` is `delivered`:
- Logs successful SMS delivery
- Updates delivery status for session tracking

## Zapier Integration Setup

### 1. Webhook URL Configuration

**Your Zapier Catch Hook:**
```
https://hooks.zapier.com/hooks/catch/2467580/uu5qnr4/
```

**SMS Events Webhook (for receiving events):**
```
https://your-app.replit.app/api/webhook/sms-events
```

**Call Trigger Endpoint (for sending to Zapier):**
```
https://your-app.replit.app/api/zapier/trigger-call
```

### 2. Required Headers
```
Content-Type: application/json
```

### 3. Authentication (Optional)
For production, consider adding webhook authentication:
- API key validation
- HMAC signature verification
- IP whitelist restrictions

## Call Trigger Integration

### Triggering Verification Calls via Zapier

When agents click "Start Verification Call" in the app, the system sends a payload to your Zapier webhook:

```json
{
  "sessionId": "VER-1234567890-ABC123",
  "phone": "+15551234567",
  "clientName": "John Doe",
  "verificationMethod": "phone",
  "eventType": "start_verification_call",
  "timestamp": "2025-01-24T13:05:00Z",
  "webhookUrl": "https://your-app.replit.app/api/webhook/sms-events"
}
```

Your Zapier workflow can then:
1. Initiate the call using your preferred service (Taalk, Twilio, etc.)
2. Send status updates back to the webhook URL provided
3. Process call completion events

## Example Zapier Workflows

### Workflow 1: SMS Delivery Confirmation
**Trigger:** SMS sent via Twilio/Taalk
**Action:** Send webhook to confirm delivery

```json
{
  "sessionId": "{{session_id}}",
  "phone": "{{recipient_phone}}",
  "eventType": "delivered",
  "direction": "outbound",
  "status": "delivered",
  "timestamp": "{{delivery_timestamp}}"
}
```

### Workflow 2: Client Response Processing
**Trigger:** Incoming SMS received
**Action:** Process client verification response

```json
{
  "sessionId": "{{extracted_session_id}}",
  "phone": "{{sender_phone}}",
  "message": "{{sms_content}}",
  "eventType": "client_response",
  "direction": "inbound",
  "timestamp": "{{received_timestamp}}"
}
```

### Workflow 3: Manual Verification Completion
**Trigger:** Agent marks verification complete
**Action:** Update session status

```json
{
  "sessionId": "{{session_id}}",
  "phone": "{{client_phone}}",
  "eventType": "verification_complete",
  "timestamp": "{{completion_timestamp}}",
  "metadata": {
    "completed_by": "agent",
    "method": "manual"
  }
}
```

## Testing the Integration

### 1. Test Webhook Connectivity
```bash
curl -X POST https://your-app.replit.app/api/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"test": "data", "timestamp": "2025-01-24T13:05:00Z"}'
```

### 2. Test SMS Event Processing
```bash
curl -X POST https://your-app.replit.app/api/webhook/sms-events \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "VER-1234567890-ABC123",
    "phone": "+15551234567",
    "message": "yes verified",
    "eventType": "client_response",
    "direction": "inbound",
    "timestamp": "2025-01-24T13:05:00Z"
  }'
```

### 3. Test Verification Completion
```bash
curl -X POST https://your-app.replit.app/api/webhook/sms-events \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "VER-1234567890-ABC123",
    "phone": "+15551234567",
    "eventType": "verification_complete",
    "timestamp": "2025-01-24T13:05:00Z"
  }'
```

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid request format",
  "error": "Missing required field: sessionId"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "message": "Session not found",
  "error": "No verification session found for ID: VER-1234567890-ABC123"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to process SMS event",
  "error": "Database connection failed"
}
```

## Monitoring and Logging

All webhook events are logged with:
- Event type and session ID
- Processing status and results
- Error details if processing fails
- Timestamp and phone number details

Monitor logs for:
- Failed webhook processing
- Invalid session IDs
- Malformed request payloads
- Authentication failures (if implemented)

## Security Considerations

1. **Input Validation**: All webhook payloads are validated before processing
2. **Rate Limiting**: Consider implementing rate limits for webhook endpoints
3. **Authentication**: Add API key or signature validation for production
4. **HTTPS Only**: Ensure all webhook URLs use HTTPS in production
5. **Data Sanitization**: Phone numbers and messages are sanitized before processing

## Development vs Production

### Development
- Use Replit preview URL for testing
- All webhook events logged to console
- No authentication required

### Production
- Use custom domain with SSL
- Implement webhook authentication
- Add rate limiting and monitoring
- Configure proper error alerting