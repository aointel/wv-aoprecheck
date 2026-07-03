# Taalk VDP Webhook Integration Examples

## Overview
The ConnectNow inbound call takeover system provides comprehensive webhook endpoints for integrating with external agent assignment and notification systems.

## Webhook Endpoints

### 1. Incoming Call Webhook
**URL**: `POST /api/taalk/incoming-call`

**Purpose**: Receives incoming VDP calls and automatically assigns agents

**Payload Example**:
```javascript
{
  From: '+15551234567',
  CallSid: 'CA123456789',
  To: '+16052500834',
  CallStatus: 'in-progress',
  Direction: 'inbound',
  CallerName: 'John Smith',
  CallerCity: 'Dallas',
  CallerState: 'TX',
  CallerZip: '75201'
}
```

**Response**: TwiML for call handling

### 2. Agent Assignment Webhook
**URL**: `POST /api/taalk/assign-agent`

**Purpose**: Manually assign or reassign calls to specific agents

**Payload Example**:
```javascript
{
  callSid: 'CA123456789',
  agentEmail: 'agent@company.com',
  assignmentReason: 'VIP customer - specialty required'
}
```

### 3. Recording Completion Webhook
**URL**: `POST /api/taalk/recording-complete`

**Purpose**: Processes voicemail recordings from missed calls

## Integration Examples

### Example 1: Slack Integration
```javascript
// In notifyAgentOfIncomingCall function
const slackWebhookUrl = 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK';
const slackPayload = {
  text: `🔔 Incoming VDP Call Assignment`,
  attachments: [{
    color: '#ff0000',
    fields: [
      { title: 'Caller', value: callData.leadName, short: true },
      { title: 'Number', value: callData.callerNumber, short: true },
      { title: 'Location', value: `${callData.leadCity}, ${callData.leadState}`, short: true },
      { title: 'Assigned Agent', value: callData.agentEmail, short: true },
      { title: 'Call ID', value: callData.callSid, short: false }
    ]
  }]
};

await fetch(slackWebhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(slackPayload)
});
```

### Example 2: SMS Alert Integration
```javascript
// Using Twilio SMS for agent notifications
const smsPayload = {
  body: `🔔 VDP Call: ${callData.leadName} (${callData.callerNumber}) from ${callData.leadCity}, ${callData.leadState}. Answer at ConnectNow dashboard.`,
  from: '+16052500834',
  to: getAgentPhoneNumber(callData.agentEmail)
};

await twilioClient.messages.create(smsPayload);
```

### Example 3: CRM Integration
```javascript
// Webhook to external CRM system
const crmWebhookUrl = 'https://your-crm.com/api/incoming-call';
const crmPayload = {
  event: 'incoming_call_assigned',
  timestamp: new Date().toISOString(),
  call: {
    id: callData.callSid,
    phone: callData.callerNumber,
    source: 'taalk_vdp',
    type: 'inbound',
    priority: 'high'
  },
  lead: {
    name: callData.leadName,
    city: callData.leadCity,
    state: callData.leadState,
    status: 'hot'
  },
  agent: {
    email: callData.agentEmail,
    assignment_type: 'automatic',
    assigned_at: new Date().toISOString()
  }
};

await fetch(crmWebhookUrl, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_CRM_API_KEY'
  },
  body: JSON.stringify(crmPayload)
});
```

### Example 4: Teams Integration
```javascript
// Microsoft Teams webhook
const teamsWebhookUrl = 'https://outlook.office.com/webhook/YOUR_TEAMS_WEBHOOK';
const teamsPayload = {
  "@type": "MessageCard",
  "@context": "http://schema.org/extensions",
  "themeColor": "FF0000",
  "summary": "Incoming VDP Call Assignment",
  "sections": [{
    "activityTitle": "🔔 New VDP Call Assignment",
    "activitySubtitle": `${callData.leadName} calling from ${callData.leadCity}, ${callData.leadState}`,
    "facts": [
      { "name": "Caller Number", "value": callData.callerNumber },
      { "name": "Assigned Agent", "value": callData.agentEmail },
      { "name": "Call Type", "value": callData.callType },
      { "name": "Call ID", "value": callData.callSid }
    ]
  }],
  "potentialAction": [{
    "@type": "OpenUri",
    "name": "Open ConnectNow Dashboard",
    "targets": [{ "os": "default", "uri": "https://aointelligence.replit.app/dashboard" }]
  }]
};
```

## Agent Assignment Logic Customization

### Current Implementation
The system uses a simple round-robin assignment between default agents:
- cnsysop@aoglobelife.com
- tabitha@aoglobelife.com  
- chris@aoglobelife.com

### Enhanced Assignment Examples

#### 1. Skill-Based Assignment
```javascript
async function findAvailableAgent(callData) {
  // Check if call is from specific states requiring specialists
  const specialtyStates = ['TX', 'FL', 'CA'];
  
  if (specialtyStates.includes(callData.leadState)) {
    return await findAgentBySpecialty(callData.leadState);
  }
  
  return await findGeneralAgent();
}
```

#### 2. Workload-Based Assignment
```javascript
async function findAvailableAgent() {
  // Query current active calls per agent
  const agentWorkloads = await db
    .select({
      agentEmail: schema.incomingCalls.assignedAgentEmail,
      activeCalls: sql`COUNT(*)`
    })
    .from(schema.incomingCalls)
    .where(eq(schema.incomingCalls.status, 'answered'))
    .groupBy(schema.incomingCalls.assignedAgentEmail);
  
  // Find agent with lowest workload
  return findLeastBusyAgent(agentWorkloads);
}
```

#### 3. Time-Based Assignment
```javascript
async function findAvailableAgent() {
  const currentHour = new Date().getHours();
  
  // Night shift agents (after 6 PM)
  if (currentHour >= 18 || currentHour < 9) {
    return nightShiftAgents[0];
  }
  
  // Day shift agents
  return dayShiftAgents[Math.floor(Math.random() * dayShiftAgents.length)];
}
```

## Testing Your Integration

Run the test script to verify webhook functionality:
```bash
node test-inbound-call-takeover.js
```

This will simulate a complete VDP call flow including:
- Incoming call webhook processing
- Agent assignment
- Call state management
- Cleanup verification

## Production Configuration

1. **Update Agent Assignment Logic**: Modify `findAvailableAgent()` function in `server/routes.ts`

2. **Configure Notification Webhooks**: Uncomment and customize the webhook examples in `notifyAgentOfIncomingCall()`

3. **Set Environment Variables**: 
   ```bash
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK
   TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/YOUR_WEBHOOK
   CRM_API_KEY=your_crm_api_key
   CRM_WEBHOOK_URL=https://your-crm.com/api/webhook
   ```

4. **Test with Real VDP Data**: Replace test data in webhook calls with actual Taalk VDP parameters

The system is now ready for full VDP integration with customized agent assignment and notification workflows!